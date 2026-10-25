import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { AITalkPage } from './ai-talk-page.js';
import { PracticePage } from './practice-page.js';
import { TEST_ACCESS_CODE } from '../../tools/mock-ai-provider.js';

const answer = 'Ich kann montags und donnerstags arbeiten.';
const answerStatus = page => page.getByRole('status', { name: 'Answer status', exact: true });

async function typeAnswer(page, text = answer) {
  await page.getByText('Type a correction instead', { exact: true }).click();
  await page.locator('#ai-text').fill(text);
}

async function fitsScreen(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
}

async function responsivePair(page, first, second) {
  const a = await first.boundingBox(); const b = await second.boundingBox();
  if (page.viewportSize().width > 1100) expect(b.x).toBeGreaterThanOrEqual(a.x + a.width);
  else expect(b.y).toBeGreaterThanOrEqual(a.y + a.height);
  await fitsScreen(page);
}

test('the lobby previews the chosen situation and retains it through unlock with real usage meters', async ({ page }) => {
  await new AITalkPage(page).open();
  const preview = page.getByRole('region', { name: 'Situation preview', exact: true });
  await expect(preview).toContainText('Guten Tag! Stellen Sie sich bitte kurz vor.');
  await expect(page.locator('#ai-setup-status')).toHaveText('AI connection locked.');
  await expect(page.getByText('Your saved conversations will appear here.')).toBeVisible();
  await page.getByLabel('Situation', { exact: true }).selectOption('work-update');
  await page.getByLabel('Level', { exact: true }).selectOption('B1');
  await expect(preview).toContainText('Woran arbeitest du gerade, und wie weit bist du?');
  await expect(preview).toContainText('du · colleagues');
  await page.getByLabel('Owner access code').fill(TEST_ACCESS_CODE);
  await page.getByRole('button', { name: 'Unlock AI Talk', exact: true }).click();
  await expect(page.getByText('Unlocked', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Situation', { exact: true })).toHaveValue('work-update');
  await expect(page.getByLabel('Level', { exact: true })).toHaveValue('B1');
  const response = await page.request.get('/api/v1/usage');
  const { data: usage } = await response.json();
  await expect(page.getByRole('meter', { name: 'Speaking turns today', exact: true })).toHaveAttribute('value', String(usage.turnsUsed));
  await responsivePair(page, page.locator('#ai-setup'), page.locator('#ai-start'));
  await page.getByRole('button', { name: 'Start conversation', exact: true }).click();
  await expect(page.getByRole('log')).toContainText('Woran arbeitest du gerade, und wie weit bist du?');
  await expect(page.getByRole('complementary', { name: 'Conversation context' })).toContainText('B1');
});

test('the Gemini handoff remains usable during gateway loading and failure', async ({ page }) => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/api/v1/status', async route => {
    await gate;
    await route.fulfill({ status: 503, json: { code: 'unavailable', detail: 'Gateway temporarily unavailable.' } });
  });
  try {
    await new AITalkPage(page).open();
    await expect(page.getByRole('heading', { name: 'Checking the gateway…' })).toBeVisible();
    const handoff = page.getByRole('region', { name: 'Phone handoff', exact: true });
    await expect(handoff).toContainText('Gemini runs outside Sprich');
    await expect(page.getByRole('button', { name: 'Copy practice pack', exact: true })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Start conversation', exact: true })).toBeDisabled();
    release();
    await expect(page.getByRole('heading', { name: 'AI gateway unavailable' })).toBeVisible();
    await page.getByLabel('Lesson for Gemini').selectOption('work-update');
    await expect(page.getByLabel('Practice pack preview')).toHaveValue(/Lesson: work-update/);
    await fitsScreen(page);
  } finally { release(); }
});

test('the studio keeps typed drafts and marks completed typed turns as non-speaking evidence', async ({ page }, testInfo) => {
  const app = new AITalkPage(page);
  await app.unlock(); await app.start();
  const context = page.getByRole('complementary', { name: 'Conversation context' });
  await expect(context).toContainText('Review, not a score');
  await responsivePair(page, page.locator('.ai-studio-main'), context);
  await typeAnswer(page);
  await expect(answerStatus(page)).toHaveText('Typed draft · not speaking evidence');
  await page.reload();
  await expect(page.locator('#ai-text')).toHaveValue(answer);
  await page.getByRole('button', { name: 'Send to partner', exact: true }).click();
  await expect(page.locator('.transcript-line.you')).toContainText('Typed · not speaking evidence');
  await expect(page.locator('.transcript-line.you')).toContainText(answer);
  const state = await new PracticePage(page).readState();
  expect(state.aiSessions[0].turns[0]).toMatchObject({ inputMode: 'typed', recordingMs: 0 });
  await page.setViewportSize({ width: 360, height: 800 });
  await fitsScreen(page);
  await page.screenshot({ path: testInfo.outputPath('studio-narrow.png'), fullPage: true });
});

test('recording status reflects local capture and sending while leaving stops microphone tracks', async ({ page }) => {
  await page.addInitScript(() => {
    window.__companionTracks = [];
    const getUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async options => {
      const stream = await getUserMedia(options);
      window.__companionTracks.push(...stream.getTracks());
      return stream;
    };
  });
  const app = new AITalkPage(page);
  await app.unlock(); await app.start();
  await expect(answerStatus(page)).toHaveText('Ready when you are.');
  let posts = 0;
  page.on('request', request => { if (request.url().endsWith('/api/v1/turns')) posts++; });
  await page.getByRole('button', { name: 'Hold a short answer', exact: true }).click();
  await expect(answerStatus(page)).toHaveText('Recording on this device…');
  await expect(page.getByRole('button', { name: 'Send to partner', exact: true })).toBeDisabled();
  await expect(page.getByLabel('Recording duration')).toHaveText(/^0:0[1-9]$/);
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(answerStatus(page)).toHaveText('Recording saved on this device. Ready to send.');
  await expect(page.getByLabel('Replay your recorded answer')).toBeVisible();
  expect(posts).toBe(0);
  await page.getByRole('button', { name: 'Send to partner', exact: true }).click();
  await expect(page.locator('.transcript-line.you')).toContainText('Recorded · transcript');
  expect(posts).toBe(1);
  await page.getByRole('button', { name: 'Hold a short answer', exact: true }).click();
  await expect(answerStatus(page)).toHaveText('Recording on this device…');
  await expect(page.getByLabel('Recording duration')).toHaveText(/^0:0[1-9]$/);
  await page.getByRole('link', { name: 'AI Talk', exact: true }).last().click();
  await expect(page.getByRole('heading', { name: 'Continue a conversation' })).toBeVisible();
  expect(await page.evaluate(() => window.__companionTracks.every(track => track.readyState === 'ended'))).toBe(true);
  const session = (await new PracticePage(page).readState()).aiSessions[0];
  expect(session.draft.recordingMs).toBeGreaterThan(0);
});

test('quota rejection keeps the draft and a lost response recovers by receipt without resending', async ({ page }) => {
  const app = new AITalkPage(page);
  await app.unlock(); await app.start();
  await typeAnswer(page);
  await expect(answerStatus(page)).toHaveText('Typed draft · not speaking evidence');
  const storage = new PracticePage(page);
  const firstId = (await storage.readState()).aiSessions[0].draft.requestId;
  let posts = 0; let receipts = 0;
  await page.route('**/api/v1/turns', async route => {
    if (++posts === 1) await route.fulfill({ status: 429, json: { code: 'daily_turns', detail: 'Your daily speaking allowance is used up.' } });
    else { await route.fetch(); await route.abort(); }
  });
  await page.route('**/api/v1/requests/*', route => ++receipts === 1 ? route.abort() : route.continue());
  await page.getByRole('button', { name: 'Send to partner', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Your daily speaking allowance is used up.');
  await expect(page.locator('#ai-text')).toHaveValue(answer);
  const retryId = (await storage.readState()).aiSessions[0].draft.requestId;
  expect(retryId).not.toBe(firstId);
  await page.getByRole('button', { name: 'Send to partner', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Check for my reply', exact: true })).toBeEnabled();
  await expect(answerStatus(page)).toHaveText('Waiting for the reply…');
  await expect(page.locator('#ai-text')).toBeDisabled();
  expect((await storage.readState()).aiSessions[0].draft.requestId).toBe(retryId);
  await page.getByRole('button', { name: 'Check for my reply', exact: true }).click();
  await expect(page.locator('.transcript-line.you')).toContainText(answer);
  expect((await storage.readState()).aiSessions[0].turns).toHaveLength(1);
  expect(posts).toBe(2); expect(receipts).toBe(2);
});

test('leaving a pending send restores the receipt when the saved conversation is reopened', async ({ page }) => {
  const app = new AITalkPage(page);
  await app.unlock(); await app.start();
  await typeAnswer(page);
  let release; let upstream = false; let posts = 0;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/api/v1/turns', async route => {
    posts++;
    const response = await route.fetch(); upstream = true;
    await gate;
    await route.fulfill({ response }).catch(() => {});
  });
  try {
    await page.getByRole('button', { name: 'Send to partner', exact: true }).click();
    await expect.poll(() => upstream).toBe(true);
    await expect(answerStatus(page)).toHaveText('Talking to your partner…');
    await page.getByRole('link', { name: 'AI Talk', exact: true }).last().click();
    await expect(page.getByRole('heading', { name: 'Continue a conversation' })).toBeVisible();
    release();
    await page.locator('#ai-conversations').getByRole('link', { name: 'Open', exact: true }).click();
    await expect(page.locator('.transcript-line.you')).toContainText(answer);
    expect(posts).toBe(1);
    expect((await new PracticePage(page).readState()).aiSessions[0].turns).toHaveLength(1);
  } finally { release(); }
});

test('the editable handoff exports only selected facts and native-share cancellation stays quiet', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: async data => {
      window.__sharedPack = data;
      throw new DOMException('Cancelled', 'AbortError');
    } });
  });
  await page.goto('/#settings');
  await page.getByLabel('What should we call you?').fill('Example Learner');
  await page.getByLabel('Your studies').fill('Informatik im dritten Semester');
  await page.getByRole('button', { name: 'Save my profile' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Your profile is saved.' })).toBeVisible();
  await page.goto('/#gemini/starter-coffee');
  await expect(page.getByRole('region', { name: 'Phone handoff', exact: true })).toContainText('Gemini runs outside Sprich');
  const preview = page.getByLabel('Practice pack preview');
  await expect(preview).not.toHaveValue(/Example Learner|Informatik im dritten Semester/);
  await page.getByRole('checkbox', { name: 'Studies: Informatik im dritten Semester', exact: true }).check();
  await page.getByLabel('Level target').selectOption('B1');
  await page.getByLabel('Help from Gemini').selectOption('light');
  await expect(preview).toHaveValue(/Level target: B1/);
  await expect(preview).toHaveValue(/Support: less help/);
  await expect(preview).toHaveValue(/Studies: Informatik im dritten Semester/);
  await expect(preview).not.toHaveValue(/Example Learner/);
  const edited = `${await preview.inputValue()}\nMein Fokus: höflich bestellen.`;
  await preview.fill(edited);
  await page.getByRole('button', { name: 'Share', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Share', exact: true })).toBeEnabled();
  await expect(preview).toHaveValue(edited);
  await expect(page.locator('[data-pack-status]')).toBeEmpty();
  expect(await page.evaluate(() => window.__sharedPack.text)).toBe(edited);
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('Denied'); } } }));
  await page.getByRole('button', { name: 'Copy practice pack', exact: true }).click();
  await expect(preview).toBeFocused();
  await expect(page.locator('[data-pack-status]')).toContainText('Copy the selected text manually');
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download .txt', exact: true }).click();
  const download = await event;
  expect(download.suggestedFilename()).toBe('sprich-starter-coffee-gemini.txt');
  expect(await readFile(await download.path(), 'utf8')).toBe(edited);
  await fitsScreen(page);
  await page.screenshot({ path: testInfo.outputPath('gemini-handoff.png'), fullPage: true });
});

test('saving a takeaway keeps external minutes separate from lesson completion and speaking evidence', async ({ page }) => {
  await page.goto('/#gemini/starter-coffee');
  await expect(page.getByText('Exporting does not complete or grade a lesson.', { exact: true })).toBeVisible();
  const storage = new PracticePage(page);
  const before = await storage.readState();
  await page.getByLabel('Your takeaway').fill('Ich möchte einen Kaffee, bitte.');
  await page.getByLabel('Minutes with Gemini (self-reported)').fill('7');
  await page.getByRole('button', { name: 'Save Gemini takeaway', exact: true }).click();
  await expect(page.locator('[data-note-status]')).toHaveText('Gemini takeaway saved. You can find it in Progress.');
  const after = await storage.readState();
  expect(after.companionNotes).toHaveLength(before.companionNotes.length + 1);
  expect(after.companionNotes.at(-1)).toMatchObject({ missionId: 'starter-coffee', text: 'Ich möchte einen Kaffee, bitte.', minutes: 7 });
  for (const key of ['sessions', 'attempts', 'activity', 'aiSessions']) expect(after[key]).toEqual(before[key]);
  expect(after.starter.sessions).toEqual(before.starter.sessions);
  expect(after.starter.reviews).toEqual(before.starter.reviews);
  expect(after.assessments).toEqual(before.assessments);
});
