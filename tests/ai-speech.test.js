import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createAISpeech } from '../app/js/ai-speech.js';
import { GatewayError } from '../app/js/ai-gateway.js';
import { createStore } from '../app/js/store.js';

const TEXT = 'An welchen Tagen können Sie arbeiten?';
const AUDIO = new Blob(['fixture audio'], { type: 'audio/mpeg' });
const button = () => ({ isConnected: true, innerHTML: 'Hear it again', dataset: {} });

async function fixture(t, mode = 'natural') {
  const store = await createStore({ name: `tts-${crypto.randomUUID()}` });
  await store.update(state => { state.preferences.aiVoice = mode; });
  const controller = new AbortController();
  const device = []; const notices = []; const errors = []; const audio = []; const awaitingAudio = [];
  const calls = { status: 0, speech: 0 };
  const config = { configured: true, authenticated: true, naturalVoiceConfigured: true, naturalVoiceId: 'voice-one', testMode: true, models: { speech: 'eleven_multilingual_v2' } };
  const client = {
    async status() { calls.status++; return structuredClone(config); },
    async speech() { calls.speech++; return AUDIO; },
  };
  const ctx = { store, signal: controller.signal, notify: message => notices.push(message), error: message => errors.push(message),
    speech: { stop() {}, async speak(text, options) { device.push({ text, ...options }); return { status: 'ended' }; } } };
  const players = [];
  const makePlayer = () => {
    const player = createAISpeech(ctx, client, { pauseOtherAudio() {}, makeAudio() {
      const element = { src: '', paused: true, ended: false, playbackRate: 1,
        async play() { this.paused = false; },
        pause() { this.paused = true; this.onpause?.(); },
        removeAttribute(name) { if (name === 'src') this.src = ''; },
      };
      audio.push(element);
      awaitingAudio.shift()?.(element);
      return element;
    } });
    players.push(player);
    return player;
  };
  const player = makePlayer();
  t.after(() => { players.forEach(item => item.dispose()); store.close(); });
  return { store, ctx, client, config, player, makePlayer, controller, device, notices, errors, audio, calls,
    nextAudio: () => new Promise(resolve => { awaitingAudio.push(resolve); }) };
}

test('default device speech makes no gateway calls and honours the slower option', async t => {
  const f = await fixture(t, 'device');
  assert.equal((await f.player.play(TEXT, button(), { slow: true })).status, 'ended');
  assert.deepEqual(f.device, [{ text: TEXT, slow: true }]);
  assert.deepEqual(f.calls, { status: 0, speech: 0 });
  assert.equal(f.audio.length, 0);
});

test('natural speech is cached in IndexedDB and slower replay uses the same audio without synthesis', async t => {
  const f = await fixture(t);
  const ready = f.nextAudio();
  const first = f.player.play(TEXT, button());
  const normal = await ready;
  assert.equal(normal.playbackRate, f.store.state.preferences.speechRate);
  normal.onended();
  assert.equal((await first).status, 'ended');
  assert.equal(normal.src, '', 'finished object URLs are released');

  f.player.dispose();
  const reopened = f.makePlayer();
  const nextReady = f.nextAudio();
  const second = reopened.play(TEXT, button(), { slow: true });
  const slow = await nextReady;
  assert.ok(slow.playbackRate < normal.playbackRate);
  slow.onended();
  assert.equal((await second).status, 'ended');
  assert.equal(f.calls.speech, 1, 'a replay after reopening uses the persisted cache');
  assert.equal(f.device.length, 0);
  assert.equal((await f.store.export()).includes('fixture audio'), false);
});

test('Stop audio is a working toggle and releases the audio and button immediately', async t => {
  const f = await fixture(t);
  const control = button();
  const ready = f.nextAudio();
  const playing = f.player.play(TEXT, control);
  const audio = await ready;
  assert.match(control.innerHTML, /Stop audio/);
  assert.equal((await f.player.play(TEXT, control)).status, 'cancelled');
  assert.equal((await playing).status, 'cancelled');
  assert.equal(audio.paused, true);
  assert.equal(audio.src, '');
  assert.equal(control.innerHTML, 'Hear it again');
  assert.equal(control.dataset.playing, undefined);
  assert.equal(f.calls.speech, 1);
});

test('a newer playback cancels the old one without letting its cleanup overwrite the new button', async t => {
  const f = await fixture(t);
  const firstReady = f.nextAudio();
  const firstButton = button();
  const first = f.player.play(TEXT, firstButton);
  const oldAudio = await firstReady;
  const secondReady = f.nextAudio();
  const secondButton = button();
  const second = f.player.play('Wie viele Stunden haben Sie Zeit?', secondButton);
  assert.equal((await first).status, 'cancelled');
  const newAudio = await secondReady;
  assert.equal(oldAudio.paused, true);
  assert.equal(firstButton.innerHTML, 'Hear it again');
  assert.match(secondButton.innerHTML, /Stop audio/);
  newAudio.onended();
  assert.equal((await second).status, 'ended');
});

test('cancelling generation suppresses late audio and device fallback even when a provider ignores abort', async t => {
  const f = await fixture(t);
  let release; let began;
  const started = new Promise(resolve => { began = resolve; });
  let signal;
  f.client.speech = async (_text, options) => { signal = options.signal; began(); return new Promise(resolve => { release = resolve; }); };
  const control = button();
  const pending = f.player.play(TEXT, control);
  await started;
  f.controller.abort();
  assert.equal(signal.aborted, true);
  assert.equal(control.innerHTML, 'Hear it again');
  release(AUDIO);
  assert.equal((await pending).status, 'cancelled');
  assert.equal(f.audio.length, 0);
  assert.equal(f.device.length, 0);
  assert.equal(f.notices.length, 0);
});

test('a configured voice falls back once on free-tier refusal, quota, credentials, or network errors', async t => {
  const f = await fixture(t);
  for (const code of ['speech_not_free', 'speech_quota', 'provider_credentials', 'network']) {
    f.client.speech = async () => { throw new GatewayError('Fixture refusal', { code }); };
    assert.equal((await f.player.play(TEXT, button())).status, 'ended');
  }
  assert.equal(f.device.length, 4);
  assert.equal(f.notices.length, 4);
  assert.equal(f.audio.length, 0);
  assert.deepEqual(f.errors, []);
});

test('missing setup and replies over the natural-voice limit use device speech without a synthesis call', async t => {
  const f = await fixture(t);
  f.config.naturalVoiceConfigured = false;
  await f.player.play(TEXT, button());
  await f.player.play('x'.repeat(801), button());
  assert.equal(f.calls.speech, 0);
  assert.equal(f.device.length, 2);
});

test('audio decoding failure falls back only once and a missing German voice remains an actionable error', async t => {
  const f = await fixture(t);
  const ready = f.nextAudio();
  const pending = f.player.play(TEXT, button());
  const audio = await ready;
  const failed = audio.onerror;
  failed(); failed();
  assert.equal((await pending).status, 'ended');
  assert.equal(f.device.length, 1);
  assert.equal(f.notices.length, 1);
  assert.equal(audio.src, '');

  await f.store.update(state => { state.preferences.aiVoice = 'device'; });
  f.ctx.speech.speak = async () => { throw new Error('Add a German voice in device settings.'); };
  assert.equal((await f.player.play(TEXT, button())).status, 'error');
  assert.deepEqual(f.errors, ['Add a German voice in device settings.']);
});

test('cached speech is separated by voice, model, and test mode', async t => {
  const f = await fixture(t);
  for (const change of [{}, { naturalVoiceId: 'voice-two' }, { models: { speech: 'another-model' } }, { testMode: false }]) {
    Object.assign(f.config, change);
    const player = f.makePlayer();
    const ready = f.nextAudio();
    const pending = player.play(TEXT, button());
    const audio = await ready;
    audio.onended();
    await pending;
    player.dispose();
  }
  assert.equal(f.calls.speech, 4);
});

test('cache read/write failures do not prevent a valid voice response from playing', async t => {
  const f = await fixture(t);
  f.store.getTTS = async () => { throw new Error('Storage unavailable'); };
  f.store.putTTS = async () => { throw new Error('Storage full'); };
  const ready = f.nextAudio();
  const pending = f.player.play(TEXT, button());
  const audio = await ready;
  audio.onended();
  assert.equal((await pending).status, 'ended');
  assert.equal(f.device.length, 0);
});

test('generated-audio cache entries expire and Remove saved audio clears the cache', async t => {
  let now = 1_700_000_000_000;
  const store = await createStore({ name: `tts-expiry-${crypto.randomUUID()}`, now: () => now });
  t.after(() => store.close());
  await store.putTTS('voice-cache', AUDIO);
  assert.equal(await (await store.getTTS('voice-cache')).text(), await AUDIO.text());
  now += 30 * 86_400_000;
  assert.equal(await store.getTTS('voice-cache'), null);
  await store.putTTS('voice-cache', AUDIO);
  await store.deleteRecordings();
  assert.equal(await store.getTTS('voice-cache'), null);
});
