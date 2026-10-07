import { AI_LIMITS } from '../../shared/ai-contracts.js';
import { isCancelled } from './ai-gateway.js';
import { icon } from './ui.js';

/**
 * One playback owner per view: cancellable generation, cached audio, and device-voice fallback.
 * @param {object} ctx View context with store, German speech service, notifications, and abort signal.
 * @param {object} client Same-origin gateway client; only an explicit natural-voice choice uses it.
 * @param {object} [options] Injectable audio creation and existing-media pause hooks.
 * @returns {{play: Function, stop: Function, dispose: Function}} Playback controls; errors are shown through ctx.error.
 */
export function createAISpeech(ctx, client, {
  makeAudio = () => new Audio(),
  pauseOtherAudio = () => document.querySelectorAll('audio').forEach(audio => audio.pause()),
} = {}) {
  let current = null;
  let voiceConfig = null;
  let sequence = 0;
  let disposed = false;
  const active = task => current === task && !task.controller.signal.aborted && !disposed && !ctx.signal?.aborted;

  function buttonLabel(task, label) {
    if (!task.button?.isConnected) return;
    task.button.dataset.aiPlayback = task.id;
    task.button.dataset.playing = 'true';
    task.button.innerHTML = `${icon('stop')}${label}`;
  }
  function restoreButton(task) {
    if (task.button?.dataset.aiPlayback !== task.id) return;
    task.button.innerHTML = task.original;
    delete task.button.dataset.aiPlayback;
    delete task.button.dataset.playing;
  }
  function releaseAudio(task) {
    clearTimeout(task.timer);
    if (task.audio) {
      task.audio.onended = null; task.audio.onerror = null; task.audio.onpause = null;
      task.audio.pause();
      task.audio.removeAttribute('src');
      task.audio = null;
    }
    if (task.url) { URL.revokeObjectURL(task.url); task.url = ''; }
  }
  function stop() {
    const task = current;
    current = null;
    if (task) {
      task.controller.abort();
      task.finish?.({ status: 'cancelled' });
      releaseAudio(task);
      restoreButton(task);
    }
    ctx.speech.stop();
  }

  async function naturalAudio(task, text) {
    if (text.length > AI_LIMITS.speechChars) throw new Error('This reply is longer than the natural-voice limit.');
    const signal = task.controller.signal;
    const config = voiceConfig ?? await client.status({ signal });
    if (!active(task)) return null;
    if (!config.configured || !config.authenticated || !config.naturalVoiceConfigured || !config.naturalVoiceId || !config.models?.speech) {
      throw new Error('Unlock a configured natural-voice gateway first.');
    }
    voiceConfig = config;
    // Model/voice/test-mode separation prevents a fixture or a previous voice being replayed as the current one.
    const identity = JSON.stringify(['sprich-tts-v1', config.testMode, config.models.speech, config.naturalVoiceId, text]);
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(identity));
    const key = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
    const cached = await ctx.store.getTTS(key).catch(() => null);
    if (!active(task)) return null;
    if (cached?.size) return cached;
    const audio = await client.speech(text, { signal });
    if (!active(task)) return null;
    await ctx.store.putTTS(key, audio).catch(() => {}); // Storage pressure must not prevent playback.
    return audio;
  }

  function playAudio(task, blob, text, slow) {
    task.url = URL.createObjectURL(blob);
    const audio = makeAudio();
    task.audio = audio;
    audio.src = task.url;
    const rate = ctx.store.state.preferences.speechRate;
    audio.playbackRate = slow ? Math.min(.72, rate * .8) : rate;
    buttonLabel(task, 'Stop audio');
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = result => {
        if (settled) return;
        settled = true; clearTimeout(task.timer); task.finish = null; resolve(result);
      };
      const fail = () => {
        if (settled) return;
        settled = true; clearTimeout(task.timer); task.finish = null;
        reject(new Error('Natural voice could not play.'));
      };
      task.finish = finish;
      audio.onended = () => finish({ status: 'ended' });
      audio.onpause = () => { if (!audio.ended) finish({ status: 'cancelled' }); };
      audio.onerror = fail;
      task.timer = setTimeout(fail, Math.max(15_000, text.length * 250));
      try { void audio.play().catch(fail); } catch { fail(); }
    });
  }

  async function play(text, button, { slow = false } = {}) {
    if (current && button && current.button === button) { stop(); return { status: 'cancelled' }; }
    stop();
    if (disposed || ctx.signal?.aborted) return { status: 'cancelled' };
    const words = String(text ?? '').trim();
    if (!words) return { status: 'empty' };
    const task = { id: String(++sequence), button, original: button?.innerHTML, controller: new AbortController(), audio: null, url: '', finish: null, timer: null };
    current = task;
    pauseOtherAudio();
    try {
      if (ctx.store.state.preferences.aiVoice === 'natural') {
        buttonLabel(task, 'Cancel voice loading');
        try {
          const blob = await naturalAudio(task, words);
          if (!active(task)) return { status: 'cancelled' };
          return await playAudio(task, blob, words, slow);
        } catch (error) {
          releaseAudio(task);
          if (!active(task) || isCancelled(error)) return { status: 'cancelled' };
          ctx.notify('Natural voice is unavailable. Using your German device voice.');
        }
      }
      if (!active(task)) return { status: 'cancelled' };
      buttonLabel(task, 'Stop audio');
      return await ctx.speech.speak(words, { slow });
    } catch (error) {
      if (!active(task) || isCancelled(error)) return { status: 'cancelled' };
      ctx.error(error.message);
      return { status: 'error' };
    } finally {
      releaseAudio(task);
      restoreButton(task);
      if (current === task) current = null;
    }
  }

  ctx.signal?.addEventListener('abort', stop, { once: true });
  return { play, stop, dispose() { disposed = true; stop(); ctx.signal?.removeEventListener('abort', stop); } };
}
