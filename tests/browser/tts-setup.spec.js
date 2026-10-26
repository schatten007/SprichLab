import { test, expect } from '@playwright/test';
import { AITalkPage, observeSpeech } from './ai-talk-page.js';

test('natural voice can be selected, decoded, replayed slowly, stopped, and silenced before recording', async ({ page }) => {
  await observeSpeech(page);
  const app = new AITalkPage(page);
  const requests = [];
  page.on('request', request => { if (request.url().endsWith('/api/v1/speech')) requests.push(request); });
  await app.unlock();
  await app.chooseVoice('natural');
  await app.start();
  await page.getByRole('button', { name: 'Hear it again', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__ttsAudio[0]?.currentTime ?? 0)).toBeGreaterThan(0);
  expect(requests).toHaveLength(1);
  expect(requests[0].headers()['content-type']).toBe('application/json');
  expect(requests[0].postDataJSON()).toEqual({ text: 'Guten Tag! Stellen Sie sich bitte kurz vor.' });
  expect(await page.evaluate(() => window.__deviceSpeech)).toEqual([]);

  await page.getByRole('button', { name: 'Slower', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__ttsAudio[1]?.currentTime ?? 0)).toBeGreaterThan(0);
  const rates = await page.evaluate(() => window.__ttsAudio.map(audio => audio.playbackRate));
  expect(rates[1]).toBeLessThan(rates[0]);
  expect(requests).toHaveLength(1);
  await page.getByRole('button', { name: 'Stop audio', exact: true }).click();
  expect(await page.evaluate(() => window.__ttsAudio.every(audio => audio.paused && !audio.getAttribute('src')))).toBe(true);

  await page.getByRole('button', { name: 'Hear it again', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__ttsAudio[2]?.currentTime ?? 0)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Hold a short answer', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Stop', exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.__ttsAudio.every(audio => audio.paused))).toBe(true);
  await expect(page.getByRole('button', { name: 'Hear it again', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Slower', exact: true })).toBeDisabled();
  await expect(page.getByRole('status', { name: 'Recording duration' })).toHaveText(/^0:0[1-9]$/);
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Record again', exact: true })).toBeEnabled();
  expect(requests).toHaveLength(1);
});

test('local settings can save audio provider setup without keeping the key in the form', async ({ page }) => {
  const app = new AITalkPage(page);
  await app.unlock();
  await page.goto('/#settings');
  await expect(page.getByRole('heading', { name: 'Save your own audio key' })).toBeVisible();
  await page.getByLabel('Groq API key').fill('gsk-settings-test');
  await page.getByRole('checkbox', { name: /I am using Groq’s Free plan/ }).check();
  await page.getByRole('button', { name: 'Save this provider key', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Groq key saved in this computer’s OS keychain' })).toBeVisible();
  await expect(page.getByLabel('Groq API key')).toHaveValue('');
});

test('AI Talk clearly points to the in-app audio API key setup', async ({ page }) => {
  await page.goto('/#ai');
  await expect(page.getByRole('link', { name: 'Set up audio API keys', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Set up audio API keys', exact: true }).click();
  await expect(page).toHaveURL(/#settings$/);
  await expect(page.getByRole('heading', { name: 'Save your own audio key' })).toBeVisible();
  await expect(page.getByLabel('API key')).toBeVisible();
  await expect(page.locator('#audio-api-access').getByRole('link', { name: 'AI Talk', exact: true })).toBeVisible();
});

test('audio API setup is a visible provider form with official key instructions', async ({ page }) => {
  await page.goto('/#settings');
  await expect(page.getByRole('heading', { name: 'Save your own audio key' })).toBeVisible();
  await expect(page.getByLabel('Which audio service do you want to connect?')).toBeVisible();
  await expect(page.getByLabel('API key')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Get a Groq API key', exact: true })).toHaveAttribute('href', 'https://console.groq.com/keys');
  await expect(page.getByRole('button', { name: 'Save this provider key', exact: true })).toBeVisible();
  await page.getByLabel('Which audio service do you want to connect?').selectOption('elevenlabs');
  await expect(page.getByRole('link', { name: 'Get an ElevenLabs API key', exact: true })).toHaveAttribute('href', 'https://elevenlabs.io/app/settings/api-keys');
  await expect(page.getByLabel('ElevenLabs voice ID')).toBeVisible();
});

test('device voice is the account-free default and replay reads the most recent simplified question', async ({ page }) => {
  await observeSpeech(page);
  const app = new AITalkPage(page);
  const apiCalls = [];
  page.on('request', request => { if (request.url().includes('/api/')) apiCalls.push(request.url()); });
  await page.goto('/#settings');
  await expect(page.getByRole('combobox', { name: /^AI Talk voice/ })).toHaveValue('device');
  await page.getByRole('button', { name: 'Test AI Talk voice', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__deviceSpeech.length)).toBe(1);
  expect(apiCalls.filter(url => !url.endsWith('/status'))).toEqual([]);
  await app.unlock();
  await app.start();
  await page.getByRole('button', { name: 'Ask it more simply', exact: true }).click();
  await expect(page.getByRole('log')).toContainText('An welchen Tagen haben Sie Zeit?');
  await page.getByRole('button', { name: 'Hear it again', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__deviceSpeech.at(-1)?.text)).toBe('An welchen Tagen haben Sie Zeit?');
  expect(apiCalls.some(url => url.endsWith('/speech'))).toBe(false);
});

test('Gemini Companion is available while setup is loading and a missing gateway has a working retry', async ({ page }) => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let attempts = 0;
  await page.route('**/api/v1/status', async route => {
    if (++attempts === 1) {
      await gate;
      await route.fulfill({ status: 200, contentType: 'text/html', body: '<html>A static host without an API</html>' });
    } else await route.continue();
  });
  try {
    await new AITalkPage(page).open();
    await expect(page.getByRole('heading', { name: 'Gemini Companion on your phone' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Copy practice pack' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Start conversation', exact: true })).toBeDisabled();
    release();
    await expect(page.getByRole('heading', { name: 'AI gateway unavailable' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Set up audio API keys', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Check connection again', exact: true }).click();
    await expect(page.getByLabel('Owner access code')).toBeEnabled();
    await expect(page.getByText('Test provider · no real AI', { exact: true })).toBeVisible();
  } finally { release(); }
});

test('an unconfigured provider is never labelled connected or allowed to start a conversation', async ({ page }) => {
  await page.route('**/api/v1/status', route => route.fulfill({ json: { data: {
    configured: true, authenticated: false, groqReady: false, naturalVoiceConfigured: false, testMode: false,
    missing: ['Groq API key', 'owner confirmation of the Groq Free plan'],
  }, meta: { apiVersion: 'v1' } } }));
  await new AITalkPage(page).open();
  await expect(page.getByText('Groq setup incomplete', { exact: true })).toBeVisible();
  await expect(page.getByText('Connected provider', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Start conversation', exact: true })).toBeDisabled();
  await expect(page.getByLabel('Owner access code')).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
});

test('a rejected capability check shows the setup error instead of losing its message', async ({ page }) => {
  const app = new AITalkPage(page);
  await app.unlock();
  await page.route('**/api/v1/capabilities', route => route.fulfill({ status: 503, json: {
    code: 'provider_credentials', detail: 'Check the Groq key in the gateway settings.',
  } }));
  await page.getByRole('button', { name: 'Check models', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Check the Groq key in the gateway settings.');
});

test('a refused or exhausted natural-voice allowance falls back to German device speech', async ({ page }) => {
  await observeSpeech(page);
  const app = new AITalkPage(page);
  await app.unlock();
  await app.chooseVoice('natural');
  await app.start();
  let calls = 0;
  await page.route('**/api/v1/speech', route => {
    calls++;
    return route.fulfill({ status: calls === 1 ? 409 : 429, json: {
      code: calls === 1 ? 'speech_not_free' : 'speech_quota', detail: 'Use device speech.',
    } });
  });
  for (let count = 1; count <= 2; count++) {
    await page.getByRole('button', { name: 'Hear it again', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.__deviceSpeech.length)).toBe(count);
  }
  expect(calls).toBe(2);
  expect(await page.evaluate(() => window.__ttsAudio.length)).toBe(0);
  await expect(page.getByRole('status').filter({ hasText: 'Using your German device voice.' })).toBeVisible();
});

test('leaving during natural-voice generation prevents delayed audio and fallback on the next page', async ({ page }) => {
  await observeSpeech(page);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const app = new AITalkPage(page);
  await app.unlock();
  await app.chooseVoice('natural');
  await app.start();
  let release; let begin; let finish;
  const gate = new Promise(resolve => { release = resolve; });
  const began = new Promise(resolve => { begin = resolve; });
  const finished = new Promise(resolve => { finish = resolve; });
  await page.route('**/api/v1/speech', async route => {
    const response = await route.fetch();
    begin();
    await gate;
    try { await route.fulfill({ response }); } catch { /* The view intentionally aborted this request. */ }
    finally { finish(); }
  });
  try {
    await page.getByRole('button', { name: 'Hear it again', exact: true }).click();
    await began;
    await expect(page.getByRole('button', { name: 'Cancel voice loading', exact: true })).toBeEnabled();
    await page.getByRole('link', { name: 'Today', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'A little more confident, every day.' })).toBeVisible();
    release();
    await finished;
    expect(await page.evaluate(() => ({ audio: window.__ttsAudio.length, device: window.__deviceSpeech.length }))).toEqual({ audio: 0, device: 0 });
    expect(errors).toEqual([]);
  } finally { release(); }
});
