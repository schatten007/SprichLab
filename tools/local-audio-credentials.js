import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const AUDIO_KEYS = ['GROQ_API_KEY', 'GROQ_FREE_TIER_CONFIRMED', 'ELEVENLABS_API_KEY', 'ELEVENLABS_VOICE_ID'];

function onlyAudioCredentials(values = {}) {
  return Object.fromEntries(AUDIO_KEYS.filter(key => typeof values[key] === 'string' && values[key]).map(key => [key, values[key]]));
}

export async function readAudioCredentials(path) {
  try { return onlyAudioCredentials(JSON.parse(await readFile(path, 'utf8'))); }
  catch (error) { if (error.code === 'ENOENT') return {}; throw error; }
}

export async function writeAudioCredentials(path, values) {
  const credentials = onlyAudioCredentials(values);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(credentials, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  await chmod(path, 0o600);
  return credentials;
}
