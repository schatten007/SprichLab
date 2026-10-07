import { createRecorder } from './recorder.js';
import { createDictation } from './tts.js';
import { esc, icon, duration, downloadFile } from './ui.js';

export async function mountRecording(el, { draft, key, store, ctx, onChange, locked = false, beforeRecord = () => {}, maxMs = 180_000, onRecordingChange = () => {} }) {
  let alive = true;
  let audioUrl = null;
  let dictating = false;
  const guidance = maxMs <= 60_000 ? 'Up to 60 seconds. One short sentence is enough.' : 'Up to 3 minutes. You can listen back before saving.';
  el.innerHTML = `<div class="record-panel"><div class="record-heading"><span class="record-label">${icon('mic')} ${locked ? 'Your response' : 'Make room for your voice'}</span><output id="record-time" aria-label="Recording duration">${duration(draft.recordingMs)}</output></div>
    ${!locked ? `<div class="record-controls"><button class="btn" id="record-start">${icon('mic')}Record an answer</button><button class="btn danger" id="record-stop" hidden>${icon('stop')}Stop recording</button><span class="fine" id="record-status">${guidance}</span></div>` : ''}
    <div id="record-error" class="callout error" role="status" hidden></div><div id="audio-preview" class="audio-preview"></div>
    ${!locked ? `<label class="check-label aloud-check"><input type="checkbox" id="answered-aloud" ${draft.aloud ? 'checked' : ''}>I practised aloud (recording is optional)</label><details class="notes-details" ${draft.text ? 'open' : ''}><summary>Optional notes or transcript</summary><label for="response-text" class="fine">Write what you said, or keep a few key words. This does not automatically check your German.</label><textarea id="response-text" maxlength="6000" placeholder="Deine Notizen …" lang="de">${esc(draft.text)}</textarea><button class="text-button" id="dictate-note">${icon('mic')}Dictate a note</button><p class="fine">Dictation is separate from recording and may use your browser’s online speech service.</p></details>` : draft.text ? `<div class="saved-response" lang="de">${esc(draft.text)}</div>` : ''}
  </div>`;

  function showError(message) {
    if (!alive) return;
    const target = el.querySelector('#record-error');
    target.textContent = message;
    target.hidden = false;
  }
  function preview(blob) {
    if (!alive) return;
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    audioUrl = URL.createObjectURL(blob);
    const target = el.querySelector('#audio-preview');
    target.innerHTML = `<audio controls aria-label="Replay your recorded answer"></audio><button class="text-button" id="download-answer">${icon('download')}Download this recording</button>`;
    target.querySelector('audio').src = audioUrl;
    target.querySelector('audio').addEventListener('play', () => ctx.speech.stop());
    target.querySelector('#download-answer').addEventListener('click', () => downloadFile(blob, `sprich-answer-${new Date().toISOString().slice(0, 10)}.${blob.type.includes('mp4') ? 'm4a' : 'webm'}`));
  }

  const dictation = createDictation({
    onResult: text => {
      if (!alive || locked) return;
      draft.text = `${draft.text} ${text}`.trim().slice(0, 6000);
      el.querySelector('#response-text').value = draft.text;
      void onChange().catch(error => showError(error.message));
    },
    onState: active => {
      dictating = active;
      if (!alive || locked) return;
      el.querySelector('#dictate-note').innerHTML = `${icon(active ? 'stop' : 'mic')}${active ? 'Stop dictation' : 'Dictate a note'}`;
      el.querySelector('#record-start').disabled = active;
    },
    onError: showError,
  });
  const recorder = createRecorder({
    maxMs,
    onState: phase => {
      if (!alive || locked) return;
      const start = el.querySelector('#record-start');
      const stop = el.querySelector('#record-stop');
      start.hidden = phase === 'recording';
      start.disabled = phase !== 'idle' || dictating;
      stop.hidden = phase !== 'recording';
      stop.disabled = phase !== 'recording';
      el.querySelector('.record-panel').dataset.recording = String(phase === 'recording');
      el.querySelector('#dictate-note').disabled = phase !== 'idle';
      el.querySelector('#record-status').textContent = {
        idle: draft.recordingMs ? 'Recording saved locally. Replay it, then reflect below.' : guidance,
        requesting: 'Waiting for microphone permission…', recording: 'Recording… take your time.', saving: 'Saving your recording…',
      }[phase];
      onRecordingChange();
    },
    onTick: ms => { if (alive) { el.querySelector('#record-time').textContent = duration(ms); ctx.interact?.(); } },
    onComplete: async (blob, ms) => {
      await store.putRecording(key, blob);
      draft.recordingKey = key;
      draft.recordingMs = ms;
      draft.aloud = true;
      await onChange();
      if (alive) {
        el.querySelector('#record-time').textContent = duration(ms);
        el.querySelector('#answered-aloud').checked = true;
        preview(blob);
      }
    },
    onError: showError,
  });

  if (draft.recordingMs > 0) {
    try {
      const blob = await store.getRecording(draft.recordingKey || key);
      if (blob) preview(blob);
      else el.querySelector('#audio-preview').innerHTML = '<p class="fine">This recording is not stored on this device. You can make a new recording here, or use your saved notes.</p>';
    } catch (error) { showError(error.message); }
  }
  if (!locked) {
    el.querySelector('#record-start').addEventListener('click', async () => {
      if (recorder.phase !== 'idle') return;
      dictation.stop();
      ctx.speech.stop();
      document.querySelectorAll('audio').forEach(audio => audio.pause());
      el.querySelector('#record-error').hidden = true;
      beforeRecord();
      await recorder.start();
    });
    el.querySelector('#record-stop').addEventListener('click', () => { void recorder.stop(); });
    el.querySelector('#answered-aloud').addEventListener('change', event => { draft.aloud = event.target.checked; void onChange().catch(error => showError(error.message)); });
    el.querySelector('#response-text').addEventListener('input', event => { draft.text = event.target.value; void onChange().catch(error => showError(error.message)); });
    const dictateButton = el.querySelector('#dictate-note');
    dictateButton.hidden = !dictation.supported;
    dictateButton.addEventListener('click', () => {
      if (dictating) dictation.stop();
      else { ctx.speech.stop(); el.querySelector('#record-error').hidden = true; dictation.start(); }
    });
  }

  return {
    get recording() { return ['recording', 'requesting', 'saving'].includes(recorder.phase); },
    async stop() { dictation.stop(); await recorder.stop(); },
    async dispose() {
      alive = false;
      dictation.dispose();
      await recorder.dispose();
      el.querySelectorAll('audio').forEach(audio => audio.pause());
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    },
  };
}
