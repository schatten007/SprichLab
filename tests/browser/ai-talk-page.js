import { expect } from '@playwright/test';
import { TEST_ACCESS_CODE } from '../../tools/mock-ai-provider.js';

export class AITalkPage {
  constructor(page) { this.page = page; }
  async open() {
    await this.page.goto('/#ai');
    await expect(this.page.getByRole('heading', { name: 'A private German conversation that waits for you.' })).toBeVisible();
  }
  async unlock() {
    await this.open();
    await this.page.getByLabel('Owner access code').fill(TEST_ACCESS_CODE);
    await this.page.getByRole('button', { name: 'Unlock AI Talk', exact: true }).click();
    await expect(this.page.getByText('Unlocked', { exact: true })).toBeVisible();
  }
  async chooseVoice(mode) {
    await this.page.goto('/#settings');
    await this.page.getByRole('combobox', { name: /^AI Talk voice/ }).selectOption(mode);
    await this.page.getByRole('button', { name: 'Save preferences' }).click();
    await expect(this.page.getByRole('status').filter({ hasText: 'Preferences saved.' })).toBeVisible();
  }
  async start() {
    await this.open();
    await this.page.getByRole('button', { name: 'Start conversation', exact: true }).click();
    await expect(this.page).toHaveURL(/#ai\/session\//);
    await expect(this.page.getByRole('log')).toBeVisible();
  }
}

// Device speech is a deterministic test double. Generated WAV still goes through the real browser audio decoder.
export async function observeSpeech(page) {
  await page.addInitScript(() => {
    window.__ttsAudio = [];
    window.__deviceSpeech = [];
    const NativeAudio = window.Audio;
    window.Audio = function (...args) {
      const audio = new NativeAudio(...args);
      audio.loop = true; // Keep the short fixture playing until the user chooses Stop.
      window.__ttsAudio.push(audio);
      return audio;
    };
    window.Audio.prototype = NativeAudio.prototype;
    const synth = new EventTarget();
    synth.getVoices = () => [{ lang: 'de-DE', voiceURI: 'Test German', name: 'Test German', localService: true }];
    synth.speak = utterance => {
      window.__deviceSpeech.push({ text: utterance.text, rate: utterance.rate, lang: utterance.lang });
      void Promise.resolve().then(() => utterance.onend?.());
    };
    synth.cancel = () => {};
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: synth });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: class { constructor(text) { this.text = text; } } });
  });
}
