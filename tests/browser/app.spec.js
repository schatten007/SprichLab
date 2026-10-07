import { test, expect } from '@playwright/test';
import { PracticePage } from './practice-page.js';

test('navigation, mobile layout, and dark appearance remain usable', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const app = new PracticePage(page);
  await app.open();
  await page.screenshot({ path: testInfo.outputPath('today.png'), fullPage: true });
  for (const [route, heading] of [
    ['practice', 'A conversation worth having.'], ['phrases', 'Your conversation toolkit.'],
    ['progress', 'Notice what is getting easier.'], ['resources', 'Listen, notice, then use it.'], ['settings', 'Make it fit your life.'],
  ]) {
    await page.goto(`/#${route}`);
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  }
  await page.getByLabel('Appearance').selectOption('dark');
  await page.getByRole('button', { name: 'Save preferences' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.goto('/#today');
  await expect(page.getByRole('button', { name: 'Start this mission' })).toBeVisible();
  const contrast = await page.getByRole('button', { name: 'Start this mission' }).evaluate(button => {
    const style = getComputedStyle(button);
    const luminance = color => {
      const [r, g, b] = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
      return .2126 * r + .7152 * g + .0722 * b;
    };
    const values = [luminance(style.color), luminance(style.backgroundColor)].sort((a, b) => b - a);
    return (values[0] + .05) / (values[1] + .05);
  });
  expect(contrast).toBeGreaterThanOrEqual(4.5);
  await page.screenshot({ path: testInfo.outputPath('today-dark.png'), fullPage: true });
  expect(errors).toEqual([]);
});

test('a complete short mission records real attempts rather than planned minutes', async ({ page }, testInfo) => {
  const app = new PracticePage(page);
  await app.open();
  await app.chooseShortGoal();
  const startedAt = Date.now();
  await page.getByRole('button', { name: 'Start this mission' }).click();
  await page.getByRole('button', { name: 'Begin with listening' }).click();
  await page.getByRole('button', { name: 'Use the reading alternative / show transcript' }).click();
  await page.getByRole('radio', { name: 'Sechzehn', exact: true }).check();
  await page.getByRole('radio', { name: 'Ab November', exact: true }).check();
  await page.getByRole('radio', { name: 'Montag und Donnerstag', exact: true }).check();
  await page.getByRole('button', { name: 'Check understanding' }).evaluate(button => { button.click(); button.click(); button.click(); });
  await expect(page.getByText('3 of 3 answers correct.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  for (let index = 0; index < 2; index++) {
    await expect(page.getByRole('heading', { name: 'Can you find the words?' })).toBeVisible();
    await page.getByRole('checkbox', { name: 'I practised aloud (recording is optional)' }).check();
    await page.getByRole('button', { name: 'Show model & rate my recall' }).click();
    await page.getByRole('button', { name: 'Recalled independently' }).click();
    await page.getByRole('button', { name: 'Next phrase / step' }).click();
  }
  await app.markSpokenAndReflect();
  await page.getByRole('button', { name: 'Answered independently', exact: true }).click();
  await page.getByRole('button', { name: 'Next question' }).click();
  await app.markSpokenAndReflect();
  await page.getByRole('radio', { name: 'Ich habe meine verfügbaren Zeiten genannt.' }).check();
  await page.getByRole('button', { name: 'Answered independently', exact: true }).click();
  await page.getByRole('button', { name: 'Next question' }).click();
  await app.markSpokenAndReflect();
  await page.getByRole('button', { name: 'Answered independently', exact: true }).click();
  await page.getByRole('button', { name: 'Reflect on this session' }).click();
  await expect(page.getByRole('heading', { name: 'A real step forward.' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('session-summary.png'), fullPage: true });
  await page.getByRole('button', { name: 'Finish session' }).click();
  await expect(page.getByRole('heading', { name: 'A little more confident, every day.' })).toBeVisible();
  const state = await app.readState();
  expect(state.sessions.filter(session => session.completedAt)).toHaveLength(1);
  expect(state.attempts).toHaveLength(8);
  expect(new Set(state.attempts.map(attempt => attempt.id)).size).toBe(8);
  expect(state.attempts.reduce((sum, attempt) => sum + attempt.recordingMs, 0)).toBe(0);
  expect(state.activity.reduce((sum, activity) => sum + activity.ms, 0)).toBeLessThanOrEqual(Date.now() - startedAt + 2000);
  expect(state.activity.reduce((sum, activity) => sum + activity.ms, 0)).toBeLessThan(15 * 60_000);
  expect(state.attempts.filter(attempt => attempt.kind === 'listening').every(attempt => attempt.hintUsed)).toBe(true);
});

test('the default mission includes genuine recall, shadowing, and the full conversation', async ({ page }) => {
  const app = new PracticePage(page);
  await app.open();
  await page.getByRole('button', { name: 'Start this mission' }).click();
  await page.getByRole('button', { name: 'Begin with listening' }).click();
  await page.getByRole('button', { name: 'Use the reading alternative / show transcript' }).click();
  await page.getByRole('radio', { name: 'Sechzehn', exact: true }).check();
  await page.getByRole('radio', { name: 'Ab November', exact: true }).check();
  await page.getByRole('radio', { name: 'Montag und Donnerstag', exact: true }).check();
  await page.getByRole('button', { name: 'Check understanding' }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  for (let index = 0; index < 6; index++) {
    await page.getByRole('button', { name: 'Show model & rate my recall' }).click();
    await expect(page.getByRole('button', { name: 'Recalled independently' })).toBeDisabled();
    await page.getByRole('button', { name: 'Again', exact: true }).click();
    await page.getByRole('button', { name: 'Next phrase / step' }).click();
  }
  await expect(page.getByRole('heading', { name: 'Borrow the rhythm.' })).toBeVisible();
  await page.getByRole('checkbox', { name: 'I practised aloud (recording is optional)' }).check();
  await page.getByRole('button', { name: 'I repeated the line' }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  for (let index = 0; index < 7; index++) {
    await app.markSpokenAndReflect();
    const intent = page.getByRole('radio', { name: 'Ich habe nach den benötigten Stunden gefragt.' });
    if (await intent.count()) await intent.check();
    await page.getByRole('button', { name: 'Answered independently', exact: true }).click();
    await page.getByRole('button', { name: index === 6 ? 'Reflect on this session' : 'Next question' }).click();
  }
  await page.getByRole('button', { name: 'Finish session' }).click();
  await expect(page.getByRole('heading', { name: 'A little more confident, every day.' })).toBeVisible();
  const state = await app.readState();
  expect(state.attempts).toHaveLength(17);
  expect(state.attempts.filter(attempt => attempt.kind === 'recall').every(attempt => attempt.outcome === 'again')).toBe(true);
  expect(state.attempts.find(attempt => attempt.kind === 'shadow').outcome).toBe('unscored');
  expect(state.sessions[0].completedAt).not.toBeNull();
});

test('drafts resume after reload and the next question respects the selected intent', async ({ page }) => {
  const app = new PracticePage(page);
  await app.seedTask('availability');
  await page.getByText('Optional notes or transcript', { exact: true }).click();
  await page.getByLabel('Write what you said, or keep a few key words.', { exact: false }).fill('Welche Arbeitszeiten sind für das Team wichtig?');
  await page.getByRole('radio', { name: 'Ich habe nach den benötigten Stunden gefragt.' }).check();
  await page.getByRole('checkbox', { name: 'I practised aloud (recording is optional)' }).check();
  await expect.poll(async () => (await app.readState()).sessions[0].drafts.availability?.text).toBe('Welche Arbeitszeiten sind für das Team wichtig?');
  await page.reload();
  await expect(page.getByLabel('Write what you said, or keep a few key words.', { exact: false })).toHaveValue('Welche Arbeitszeiten sind für das Team wichtig?');
  await expect(page.getByRole('radio', { name: 'Ich habe nach den benötigten Stunden gefragt.' })).toBeChecked();
  await app.markSpokenAndReflect();
  await page.getByRole('button', { name: 'Answered independently', exact: true }).click();
  await page.getByRole('button', { name: 'Next question' }).click();
  await expect(page.getByText('Wir suchen jemanden für zwölf bis sechzehn Stunden pro Woche. Wäre das für Sie möglich?', { exact: true })).toBeVisible();
});

test('a just-typed draft survives an immediate reload', async ({ page }) => {
  const app = new PracticePage(page);
  await app.seedTask();
  await page.getByText('Optional notes or transcript', { exact: true }).click();
  await page.getByLabel('Write what you said, or keep a few key words.', { exact: false }).fill('Ich studiere und suche einen Werkstudentenjob.');
  await page.reload();
  await expect(page.getByLabel('Write what you said, or keep a few key words.', { exact: false })).toHaveValue('Ich studiere und suche einen Werkstudentenjob.');
});

test('a model hint prevents an independent spoken grade', async ({ page }) => {
  const app = new PracticePage(page);
  await app.seedTask();
  await page.getByRole('button', { name: 'I’m stuck — show a hint and model' }).click();
  await app.markSpokenAndReflect();
  await expect(page.getByRole('button', { name: 'Answered independently', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Needed help', exact: true }).click();
  const state = await app.readState();
  expect(state.attempts[0].hintUsed).toBe(true);
  expect(state.attempts[0].outcome).toBe('helped');
});

test('microphone denial has a usable spoken-practice fallback', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('Denied for test', 'NotAllowedError'); };
  });
  const app = new PracticePage(page);
  await app.seedTask();
  await page.getByRole('button', { name: 'Record an answer' }).click();
  await expect(page.getByText('Microphone access was denied.', { exact: false })).toBeVisible();
  await app.markSpokenAndReflect();
  await page.getByRole('button', { name: 'Answered independently', exact: true }).click();
  const state = await app.readState();
  expect(state.attempts[0].recordingMs).toBe(0);
  expect(state.attempts[0].inputMode).toBe('aloud');
});

test('real MediaRecorder capture is replayable and stops all microphone tracks', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    window.capturedTracks = [];
    const capture = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async options => {
      const stream = await capture(options);
      window.capturedTracks.push(...stream.getTracks());
      return stream;
    };
  });
  const app = new PracticePage(page);
  await app.seedTask();
  await page.getByRole('button', { name: 'Record an answer' }).click();
  await expect(page.getByRole('button', { name: 'Stop recording', exact: true })).toBeVisible();
  await expect(page.getByLabel('Recording duration')).not.toHaveText('0:00');
  await page.getByRole('button', { name: 'Stop recording', exact: true }).click();
  await expect(page.getByLabel('Replay your recorded answer')).toHaveAttribute('src', /^blob:/);
  expect(await page.evaluate(() => window.capturedTracks.length > 0 && window.capturedTracks.every(track => track.readyState === 'ended'))).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('speaking.png'), fullPage: true });
  await app.markSpokenAndReflect();
  await page.getByRole('button', { name: 'Answered independently', exact: true }).click();
  await page.reload();
  await expect(page.getByLabel('Replay your recorded answer')).toHaveAttribute('src', /^blob:/);
  const state = await app.readState();
  expect(state.attempts[0].recordingMs).toBeGreaterThan(900);
  expect(state.attempts[0].recordingMs).toBeLessThan(10_000);
  expect(state.attempts[0].inputMode).toBe('recording');
});

test('leaving a recording saves its draft and releases the microphone', async ({ page }) => {
  await page.addInitScript(() => {
    window.capturedTracks = [];
    const capture = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async options => {
      const stream = await capture(options);
      window.capturedTracks.push(...stream.getTracks());
      return stream;
    };
  });
  const app = new PracticePage(page);
  await app.seedTask();
  await page.getByRole('button', { name: 'Record an answer' }).click();
  await expect(page.getByLabel('Recording duration')).not.toHaveText('0:00');
  await page.getByRole('link', { name: 'Progress', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Notice what is getting easier.' })).toBeVisible();
  expect(await page.evaluate(() => window.capturedTracks.every(track => track.readyState === 'ended'))).toBe(true);
  const saved = await app.readState();
  expect(saved.sessions[0].drafts.intro.recordingMs).toBeGreaterThan(900);
  expect(saved.attempts).toHaveLength(0);
  await page.goto('/#session/browser-session');
  await expect(page.getByLabel('Replay your recorded answer')).toHaveAttribute('src', /^blob:/);
});

test('a late microphone permission result is released after navigation', async ({ page }) => {
  await page.addInitScript(() => {
    window.capturedTracks = [];
    const capture = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async options => {
      const stream = await capture(options);
      window.capturedTracks.push(...stream.getTracks());
      await new Promise(resolve => { window.releaseCapture = resolve; });
      return stream;
    };
  });
  const app = new PracticePage(page);
  await app.seedTask();
  await page.getByRole('button', { name: 'Record an answer' }).click();
  await expect.poll(() => page.evaluate(() => typeof window.releaseCapture)).toBe('function');
  await page.getByRole('link', { name: 'Progress', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Notice what is getting easier.' })).toBeVisible();
  await page.evaluate(() => window.releaseCapture());
  await expect.poll(() => page.evaluate(() => window.capturedTracks.every(track => track.readyState === 'ended'))).toBe(true);
  expect((await app.readState()).attempts).toHaveLength(0);
});

test('progress download merges safely, including a fresh device and invalid imports', async ({ page, browser }) => {
  const app = new PracticePage(page);
  await app.seedTask();
  await app.markSpokenAndReflect();
  await page.getByRole('button', { name: 'Answered independently', exact: true }).click();
  await page.goto('/#settings');
  await page.getByLabel('What should we call you?').fill('Sam');
  await page.getByRole('button', { name: 'Save my profile' }).click();
  await expect.poll(async () => (await app.readState()).profile.name).toBe('Sam');
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export progress' }).click();
  const download = await downloadEvent;
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const buffer = Buffer.concat(chunks);
  expect(JSON.parse(buffer.toString()).state.attempts).toHaveLength(1);
  for (let count = 0; count < 2; count++) {
    await page.locator('input[type="file"]').setInputFiles({ name: 'progress.json', mimeType: 'application/json', buffer });
    await expect(page.getByText('Progress merged. Existing attempts were counted only once.', { exact: true })).toBeVisible();
  }
  expect((await app.readState()).attempts).toHaveLength(1);
  const otherDevice = await browser.newContext({ baseURL: 'http://127.0.0.1:4173', viewport: { width: 390, height: 844 } });
  try {
    const otherPage = await otherDevice.newPage();
    const otherApp = new PracticePage(otherPage);
    await otherApp.open();
    await otherPage.goto('/#settings');
    await otherPage.getByRole('checkbox', { name: 'Also use the profile and preferences in the file' }).check();
    await otherPage.locator('input[type="file"]').setInputFiles({ name: 'progress.json', mimeType: 'application/json', buffer });
    await expect.poll(async () => (await otherApp.readState()).attempts.length).toBe(1);
    await otherPage.reload();
    await expect(otherPage.getByLabel('What should we call you?')).toHaveValue('Sam');
    expect((await otherApp.readState()).sessions).toHaveLength(1);
  } finally { await otherDevice.close(); }
  await page.locator('input[type="file"]').setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{oops') });
  await expect(page.locator('#import-status')).toContainText('not valid JSON');
  expect((await app.readState()).attempts).toHaveLength(1);
});

test('the built application reloads with core exercises offline', async ({ page, context }) => {
  const app = new PracticePage(page);
  await app.open();
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.reload();
  await expect(page.getByRole('heading', { name: 'A little more confident, every day.' })).toBeVisible();
  await context.setOffline(true);
  await page.goto('/#practice');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'A conversation worth having.' })).toBeVisible();
  await page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Your first interview', exact: true }) }).getByRole('button', { name: 'Start mission' }).click();
  await expect(page.getByRole('button', { name: 'Begin with listening' })).toBeVisible();
  await context.setOffline(false);
});
