const MAX_MS = 180_000;

export function createRecorder({ onState, onTick, onComplete, onError, maxMs = MAX_MS }) {
  const limit = Math.min(MAX_MS, Math.max(1000, maxMs));
  let stream = null;
  let recorder = null;
  let chunks = [];
  let timer = null;
  let startedAt = 0;
  let stoppingAt = 0;
  let token = 0;
  let phase = 'idle';
  let finished = Promise.resolve();
  let resolveFinished = null;

  function state(value) { phase = value; onState?.(value); }
  function release() { clearInterval(timer); stream?.getTracks().forEach(track => track.stop()); stream = null; }
  function message(error) {
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError') return 'Microphone access was denied. Enable it in this site’s browser settings, or practise aloud without recording.';
    if (error.name === 'NotFoundError') return 'No microphone was found. Connect one, or practise aloud without recording.';
    if (error.name === 'NotReadableError') return 'The microphone is busy. Close other microphone apps and try again.';
    return 'Recording could not start. You can still practise aloud and use the self-assessment.';
  }

  const api = {
    get phase() { return phase; },
    supported: Boolean(globalThis.MediaRecorder && globalThis.navigator?.mediaDevices?.getUserMedia),
    async start() {
      if (phase !== 'idle') return;
      if (!api.supported) {
        onError(globalThis.isSecureContext ? 'Recording is unavailable in this browser. Practise aloud or use a current Chrome browser.' : 'Microphone recording needs HTTPS or localhost. Use the hosted HTTPS app on your phone.');
        return;
      }
      const generation = ++token;
      state('requesting');
      try {
        const acquired = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
        if (generation !== token) { acquired.getTracks().forEach(track => track.stop()); return; }
        stream = acquired;
        const mimeType = ['audio/webm;codecs=opus', 'audio/mp4'].find(type => MediaRecorder.isTypeSupported(type));
        recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        chunks = [];
        startedAt = performance.now();
        stoppingAt = 0;
        finished = new Promise(resolve => { resolveFinished = resolve; });
        recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
        recorder.onerror = () => { onError('The recording was interrupted. Please try again.'); void api.stop(); };
        recorder.onstop = async () => {
          release();
          state('saving');
          const duration = Math.min(limit, Math.max(0, Math.round((stoppingAt || performance.now()) - startedAt)));
          const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
          try {
            if (blob.size > 0 && duration >= 300) await onComplete(blob, duration);
            else onError('That recording was too short to keep. Try speaking for a few seconds.');
          } catch (error) { onError(`The recording could not be saved. ${error.message}`); }
          finally { state('idle'); resolveFinished?.(); resolveFinished = null; }
        };
        recorder.start(1000);
        state('recording');
        timer = setInterval(() => {
          const duration = Math.min(limit, performance.now() - startedAt);
          onTick?.(duration);
          if (duration >= limit) void api.stop();
        }, 200);
      } catch (error) {
        release();
        if (generation === token) { state('idle'); onError(message(error)); }
      }
    },
    async stop() {
      if (phase === 'requesting') { token++; state('idle'); return; }
      if (phase === 'recording' && recorder?.state !== 'inactive') {
        stoppingAt = performance.now();
        clearInterval(timer);
        state('saving');
        recorder.stop();
      }
      await finished;
    },
    async dispose() { token++; await api.stop(); release(); },
  };
  return api;
}
