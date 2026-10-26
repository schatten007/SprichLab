import test from 'node:test';
import assert from 'node:assert/strict';
import { createAudioCredentialStore } from '../tools/local-audio-credentials.js';

function fakeKeytar() {
  const values = new Map();
  return {
    values,
    async getPassword(service, account) { return values.get(`${service}:${account}`) ?? null; },
    async setPassword(service, account, value) { values.set(`${service}:${account}`, value); },
    async deletePassword(service, account) { return values.delete(`${service}:${account}`); },
  };
}

test('audio credentials use the OS-keychain adapter and expose only safe provider status', async () => {
  const keytar = fakeKeytar();
  const store = createAudioCredentialStore(keytar, { service: 'sprich-test' });
  await store.write({
    GROQ_API_KEY: 'gsk-local', GROQ_FREE_TIER_CONFIRMED: 'true',
    ELEVENLABS_API_KEY: 'eleven-local', ELEVENLABS_VOICE_ID: 'voice-local',
    SECRET_SHOULD_NOT_BE_SAVED: 'no',
  });
  assert.deepEqual(await store.read(), {
    GROQ_API_KEY: 'gsk-local', GROQ_FREE_TIER_CONFIRMED: 'true',
    ELEVENLABS_API_KEY: 'eleven-local', ELEVENLABS_VOICE_ID: 'voice-local',
  });
  assert.deepEqual(await store.status(), { groq: true, elevenlabs: true });
  assert.equal(keytar.values.has('sprich-test:SECRET_SHOULD_NOT_BE_SAVED'), false);
  await store.remove('groq');
  assert.deepEqual(await store.read(), { ELEVENLABS_API_KEY: 'eleven-local', ELEVENLABS_VOICE_ID: 'voice-local' });
});
