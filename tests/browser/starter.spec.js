import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { PracticePage } from './practice-page.js';
import { COURSE_LESSONS } from '../../app/data/starter-catalog.js';

class StarterPage {
  constructor(page) { this.page = page; this.storage = new PracticePage(page); }
  async open(id = 'starter-hello') {
    await this.page.goto(`/#lesson/${id}`);
    await expect(this.page.getByRole('button', { name: 'Start guided', exact: true })).toBeVisible();
  }
  async start() { await this.page.getByRole('button', { name: 'Start guided', exact: true }).click(); await expect(this.page).toHaveURL(/#learn\//); }
  async say() { await this.page.getByRole('checkbox', { name: 'I practised aloud (recording is optional)' }).check(); }
  async next() { await this.page.getByRole('button', { name: 'Next step', exact: true }).click(); }
}

test('a beginner lesson starts with speaking, records assistance, resumes, and completes without legacy grades', async ({ page }) => {
  const app = new StarterPage(page);
  await app.open(); await app.start();
  await expect(page.getByRole('heading', { name: 'Start with these words.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Hear and repeat' })).toBeEnabled();
  await app.say();
  await page.getByRole('button', { name: 'Save warm-up & continue' }).click();
  await expect(page.getByRole('heading', { name: 'Hear them. Say them. Notice the meaning.' })).toBeVisible();
  await app.next(); await app.next(); await app.next();
  await page.getByRole('button', { name: 'Show model answer' }).click();
  await app.say();
  await expect(page.getByRole('button', { name: 'Said it on my own' })).toBeDisabled();
  await page.getByRole('button', { name: 'Needed help', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Response saved' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('status').filter({ hasText: 'practised with help' })).toBeVisible();
  for (let index = 0; index < 3; index++) {
    await app.next(); await app.say();
    await page.getByRole('button', { name: 'Said it on my own' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Response saved' })).toBeVisible();
  }
  await app.next();
  await page.getByRole('button', { name: 'Finish lesson', exact: true }).click();
  await expect(page.getByText('Lesson finished', { exact: true })).toBeVisible();
  const state = await app.storage.readState();
  expect(state.starter.sessions[0].responses).toHaveLength(5);
  expect(state.starter.sessions[0].completedAt).toBeTruthy();
  expect(state.attempts).toHaveLength(0);
});

test('Gemini export is the selected lesson and downloads UTF-8 text without completing it', async ({ page }) => {
  await page.goto('/#gemini/starter-coffee');
  const preview = page.getByRole('textbox', { name: 'Practice pack preview' });
  await expect(preview).toHaveValue(/starter-coffee/);
  await expect(preview).toHaveValue(/Einen Kaffee, bitte/);
  await expect(preview).toHaveValue(/about A1 in speaking/);
  await expect(preview).toHaveValue(/Level target: A1/);
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download .txt', exact: true }).click();
  const download = await event;
  expect(download.suggestedFilename()).toBe('sprich-starter-coffee-gemini.txt');
  expect(await readFile(await download.path(), 'utf8')).toContain('Ich möchte');
  const state = await new PracticePage(page).readState();
  expect(state.starter.sessions).toHaveLength(0);
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('Denied'); } } }));
  await page.getByRole('button', { name: 'Copy practice pack', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Copy the selected text manually' })).toBeVisible();
  await expect(preview).toBeFocused();
});

test('vocabulary saves useful words and early reveal cannot be graded as independent recall', async ({ page }) => {
  await page.goto('/#words');
  await expect(page.getByRole('heading', { name: 'Vocabulary you can use.' })).toBeVisible();
  await page.getByText('Filter', { exact: true }).click();
  await page.getByLabel('Search words').fill('coffee');
  const word = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'der Kaffee', exact: true }) });
  await word.getByRole('button', { name: 'Save word', exact: true }).click();
  await expect(word.getByRole('button', { name: 'Saved word', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await word.getByRole('button', { name: 'Say from memory' }).click();
  await expect(page).toHaveURL(/#word-session\//);
  await expect(page.getByRole('heading', { name: 'coffee', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'der Kaffee', exact: true })).not.toBeVisible();
  await page.getByRole('button', { name: 'Reveal word and example' }).click();
  await expect(page.getByRole('button', { name: 'Said from memory', exact: true })).toBeDisabled();
  await page.getByRole('checkbox', { name: 'I repeated a supported answer aloud' }).check();
  await page.getByRole('button', { name: 'With help', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'A small batch, ready to reuse.' })).toBeVisible();
  const state = await new PracticePage(page).readState();
  expect(state.starter.reviews[0].outcome).toBe('helped');
  expect(state.starter.reviews[0].hintUsed).toBe(true);
  expect(state.starter.wordMarks).toContainEqual(expect.objectContaining({ id: 'kaffee', saved: true }));
});

test('a downloaded beginner course and an in-progress lesson reload offline', async ({ page, context }) => {
  const app = new StarterPage(page);
  await app.open(); await app.start();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Start with these words.' })).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Start with these words.' })).toBeVisible();
  await page.goto('/#words');
  await expect(page.getByRole('heading', { name: 'Vocabulary you can use.' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
});

test('Today recommends a path step and the library classifies and filters the whole course', async ({ page }, info) => {
  await page.goto('/');
  await expect(page.getByRole('combobox', { name: 'Learning path', exact: true })).toHaveValue('starter');
  await expect(page.getByRole('button', { name: /^Start · \d+ min/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try with less help', exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('starter-today.png'), fullPage: true });

  await page.getByRole('link', { name: 'Lessons', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Greetings and names' })).toBeVisible();
  await expect(page.getByText('RECOMMENDED NEXT · STAGE 1 OF 5')).toBeVisible();
  await expect(page.getByText('STAGE 1 · Start speaking')).toBeVisible();
  await expect(page.getByText('STAGE 5 · University and work')).toBeVisible();
  await expect(page.getByRole('link', { name: /Buy a ticket/ })).not.toBeVisible();
  await page.locator('.stage-card > summary').filter({ hasText: 'Handle everyday situations' }).click();
  await expect(page.getByRole('link', { name: /Buy a ticket/ })).toBeVisible();
  await page.screenshot({ path: info.outputPath('starter-path.png'), fullPage: true });

  await page.getByRole('tab', { name: 'All lessons' }).click();
  const total = COURSE_LESSONS.length;
  const count = predicate => COURSE_LESSONS.filter(predicate).length;
  await expect(page.getByRole('article')).toHaveCount(total);
  await page.locator('.lesson-filters > summary').click();
  await expect(page.getByText(`${total} of ${total} lessons · 0 practised`)).toBeVisible();
  await page.getByRole('combobox', { name: 'Level' }).selectOption('A2');
  await expect(page.getByRole('article')).toHaveCount(count(lesson => lesson.level === 'A2'));
  await page.getByRole('combobox', { name: 'Topic' }).selectOption('travel');
  await expect(page.getByRole('article')).toHaveCount(count(lesson => lesson.level === 'A2' && lesson.topic === 'travel'));
  await page.getByRole('combobox', { name: 'Topic' }).selectOption('all');
  await page.getByRole('combobox', { name: 'Speaking skill' }).selectOption('describe');
  await expect(page.getByRole('article')).toHaveCount(count(lesson => lesson.level === 'A2' && lesson.skill === 'describe'));
  await page.getByRole('combobox', { name: 'Level' }).selectOption('all');
  await page.getByRole('combobox', { name: 'Speaking skill' }).selectOption('all');
  await page.getByLabel('Search lessons').fill('Fahrkarte');
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Buy a ticket' })).toBeVisible();
  await expect(page.getByRole('article').getByText('Useful first:')).toBeVisible();
  await expect(page.getByRole('article').getByRole('link', { name: 'Ask the price and pay' })).toBeVisible();
  await page.getByLabel('Search lessons').fill('zzz');
  await expect(page.getByText('No lesson matches these filters.')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);

  await page.getByRole('link', { name: 'Words', exact: true }).click();
  await expect(page.getByText('12 of 250 matching words', { exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('starter-vocabulary.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
});

test('a lighter-support lesson hides the meaning and model until asked', async ({ page }) => {
  await page.goto('/#lesson/starter-hello');
  await page.getByRole('button', { name: 'Try with less help', exact: true }).click();
  await expect(page).toHaveURL(/#learn\//);
  await expect(page.getByText('Less help', { exact: true })).toBeVisible();
  await page.getByRole('checkbox', { name: 'I practised aloud (recording is optional)' }).check();
  await page.getByRole('button', { name: 'Save warm-up & continue' }).click();
  for (let step = 0; step < 3; step++) await page.getByRole('button', { name: 'Next step', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Meaning' })).toHaveCount(0);
  await expect(page.getByText('Meaning', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'I need the model answer' })).toBeVisible();
  const state = await new PracticePage(page).readState();
  expect(state.starter.sessions[0].support).toBe('light');
});

test('a prerequisite link opens its preparation lesson without blocking the harder one', async ({ page }) => {
  await page.goto('/#lesson/starter-ticket');
  await expect(page.getByTitle('Answer familiar questions and manage a basic transaction.').first()).toBeVisible();
  await expect(page.getByText('Getting around · LESSON', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start guided', exact: true })).toBeEnabled();
  await page.getByRole('link', { name: 'Ask the price and pay' }).click();
  await expect(page).toHaveURL(/#lesson\/starter-prices/);
  await expect(page.getByRole('heading', { name: 'Ask the price and pay' })).toBeVisible();
});

test('the Gemini companion changes lesson context and saves its takeaway under the selected lesson', async ({ page }) => {
  await page.goto('/#ai');
  await page.getByRole('combobox', { name: 'Lesson for Gemini', exact: true }).selectOption('starter-coffee');
  const preview = page.getByRole('textbox', { name: 'Practice pack preview' });
  await expect(preview).toHaveValue(/starter-coffee/);
  await expect(preview).not.toHaveValue(/Lesson: starter-hello/);
  await page.getByRole('textbox', { name: 'Your takeaway', exact: true }).fill('Ich möchte einen Kaffee, bitte.');
  await page.getByRole('button', { name: 'Save Gemini takeaway' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Gemini takeaway saved.' })).toBeVisible();
  await page.getByRole('link', { name: 'Progress', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Gemini practice & beginner takeaways' })).toBeVisible();
  await expect(page.getByText('Order a drink · 5 min self-reported', { exact: true })).toBeVisible();
  const state = await new PracticePage(page).readState();
  expect(state.companionNotes[0].missionId).toBe('starter-coffee');
  expect(state.attempts).toHaveLength(0);
});

test('a just-typed word draft survives reload and recognition stays separate from speaking', async ({ page }) => {
  await page.goto('/#words');
  await page.getByRole('radio', { name: 'Recognise the meaning' }).click();
  await page.getByRole('button', { name: 'Learn five words' }).click();
  await page.getByRole('textbox', { name: 'Optional notes' }).fill('Hello');
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Optional notes' })).toHaveValue('Hello');
  await page.getByRole('checkbox', { name: 'I tried to remember the meaning' }).check();
  await page.getByRole('button', { name: 'Reveal meaning', exact: true }).click();
  await page.getByRole('button', { name: 'Remembered the meaning', exact: true }).click();
  await expect.poll(async () => (await new PracticePage(page).readState()).starter.reviews.length).toBe(1);
  const review = (await new PracticePage(page).readState()).starter.reviews[0];
  expect(review.mode).toBe('meaning');
  expect(review.spoken).toBe(false);
  expect(review.outcome).toBe('independent');
});

test('export stops and saves an active beginner recording without grading it', async ({ page }) => {
  await page.addInitScript(() => {
    window.__starterTracks = [];
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async constraints => {
      const stream = await original(constraints);
      window.__starterTracks.push(...stream.getTracks());
      return stream;
    };
  });
  const app = new StarterPage(page);
  await app.open(); await app.start();
  await page.getByRole('button', { name: 'Record an answer', exact: true }).click();
  await expect(page.getByLabel('Recording duration')).not.toHaveText('0:00');
  await page.getByText('Export for Gemini', { exact: true }).click();
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download .txt', exact: true }).click();
  await event;
  expect(await page.evaluate(() => window.__starterTracks.every(track => track.readyState === 'ended'))).toBe(true);
  const state = await app.storage.readState();
  expect(state.starter.sessions[0].drafts.warmup.recordingMs).toBeGreaterThan(0);
  expect(state.starter.sessions[0].responses).toHaveLength(0);
});

test('cancelled native sharing preserves the pack and exports no unselected profile facts', async ({ page }) => {
  await page.addInitScript(() => {
    window.__sharedPack = null;
    Object.defineProperty(navigator, 'share', { configurable: true, value: async data => {
      window.__sharedPack = data;
      throw new DOMException('Cancelled', 'AbortError');
    } });
  });
  await page.goto('/#settings');
  await page.getByLabel('What should we call you?').fill('Example Learner');
  await page.getByRole('button', { name: 'Save my profile' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Your profile is saved.' })).toBeVisible();
  await page.goto('/#gemini/starter-hello');
  const preview = page.getByRole('textbox', { name: 'Practice pack preview' });
  await expect(preview).not.toHaveValue(/Example Learner/);
  await page.getByRole('button', { name: 'Share', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Share', exact: true })).toBeEnabled();
  expect(await page.evaluate(() => window.__sharedPack.text.includes('Example Learner'))).toBe(false);
  await page.getByRole('checkbox', { name: 'Name: Example Learner', exact: true }).check();
  await expect(preview).toHaveValue(/Name: Example Learner/);
  expect((await new PracticePage(page).readState()).starter.sessions).toHaveLength(0);
});
