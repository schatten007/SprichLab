function speechError(message) { return new Error(message); }

export function germanVoices() {
  return (globalThis.speechSynthesis?.getVoices() ?? []).filter(voice => /^de(?:-|_)/i.test(voice.lang) || voice.lang === 'de');
}

async function waitForVoices() {
  if (germanVoices().length || !globalThis.speechSynthesis) return;
  await new Promise(resolve => {
    const synth = globalThis.speechSynthesis;
    const finish = () => { clearTimeout(timer); synth.removeEventListener('voiceschanged', finish); resolve(); };
    const timer = setTimeout(finish, 1500);
    synth.addEventListener('voiceschanged', finish, { once: true });
  });
}

/** A single cancellable playback owner prevents old views from speaking over a new task. */
export function createSpeechService(getPreferences) {
  let generation = 0;
  let finishCurrent = null;
  function stop() {
    generation++;
    finishCurrent?.({ status: 'cancelled' });
    globalThis.speechSynthesis?.cancel();
  }
  return {
    stop,
    async speak(text, { slow = false } = {}) {
      stop();
      const token = generation;
      const synth = globalThis.speechSynthesis;
      if (!synth || !globalThis.SpeechSynthesisUtterance) throw speechError('Read-aloud is unavailable in this browser. You can still record, replay, or use the reading alternative.');
      await waitForVoices();
      if (token !== generation) return { status: 'cancelled' };
      const voices = germanVoices();
      if (!voices.length) throw speechError('No German voice is available. Add German in your device’s speech/language settings, then reload. The reading alternative is available below.');
      const preferences = getPreferences();
      const voice = voices.find(item => item.voiceURI === preferences.voiceURI)
        ?? voices.find(item => item.localService && item.lang === 'de-DE')
        ?? voices.find(item => item.localService)
        ?? voices.find(item => item.lang === 'de-DE') ?? voices[0];
      if (!navigator.onLine && !voice.localService) throw speechError('This German voice needs an internet connection. Choose an installed device voice in Settings, or use the reading alternative.');
      return new Promise((resolve, reject) => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.voice = voice;
        utterance.lang = voice.lang;
        utterance.rate = slow ? Math.min(.72, preferences.speechRate * .8) : preferences.speechRate;
        let settled = false;
        const finish = result => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          finishCurrent = null;
          resolve(result);
        };
        const fail = message => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          finishCurrent = null;
          reject(speechError(message));
        };
        const timer = setTimeout(() => { fail('Playback did not finish. Try again or use the reading alternative.'); synth.cancel(); }, Math.max(15_000, text.length * 180));
        finishCurrent = finish;
        utterance.onend = () => finish({ status: 'ended' });
        utterance.onerror = event => {
          if (event.error === 'canceled' || event.error === 'interrupted') finish({ status: 'cancelled' });
          else fail('The German voice could not play. Try another voice in Settings or use the reading alternative.');
        };
        try { synth.speak(utterance); }
        catch { fail('Playback could not start. Tap Listen again, or use the reading alternative.'); }
      });
    },
  };
}

export function createDictation({ onResult, onState, onError }) {
  const Recognition = globalThis.SpeechRecognition ?? globalThis.webkitSpeechRecognition;
  let current = null;
  let disposed = false;
  function stop() { current?.abort(); current = null; onState?.(false); }
  return {
    supported: Boolean(Recognition),
    start() {
      if (!Recognition) { onError('Dictation is unavailable here. Record an answer or add a short note instead.'); return; }
      stop();
      const recognition = new Recognition();
      current = recognition;
      recognition.lang = 'de-DE';
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.onstart = () => { if (!disposed) onState?.(true); };
      recognition.onresult = event => {
        if (disposed || current !== recognition) return;
        const parts = [];
        for (let index = event.resultIndex; index < event.results.length; index++) {
          if (event.results[index].isFinal) parts.push(event.results[index][0].transcript);
        }
        if (parts.length) onResult(parts.join(' '));
      };
      recognition.onerror = event => {
        if (disposed || event.error === 'aborted') return;
        const messages = {
          'not-allowed': 'Microphone permission was denied. You can enable it in this site’s browser settings.',
          'audio-capture': 'No microphone is available. Check your device’s microphone settings.',
          'network': 'The browser’s online dictation service is unavailable. Recording and replay still work.',
          'no-speech': 'No speech was detected. Try again, or add your own note.',
          'language-not-supported': 'German dictation is unavailable on this device. Recording and replay still work.',
        };
        onError(messages[event.error] ?? 'Dictation could not finish. You can record or type a note instead.');
      };
      recognition.onend = () => { if (current === recognition) current = null; if (!disposed) onState?.(false); };
      try { recognition.start(); }
      catch { current = null; onState?.(false); onError('Dictation could not start. Try again after other microphone apps have stopped.'); }
    },
    stop,
    dispose() { disposed = true; stop(); },
  };
}
