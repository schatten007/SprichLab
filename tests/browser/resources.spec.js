import { test, expect } from '@playwright/test';
import { PracticePage } from './practice-page.js';
import { newState, SCHEMA_VERSION } from '../../app/js/model.js';

async function openPhoneActivity(page) {
  const app = new PracticePage(page);
  await app.open();
  await page.goto('/#resource/dw-phone');
  await page.getByRole('button', { name: 'Start guided activity', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Save response & complete activity' })).toBeVisible();
  return app;
}

test('resource filters and bookmarks are useful on desktop and mobile', async ({ page }, info) => {
  const app = new PracticePage(page);
  await app.open();
  await page.goto('/#resources');
  await expect(page.getByText('15 resources match your filters', { exact: true })).toBeVisible();
  await page.getByLabel('Search resources').fill('Am Telefon');
  await expect(page.getByText('1 resource matches your filters', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Save Deutschtrainer 69: Am Telefon', exact: true }).click();
  await page.getByLabel('Search resources').fill('');
  await page.getByRole('checkbox', { name: 'Saved resources only' }).check();
  await expect(page.getByText('1 resource matches your filters', { exact: true })).toBeVisible();
  await page.getByRole('checkbox', { name: 'Saved resources only' }).uncheck();
  await page.getByLabel('Level', { exact: true }).selectOption('A2');
  await page.getByLabel('Practice time').selectOption('10');
  await page.getByRole('checkbox', { name: 'No registration required' }).check();
  await expect(page.getByRole('heading', { name: 'Online-Aussprachetrainer', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: info.outputPath('resource-library.png'), fullPage: true });
  await page.reload();
  await page.getByRole('checkbox', { name: 'Saved resources only' }).check();
  await expect(page.getByRole('button', { name: 'Unsave Deutschtrainer 69: Am Telefon', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('keyboard skip navigation keeps the current resource route and stays hidden when unfocused', async ({ page }) => {
  const app = new PracticePage(page);
  await app.open();
  await page.goto('/#resources');
  const skip = page.getByRole('link', { name: 'Skip to content', exact: true });
  await expect(skip).not.toBeInViewport();
  await skip.focus();
  await expect(skip).toBeInViewport();
  await skip.click();
  await expect(page).toHaveURL(/#resources$/);
  await expect(page.locator('#main')).toBeFocused();
  await expect(skip).not.toBeInViewport();
});

test('opening a source requires a saved artifact to complete; outside time remains self-reported', async ({ page, context }, info) => {
  await context.route('https://learngerman.dw.com/**', route => route.fulfill({ status: 200, contentType: 'text/html', body: '<h1>Publisher source fixture</h1>' }));
  const app = await openPhoneActivity(page);
  const before = await app.readState();
  expect(before.attempts).toHaveLength(0);
  const popupEvent = page.waitForEvent('popup');
  await page.getByRole('link', { name: 'Open original resource' }).click();
  const popup = await popupEvent;
  await popup.close();
  await expect(page.getByRole('button', { name: 'Save response & complete activity' })).toBeDisabled();
  await page.getByRole('checkbox', { name: 'I practised aloud (recording is optional)' }).check();
  await expect(page.getByRole('button', { name: 'Save response & complete activity' })).toBeDisabled();
  await page.getByText('Optional notes or transcript', { exact: true }).click();
  await page.getByLabel('Write what you said, or keep a few key words.', { exact: false }).fill('Guten Tag, ich rufe wegen Ihrer Stelle an. Könnten Sie mich morgen zurückrufen?');
  await page.getByLabel('Minutes studied on the publisher’s site (optional)').fill('12');
  await page.getByRole('button', { name: 'Save response & complete activity' }).click();
  await expect(page.getByText('Practice response saved.', { exact: true })).toBeVisible();
  const state = await app.readState();
  expect(state.attempts).toHaveLength(1);
  expect(state.attempts[0].kind).toBe('resource');
  expect(state.attempts[0].outcome).toBe('unscored');
  expect(state.attempts[0].externalMinutes).toBe(12);
  expect(state.sessions[0].kind).toBe('resource');
  expect(state.sessions[0].completedAt).not.toBeNull();
  await page.reload();
  await expect(page.getByText('Practice response saved.', { exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('resource-response.png'), fullPage: true });
});

test('a difficult resource offers a different guided activity and an offline fallback', async ({ page }) => {
  const app = new PracticePage(page);
  await app.open();
  await page.goto('/#resource/nicos-interview');
  await page.getByLabel('How difficult was this resource?').selectOption('hard');
  await expect(page.getByRole('heading', { name: 'Try a more accessible next step.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Practise the in-app situation instead' })).toBeVisible();
  await page.locator('[data-alternative="dw-phone"]').click();
  await expect(page.getByRole('heading', { name: 'Deutschtrainer 69: Am Telefon', exact: true })).toBeVisible();
  const state = await app.readState();
  expect(state.sessions.at(-1).resourceId).toBe('dw-phone');
  expect(state.resourceStates.find(item => item.id === 'nicos-interview').difficulty).toBe('hard');
  expect(state.dailyPlans[0].resourceId).toBe('dw-phone');
});

test('personal phrases keep their source and can be practised immediately', async ({ page }) => {
  const app = new PracticePage(page);
  await app.open();
  await page.goto('/#phrases');
  await page.getByText('Add a personal phrase', { exact: true }).click();
  const fillPhrase = async () => {
    await page.getByLabel('German phrase', { exact: true }).fill('Ich bringe die Unterlagen morgen mit.');
    await page.getByLabel('English meaning', { exact: true }).fill('I will bring the documents tomorrow.');
    await page.getByLabel('Your own example sentence').fill('Ich bringe die Unterlagen morgen zum Termin mit.');
    await page.getByLabel('Source link (optional)').fill('https://example.org/lesson');
    await page.getByRole('button', { name: 'Save phrase to my collection' }).click();
    await expect(page.getByRole('heading', { name: 'Ich bringe die Unterlagen morgen mit.', exact: true })).toBeVisible();
  };
  await fillPhrase();
  await fillPhrase();
  expect((await app.readState()).personalPhrases).toHaveLength(1);
  await page.getByRole('button', { name: 'Recall aloud', exact: true }).click();
  await page.getByRole('checkbox', { name: 'I practised aloud (recording is optional)' }).check();
  await page.getByRole('button', { name: 'Show model & rate my recall' }).click();
  await page.getByRole('button', { name: 'Recalled independently' }).click();
  // The rating is written to IndexedDB asynchronously; wait for it instead of racing the read.
  await expect.poll(async () => (await app.readState()).attempts.length).toBe(1);
  const saved = await app.readState();
  expect(saved.attempts[0].phraseIds).toEqual([saved.personalPhrases[0].id]);
  expect(saved.sessions[0].content.phrases[0].sourceUrl).toBe('https://example.org/lesson');
});

test('English question meanings are on demand and do not count as answer-model help', async ({ page }) => {
  const app = new PracticePage(page);
  await app.seedTask();
  await expect(page.locator('#question-meaning > div')).not.toBeVisible();
  await page.locator('#question-meaning > summary').click();
  await expect(page.locator('#question-meaning > div')).toContainText('introduce yourself');
  await app.markSpokenAndReflect();
  await page.getByRole('button', { name: 'Answered independently', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Your self-assessment is saved.' })).toBeVisible();
  const state = await app.readState();
  expect(state.attempts[0].hintUsed).toBe(false);
  expect(state.attempts[0].assistance.questionTranslation).toBe(true);
  expect(state.attempts[0].assistance.answerTranslation).toBe(false);
});

test('always-visible English does not reveal a hidden model or prevent independent speaking', async ({ page }) => {
  const app = new PracticePage(page);
  await app.seedTask();
  await page.goto('/#settings');
  await page.getByLabel('English support', { exact: false }).selectOption('always');
  await page.getByRole('button', { name: 'Save preferences' }).click();
  await page.goto('/#session/browser-session');
  await expect(page.locator('#question-meaning > div')).toBeVisible();
  await expect(page.locator('#answer-hint')).not.toBeVisible();
  await app.markSpokenAndReflect();
  await expect(page.getByRole('button', { name: 'Answered independently', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Answered independently', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Your self-assessment is saved.' })).toBeVisible();
  expect((await app.readState()).attempts[0].hintUsed).toBe(false);
});

test('a resource recording is a durable unscored artifact', async ({ page }) => {
  const app = await openPhoneActivity(page);
  await page.getByRole('button', { name: 'Record an answer' }).click();
  await expect(page.getByLabel('Recording duration')).not.toHaveText('0:00');
  await page.getByRole('button', { name: 'Stop recording', exact: true }).click();
  await expect(page.getByLabel('Replay your recorded answer')).toHaveAttribute('src', /^blob:/);
  await page.getByRole('button', { name: 'Save response & complete activity' }).click();
  await expect(page.getByText('Practice response saved.', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Replay your recorded answer')).toHaveAttribute('src', /^blob:/);
  const state = await app.readState();
  expect(state.attempts[0].recordingMs).toBeGreaterThan(900);
  expect(state.attempts[0].source).toBe('practice');
  expect(state.attempts[0].outcome).toBe('unscored');
});

test('an unfinished invalid time edit cannot corrupt the saved resource draft', async ({ page }) => {
  const app = await openPhoneActivity(page);
  await page.getByText('Optional notes or transcript', { exact: true }).click();
  await page.getByLabel('Write what you said, or keep a few key words.', { exact: false }).fill('Ich kann nach einer Telefonnummer fragen.');
  await page.getByLabel('Minutes studied on the publisher’s site (optional)').fill('1.5');
  await expect(page.getByText('Use a whole number from 0 to 120 minutes.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save response & complete activity' })).toBeDisabled();
  await page.reload();
  await expect(page.getByLabel('Minutes studied on the publisher’s site (optional)')).toHaveValue('1.5');
  await expect(page.getByRole('button', { name: 'Save response & complete activity' })).toBeDisabled();
  await page.getByLabel('Minutes studied on the publisher’s site (optional)').fill('10');
  await page.getByRole('button', { name: 'Save response & complete activity' }).click();
  await expect(page.getByText('Practice response saved.', { exact: true })).toBeVisible();
  expect((await app.readState()).attempts[0].externalMinutes).toBe(10);
});

test('a v2 backup opens with its original task position and answer keys', async ({ page }) => {
  const app = new PracticePage(page);
  await app.open();
  const old = newState(1000);
  old.schemaVersion = 2;
  delete old.preferences.englishSupport;
  delete old.personalPhrases;
  delete old.resourceStates;
  delete old.dailyPlans;
  old.sessions.push({ id: 'previous-session', kind: 'mission', missionId: 'first-interview', createdAt: 1000, updatedAt: 2000, completedAt: null,
    cursor: 1, variant: 0, short: false, phraseIds: ['study', 'work-goal', 'hours', 'days', 'repeat', 'motivation'], profile: structuredClone(old.profile), drafts: {} });
  await page.goto('/#settings');
  await page.locator('input[type="file"]').setInputFiles({ name: 'old-progress.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ app: 'sprich', format: 1, state: old })) });
  await expect.poll(async () => (await app.readState()).sessions.length).toBe(1);
  await page.goto('/#session/previous-session');
  await expect(page.getByRole('heading', { name: 'First, catch the meaning.' })).toBeVisible();
  await page.getByRole('button', { name: 'Use the reading alternative / show transcript' }).click();
  await page.getByRole('radio', { name: 'Sixteen', exact: true }).check();
  await page.getByRole('radio', { name: 'From November', exact: true }).check();
  await page.getByRole('button', { name: 'Check understanding' }).click();
  await expect(page.getByText('2 of 2 answers correct.', { exact: false })).toBeVisible();
  const state = await app.readState();
  expect(state.schemaVersion).toBe(SCHEMA_VERSION);
  expect(state.sessions[0].content.version).toBe('sprich-2.0');
  expect(state.attempts).toHaveLength(2);
});

test('daily reflections persist and original lessons remain available offline', async ({ page, context }) => {
  const app = new PracticePage(page);
  await app.open();
  await page.getByLabel('A useful sentence and where you will use it').fill('Ich kann eine Rückfrage stellen. Das probiere ich morgen in der Uni.');
  await page.getByRole('button', { name: 'Save today’s takeaway' }).click();
  await expect(page.getByText('Reflection saved', { exact: true })).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.reload();
  await expect.poll(() => page.locator('body').getAttribute('data-assessment-offline-ready'), { timeout: 20_000 }).toBe('true');
  await context.setOffline(true);
  await page.goto('/#resource/dw-phone');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Deutschtrainer 69: Am Telefon', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open original resource' })).toHaveAttribute('aria-disabled', 'true');
  await page.getByRole('button', { name: 'Start guided activity' }).click();
  await expect(page.getByRole('button', { name: 'Save response & complete activity' })).toBeVisible();
  await page.goto('/#today');
  await expect(page.getByLabel('A useful sentence and where you will use it')).toHaveValue('Ich kann eine Rückfrage stellen. Das probiere ich morgen in der Uni.');
  await context.setOffline(false);
});
