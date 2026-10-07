import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpeechService } from '../app/js/tts.js';

function speechFixture(t, preferences = { voiceURI: '', speechRate: .9 }) {
  const originals = new Map(['speechSynthesis', 'SpeechSynthesisUtterance', 'navigator'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const synth = new EventTarget();
  synth.voices = [{ lang: 'de-DE', voiceURI: 'German', localService: true }];
  synth.spoken = [];
  synth.getVoices = () => synth.voices;
  synth.speak = utterance => { synth.spoken.push(utterance); };
  synth.cancel = () => { synth.spoken.at(-1)?.onerror?.({ error: 'canceled' }); };
  Object.defineProperty(globalThis, 'speechSynthesis', { value: synth, configurable: true });
  Object.defineProperty(globalThis, 'SpeechSynthesisUtterance', { value: class { constructor(text) { this.text = text; } }, configurable: true });
  Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true });
  const speech = createSpeechService(() => preferences);
  t.after(() => {
    speech.stop();
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  return { synth, speech };
}

test('new playback cancels the previous promise and keeps the selected German voice', async t => {
  const { synth, speech } = speechFixture(t);
  const first = speech.speak('Guten Tag!');
  await new Promise(resolve => { setImmediate(resolve); });
  const second = speech.speak('Wie geht es Ihnen?');
  assert.equal((await first).status, 'cancelled');
  await new Promise(resolve => { setImmediate(resolve); });
  assert.equal(synth.spoken.at(-1).lang, 'de-DE');
  assert.equal(synth.spoken.at(-1).voice.voiceURI, 'German');
  synth.spoken.at(-1).onend();
  assert.equal((await second).status, 'ended');
});

test('leaving during voice loading prevents delayed audio from starting', async t => {
  const { synth, speech } = speechFixture(t);
  synth.voices = [];
  const pending = speech.speak('Nicht später abspielen.');
  speech.stop();
  synth.voices = [{ lang: 'de-DE', voiceURI: 'German', localService: true }];
  synth.dispatchEvent(new Event('voiceschanged'));
  assert.equal((await pending).status, 'cancelled');
  assert.equal(synth.spoken.length, 0);
});

test('automatic German speech prefers an installed voice and works offline', async t => {
  const { synth, speech } = speechFixture(t);
  synth.voices = [{ lang: 'de-DE', voiceURI: 'Online German', localService: false }, { lang: 'de-AT', voiceURI: 'Installed German', localService: true }];
  globalThis.navigator.onLine = false;
  const pending = speech.speak('Guten Tag!');
  await new Promise(resolve => { setImmediate(resolve); });
  assert.equal(synth.spoken.at(-1).voice.voiceURI, 'Installed German');
  assert.equal(synth.spoken.at(-1).lang, 'de-AT');
  synth.spoken.at(-1).onend();
  assert.equal((await pending).status, 'ended');
});

test('Slower stays slower even when the selected device rate is already 0.7', async t => {
  const { synth, speech } = speechFixture(t, { voiceURI: '', speechRate: .7 });
  const pending = speech.speak('Guten Tag!', { slow: true });
  await new Promise(resolve => { setImmediate(resolve); });
  assert.ok(synth.spoken.at(-1).rate < .7);
  synth.spoken.at(-1).onend();
  await pending;
});
