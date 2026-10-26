export const AUDIO_PROVIDERS = {
  groq: {
    name: 'Groq',
    option: 'Groq — AI Talk replies and transcription',
    keyLabel: 'Groq API key',
    keyArticle: 'a',
    keyUrl: 'https://console.groq.com/keys',
    guideUrl: 'https://console.groq.com/docs/quickstart',
    guideLabel: 'Groq quickstart',
    description: 'Used for AI Talk replies, speech-to-text, and optional checks. Device speech and Gemini do not need it.',
    steps: 'Sign in, choose Create API Key, copy it once, and keep this app on the same computer as your local gateway.',
  },
  elevenlabs: {
    name: 'ElevenLabs',
    option: 'ElevenLabs — natural German voice',
    keyLabel: 'ElevenLabs API key',
    keyArticle: 'an',
    keyUrl: 'https://elevenlabs.io/app/settings/api-keys',
    guideUrl: 'https://help.elevenlabs.io/hc/en-us/articles/14599447207697-How-do-I-authorize-myself-using-an-API-key',
    guideLabel: 'ElevenLabs API-key guide',
    voiceUrl: 'https://elevenlabs.io/docs/overview/capabilities/voices',
    description: 'Used only for optional natural AI Talk speech. German device speech remains free and available without a key.',
    steps: 'Open Developers → API Keys, create a restricted key, copy it immediately, then choose a voice ID from your available voices.',
  },
};

export const audioProviderIds = Object.keys(AUDIO_PROVIDERS);
