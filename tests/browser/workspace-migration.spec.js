import { test, expect } from '@playwright/test';
import { PracticePage } from './practice-page.js';
import { CURRICULUM } from '../../app/data/curriculum.js';

async function fitsViewport(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
}

async function responsivePair(page, first, second) {
  await expect(first).toBeVisible();
  await expect(second).toBeVisible();
  const a = await first.boundingBox();
  const b = await second.boundingBox();
  if (page.viewportSize().width > 1000) {
    expect(b.x).toBeGreaterThanOrEqual(a.x + a.width);
    expect(Math.abs(a.y - b.y)).toBeLessThan(2);
  } else {
    expect(b.y).toBeGreaterThanOrEqual(a.y + a.height);
    expect(Math.abs(a.x - b.x)).toBeLessThan(2);
  }
  await fitsViewport(page);
}

test('workplace library groups the real curriculum and filters whole stage sections', async ({ page }, info) => {
  const app = new PracticePage(page);
  await app.open();
  await page.goto('/#practice');
  const stages = page.locator('.workplace-stage');
  await expect(stages).toHaveCount(6);
  for (const stage of CURRICULUM) {
    const section = page.getByRole('region', { name: `Stage ${stage.number}: ${stage.title}`, exact: true });
    await expect(section.getByRole('article')).toHaveCount(stage.missionIds.length);
    await expect(section.getByText(stage.titleDe, { exact: true })).toBeVisible();
  }
  const cards = stages.first().getByRole('article');
  await responsivePair(page, cards.nth(0), cards.nth(1));
  await page.locator('[data-stage="4"]').click();
  await expect(page.getByLabel('Show situations')).toHaveValue('4');
  await expect(stages.filter({ visible: true })).toHaveCount(1);
  await expect(page.getByRole('article')).toHaveCount(2);
  await expect(page.locator('[data-stage="4"]')).toHaveAttribute('aria-pressed', 'true');
  await page.getByLabel('Show situations').selectOption('all');
  await expect(stages.filter({ visible: true })).toHaveCount(6);
  await expect(page.getByText('Finishing a phrase review or a resource activity does not complete a mission.', { exact: true })).toBeVisible();
  expect((await app.readState()).sessions).toHaveLength(0);
  await page.screenshot({ path: info.outputPath('workplace-library.png'), fullPage: true });
});

test('mission deck shows snapshot stages and keeps typed drafts and independent-speaking gates', async ({ page }, info) => {
  const app = new PracticePage(page);
  await app.seedTask('availability');
  const stages = page.getByRole('list', { name: 'Session stages', exact: true });
  await expect(stages.getByRole('listitem')).toHaveCount(7);
  await expect(stages.locator('[aria-current="step"]')).toContainText('Speak');
  const session = (await app.readState()).sessions[0];
  await expect(page.locator('.session-progress')).toContainText(`Step ${session.cursor + 1} of ${session.content.tasks.length}`);
  await responsivePair(page, page.locator('.lesson-main'), page.locator('#lesson-side'));
  await expect(page.locator('.lesson-heading')).toContainText('Self-rated');
  await page.getByText('Optional notes or transcript', { exact: true }).click();
  await page.getByLabel('Write what you said, or keep a few key words.').fill('Welche Arbeitszeiten sind für das Team wichtig?');
  await page.getByRole('radio', { name: 'Ich habe nach den benötigten Stunden gefragt.' }).check();
  await expect(page.getByRole('button', { name: 'Answered independently', exact: true })).toBeDisabled();
  await page.getByRole('link', { name: 'Workplace library', exact: true }).click();
  const mission = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Your first interview', exact: true }) });
  await expect(mission).toContainText(`Step ${session.cursor + 1} of ${session.content.tasks.length}`);
  await mission.getByRole('button', { name: 'Resume mission', exact: true }).click();
  await expect(page.getByLabel('Write what you said, or keep a few key words.')).toHaveValue('Welche Arbeitszeiten sind für das Team wichtig?');
  await app.markSpokenAndReflect();
  await page.getByRole('button', { name: 'Answered independently', exact: true }).click();
  await page.getByRole('button', { name: 'Next question', exact: true }).click();
  await expect(page.locator('#current-prompt')).toHaveText('Wir suchen jemanden für zwölf bis sechzehn Stunden pro Woche. Wäre das für Sie möglich?');
  expect((await app.readState()).attempts[0]).toMatchObject({ inputMode: 'aloud', outcome: 'independent', hintUsed: false });
  await fitsViewport(page);
  await page.screenshot({ path: info.outputPath('workplace-session.png'), fullPage: true });
});

test('short sessions display only their actual phases and retain the reading alternative', async ({ page }) => {
  const app = new PracticePage(page);
  await app.open();
  await app.chooseShortGoal();
  await page.getByRole('button', { name: 'Start this mission', exact: true }).click();
  const stages = page.getByRole('list', { name: 'Session stages', exact: true });
  await expect(stages.getByRole('listitem')).toHaveCount(6);
  await expect(stages).not.toContainText('Shadow');
  await expect(stages.locator('[aria-current="step"]')).toContainText('Brief');
  await page.getByRole('button', { name: 'Begin with listening' }).click();
  await expect(stages.locator('[aria-current="step"]')).toContainText('Listen');
  await expect(page.locator('.lesson-heading')).toContainText('Checked locally');
  await page.getByRole('button', { name: 'Use the reading alternative / show transcript' }).click();
  await expect(page.locator('#transcript')).toBeVisible();
  await page.reload();
  await expect(page.locator('#transcript')).toBeVisible();
  await fitsViewport(page);
});

test('workplace Today previews the active resource and resumes its saved response', async ({ page }, info) => {
  const app = new PracticePage(page);
  await app.open();
  await page.goto('/#resource/dw-phone');
  await page.getByRole('button', { name: 'Start guided activity', exact: true }).click();
  await expect(page).toHaveURL(/#session\//);
  const sessionUrl = page.url();
  await page.getByText('Optional notes or transcript', { exact: true }).click();
  await page.getByLabel('Write what you said, or keep a few key words.').fill('Guten Tag, bitte rufen Sie mich zurück.');
  await page.getByRole('link', { name: 'Today', exact: true }).click();
  const preview = page.getByRole('region', { name: 'Practice preview', exact: true });
  await expect(preview).toContainText('Sprich eine Nachricht von 30 Sekunden');
  await expect(preview).toContainText('Unscored practice');
  await responsivePair(page, page.locator('.workplace-focus-main'), preview);
  await expect(page.locator('.daily-card')).toContainText('Measured');
  await page.screenshot({ path: info.outputPath('workplace-today.png'), fullPage: true });
  await page.getByRole('button', { name: 'Resume · step 1', exact: true }).click();
  await expect(page).toHaveURL(sessionUrl);
  await expect(page.getByLabel('Write what you said, or keep a few key words.')).toHaveValue('Guten Tag, bitte rufen Sie mich zurück.');
  expect((await app.readState()).attempts).toHaveLength(0);
});

test('resource catalog has a responsive practice rail, honest source notes and recoverable filters', async ({ page }, info) => {
  const app = new PracticePage(page);
  await app.open();
  await page.goto('/#resources');
  await responsivePair(page, page.getByRole('region', { name: 'Resource catalog', exact: true }), page.getByRole('complementary', { name: 'Your resource practice', exact: true }));
  await expect(page.getByText('15 resources match your filters', { exact: true })).toBeVisible();
  await page.getByLabel('Search resources').fill('not-a-resource');
  await expect(page.getByRole('heading', { name: 'No matching resources' })).toBeVisible();
  await page.getByRole('button', { name: 'Clear resource filters', exact: true }).click();
  await expect(page.getByLabel('Search resources')).toHaveValue('');
  await page.getByLabel('Search resources').fill('Am Telefon');
  await page.getByRole('button', { name: 'Save Deutschtrainer 69: Am Telefon', exact: true }).click();
  await page.getByLabel('Search resources').fill('');
  await page.getByRole('checkbox', { name: 'Saved resources only' }).check();
  await expect(page.getByText('1 resource matches your filters', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('checkbox', { name: 'Saved resources only' }).check();
  await expect(page.getByRole('button', { name: 'Unsave Deutschtrainer 69: Am Telefon', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('checkbox', { name: 'Saved resources only' }).uncheck();
  await page.getByLabel('Search resources').fill('Tätigkeiten im Büro');
  await expect(page.getByRole('article')).toContainText('Publisher access needs a manual check');
  await expect(page.getByRole('article')).not.toContainText('Checked locally');
  await fitsViewport(page);
  await page.screenshot({ path: info.outputPath('resource-catalog.png'), fullPage: true });
});

test('guided resource workspace retains offline drafts, attributed phrases and separate outside time', async ({ page, context }, info) => {
  const app = new PracticePage(page);
  await app.open();
  await page.goto('/#resource/dw-phone');
  await responsivePair(page, page.getByRole('region', { name: 'Publisher source', exact: true }), page.getByRole('region', { name: 'Guided follow-up', exact: true }));
  await page.getByRole('button', { name: 'Start guided activity', exact: true }).click();
  const response = page.getByRole('region', { name: 'Your German response', exact: true });
  await responsivePair(page, response, page.getByRole('complementary', { name: 'Source and phrase workspace', exact: true }));
  await expect(response).toContainText('Unscored practice');
  await expect(page.getByRole('button', { name: 'Save response & complete activity' })).toBeDisabled();
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.reload();
  await context.setOffline(true);
  await expect(page.getByRole('link', { name: 'Open original resource' })).toHaveAttribute('aria-disabled', 'true');
  await page.getByText('Optional notes or transcript', { exact: true }).click();
  await page.getByLabel('Write what you said, or keep a few key words.').fill('Könnten Sie mich morgen zurückrufen?');
  await page.getByLabel('Minutes studied on the publisher’s site (optional)').fill('12');
  await page.reload();
  await expect(page.getByLabel('Write what you said, or keep a few key words.')).toHaveValue('Könnten Sie mich morgen zurückrufen?');
  await expect(page.getByLabel('Minutes studied on the publisher’s site (optional)')).toHaveValue('12');
  await page.getByText('Add a personal phrase', { exact: true }).click();
  await page.getByLabel('German phrase', { exact: true }).fill('Könnten Sie mich morgen zurückrufen?');
  await page.getByLabel('English meaning', { exact: true }).fill('Could you call me back tomorrow?');
  await page.getByRole('button', { name: 'Save phrase to my collection' }).click();
  await expect.poll(async () => (await app.readState()).personalPhrases.length).toBe(1);
  await page.getByRole('button', { name: 'Save response & complete activity' }).click();
  await expect(page.getByText('Practice response saved.', { exact: true })).toBeVisible();
  await expect(response).toContainText('12 minutes');
  await expect(response).toContainText('Self-reported');
  const state = await app.readState();
  expect(state.attempts).toHaveLength(1);
  expect(state.attempts[0]).toMatchObject({ kind: 'resource', outcome: 'unscored', inputMode: 'typed', externalMinutes: 12, recordingMs: 0 });
  expect(state.personalPhrases[0]).toMatchObject({ sourceId: 'dw-phone', sourceTitle: 'Deutschtrainer 69: Am Telefon' });
  expect(state.personalPhrases[0].sourceUrl).toContain('learngerman.dw.com');
  expect(state.sessions.filter(session => session.kind === 'mission' && session.completedAt)).toHaveLength(0);
  expect(state.activity.reduce((total, event) => total + event.ms, 0)).toBeLessThan(12 * 60_000);
  await fitsViewport(page);
  await page.screenshot({ path: info.outputPath('resource-activity.png'), fullPage: true });
  await context.setOffline(false);
});

test('workplace and resource content fits small phones and tablet widths', async ({ page }) => {
  const app = new PracticePage(page);
  await app.open();
  await page.getByRole('button', { name: 'Start this mission', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Begin with listening' })).toBeVisible();
  const sessionUrl = page.url();
  for (const width of [320, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [url, heading] of [
      [sessionUrl, 'Stell dich vor'],
      ['/#practice', 'A conversation worth having.'],
      ['/#resources', 'Listen, notice, then use it.'],
      ['/#resource/nicos-interview', 'Nicos Weg: Bewerbungsgespräch'],
      ['/#today', 'A little more confident, every day.'],
    ]) {
      await page.goto(url);
      await expect(page.getByRole('heading', { level: 1, name: heading, exact: true })).toBeVisible();
      await fitsViewport(page);
    }
  }
});
