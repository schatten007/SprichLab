const SERVICE = 'SprichLab';
const ACCOUNTS = {
  GROQ_API_KEY: 'audio/groq/api-key',
  GROQ_FREE_TIER_CONFIRMED: 'audio/groq/free-tier-confirmed',
  ELEVENLABS_API_KEY: 'audio/elevenlabs/api-key',
  ELEVENLABS_VOICE_ID: 'audio/elevenlabs/voice-id',
};
const PROVIDER_KEYS = {
  groq: ['GROQ_API_KEY', 'GROQ_FREE_TIER_CONFIRMED'],
  elevenlabs: ['ELEVENLABS_API_KEY', 'ELEVENLABS_VOICE_ID'],
};

function onlyAudioCredentials(values = {}) {
  return Object.fromEntries(Object.keys(ACCOUNTS)
    .filter(key => typeof values[key] === 'string' && values[key])
    .map(key => [key, values[key]]));
}

export function createAudioCredentialStore(keytar, { service = SERVICE } = {}) {
  if (!keytar || typeof keytar.getPassword !== 'function' || typeof keytar.setPassword !== 'function' || typeof keytar.deletePassword !== 'function') {
    throw new Error('The operating system keychain is unavailable.');
  }
  const account = key => ACCOUNTS[key];
  return {
    async read() {
      const entries = await Promise.all(Object.keys(ACCOUNTS).map(async key => [key, await keytar.getPassword(service, account(key))]));
      return onlyAudioCredentials(Object.fromEntries(entries));
    },
    async status() {
      const values = await this.read();
      return {
        groq: Boolean(values.GROQ_API_KEY && values.GROQ_FREE_TIER_CONFIRMED === 'true'),
        elevenlabs: Boolean(values.ELEVENLABS_API_KEY && values.ELEVENLABS_VOICE_ID),
      };
    },
    async write(values) {
      const credentials = onlyAudioCredentials(values);
      await Promise.all(Object.entries(credentials).map(([key, value]) => keytar.setPassword(service, account(key), value)));
      return this.read();
    },
    async remove(provider) {
      const keys = PROVIDER_KEYS[provider];
      if (!keys) throw new Error('Choose a supported audio provider.');
      await Promise.all(keys.map(key => keytar.deletePassword(service, account(key))));
      return this.status();
    },
  };
}

export async function loadAudioCredentialStore(options = {}) {
  try {
    const module = await import('@github/keytar');
    const keytar = module.default ?? module;
    const store = createAudioCredentialStore(keytar, options);
    await store.read();
    return { store, error: null };
  } catch (error) {
    return { store: null, error };
  }
}
