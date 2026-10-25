import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readAudioCredentials, writeAudioCredentials } from '../tools/local-audio-credentials.js';

test('local audio credentials are restricted to the provider fields and written owner-only', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'sprich-audio-'));
  const file = join(directory, 'credentials.json');
  try {
    await writeAudioCredentials(file, {
      GROQ_API_KEY: 'gsk-local', GROQ_FREE_TIER_CONFIRMED: 'true',
      ELEVENLABS_API_KEY: 'eleven-local', ELEVENLABS_VOICE_ID: 'voice-local',
      SECRET_SHOULD_NOT_BE_SAVED: 'no',
    });
    assert.deepEqual(await readAudioCredentials(file), {
      GROQ_API_KEY: 'gsk-local', GROQ_FREE_TIER_CONFIRMED: 'true',
      ELEVENLABS_API_KEY: 'eleven-local', ELEVENLABS_VOICE_ID: 'voice-local',
    });
    assert.equal((await stat(file)).mode & 0o777, 0o600);
    assert.ok(!(await readFile(file, 'utf8')).includes('SECRET_SHOULD_NOT_BE_SAVED'));
  } finally { await rm(directory, { recursive: true, force: true }); }
});
