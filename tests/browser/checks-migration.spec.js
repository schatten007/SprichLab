import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { PracticePage } from './practice-page.js';
import { assessmentRubric } from '../../shared/assessment-rubrics.js';
import { TEST_ACCESS_CODE } from '../../tools/mock-ai-provider.js';

const pack = JSON.parse(await readFile(new URL('../../app/public/assessments/pilot-cafe-a-v1.json', import.meta.url), 'utf8'));
const definition = kind => pack.definitions.find(item => item.kind === kind);
const state = page => new PracticePage(page).readState();

async function start(page, kind, { mode = 'practice', external = false } = {}) {
  await page.goto('/#assessments');
  await page.getByRole('combobox', { name: 'Assessment mode', exact: true }).selectOption(mode);
  await page.locator(`[data-start-assessment="${definition(kind).id}"]${external ? '[data-gemini-live]' : ':not([data-gemini-live])'}`).click();
  await expect(page).toHaveURL(external ? /#assessment-result\// : /#assessment\//);
}

async function noOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
}

async function columnsOrStack(page, first, second) {
  const a = await first.boundingBox(); const b = await second.boundingBox();
  expect(a).not.toBeNull(); expect(b).not.toBeNull();
  if (page.viewportSize().width >= 1200) {
    expect(b.x).toBeGreaterThanOrEqual(a.x + a.width);
    expect(Math.abs(a.y - b.y)).toBeLessThan(3);
  } else {
    expect(b.y).toBeGreaterThanOrEqual(a.y + a.height);
    expect(Math.abs(a.x - b.x)).toBeLessThan(3);
  }
  await noOverflow(page);
}

test('catalog has a responsive filter rail, real empty state, pagination and usable saved attempts', async ({ page }, info) => {
  await page.goto('/#assessments');
  await expect(page.getByRole('heading', { name: 'Checks and graded roleplays', exact: true })).toBeVisible();
  const filters = page.locator('.assessment-filters');
  const catalog = page.locator('.assessment-catalog-body');
  await expect(filters).toBeVisible();
  await columnsOrStack(page, filters, catalog);
  await expect(page.locator('#assessment-list article')).toHaveCount(12);
  await page.getByRole('button', { name: 'Show more assessments', exact: true }).click();
  await expect(page.locator('#assessment-list article')).toHaveCount(24);
  await page.getByRole('combobox', { name: 'Skill', exact: true }).selectOption('writing');
  await expect(page.locator('#assessment-count')).toHaveText('4 of 4 matching assessments');
  await page.getByRole('combobox', { name: 'Target level', exact: true }).selectOption('A1');
  await expect(page.locator('#assessment-count')).toHaveText('2 of 2 matching assessments');
  await page.getByRole('textbox', { name: 'Find an assessment', exact: true }).fill('nothing-matches-this');
  await expect(page.getByText('No matching assessments. Try another filter.', { exact: true })).toBeVisible();
  await expect(page.locator('#assessment-more')).toBeHidden();
  await page.getByRole('textbox', { name: 'Find an assessment', exact: true }).fill('');
  await page.getByRole('combobox', { name: 'Assessment mode', exact: true }).selectOption('checkpoint');
  await page.locator(`[data-start-assessment="${definition('writing').id}"]`).click();
  await page.getByRole('textbox', { name: 'Your German response', exact: true }).fill('Hallo Mia!');
  const id = (await state(page)).assessments.attempts.at(-1).id;
  await page.getByRole('link', { name: 'Back to Lessons', exact: true }).click();
  await page.goto('/#assessments');
  await page.locator(`#assessment-history a[href="#assessment/${id}"]`).click();
  await expect(page.getByRole('textbox', { name: 'Your German response', exact: true })).toHaveValue('Hallo Mia!');
  expect((await state(page)).assessments.attempts[0].mode).toBe('checkpoint');
  await page.goto('/#assessments');
  await page.screenshot({ path: info.outputPath('checks-catalog.png'), fullPage: true });
  for (const width of [768, 360]) {
    await page.setViewportSize({ width, height: 900 });
    await columnsOrStack(page, filters, catalog);
  }
});

test('practice workspace tracks filled items, keeps keyboard tokens and records help with the local result', async ({ page }, info) => {
  await start(page, 'objective');
  const progress = page.getByRole('progressbar', { name: 'Items filled', exact: true });
  await expect(progress).toHaveAttribute('max', '15');
  await expect(progress).toHaveAttribute('value', '0');
  await columnsOrStack(page, page.locator('[data-assessment-fields]'), page.locator('.assessment-submit'));
  const question = page.locator('[data-assessment-item="cafe.a.vocab.tea"]');
  await question.getByRole('radio', { name: 'der Tee', exact: true }).check();
  await expect(progress).toHaveAttribute('value', '1');
  const order = page.locator('[data-assessment-item="cafe.a.grammar.order"]');
  const token = order.getByRole('button', { name: 'Add token 2: Kann', exact: true });
  await token.focus(); await page.keyboard.press('Enter');
  await expect(token).toBeFocused();
  await expect(order.getByRole('listitem')).toHaveText(['Kann']);
  await order.getByRole('button', { name: 'Reset order', exact: true }).click();
  await expect(order.getByRole('listitem')).toHaveCount(0);
  await question.getByRole('button', { name: 'Reveal answer', exact: true }).click();
  await expect(question.getByRole('region', { name: 'Revealed answer', exact: true })).toBeVisible();
  await page.locator('[data-assessment-translation]').first().click();
  await expect(page.locator('[data-assessment-translation-content]').first()).toBeVisible();
  await page.getByRole('button', { name: 'Pause practice timer', exact: true }).click();
  await expect(page.locator('[data-assessment-clock]')).toContainText('paused');
  await page.getByRole('button', { name: 'Resume practice timer', exact: true }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: info.outputPath('checks-run.png') });
  await page.getByRole('button', { name: 'Submit answers', exact: true }).click();
  await expect(page.locator('[data-assessment-score]')).toHaveText('5%');
  await expect(page.getByText('Checked locally', { exact: true })).toBeVisible();
  await expect(page.getByText('Answer help recorded', { exact: true })).toBeVisible();
  const saved = (await state(page)).assessments;
  expect(saved.attempts[0].submission.events.map(event => event.kind)).toEqual(['answer_reveal', 'question_translation']);
  expect(saved.evaluations[0].result).toMatchObject({ earned: 1, maximum: 20, percentage: 5 });
  await noOverflow(page);
});

test('checkpoint result pairs honest score and feedback, then retries without changing the sealed submission', async ({ page }, info) => {
  await start(page, 'objective', { mode: 'checkpoint' });
  await expect(page.getByRole('progressbar', { name: 'Items filled', exact: true })).toHaveAttribute('value', '0');
  await expect(page.locator('[data-assessment-reveal], [data-assessment-translation], [data-assessment-answer]')).toHaveCount(0);
  await expect(page.locator('#assessment-instructions')).toHaveText(definition('objective').instructions);
  for (const stimulus of definition('objective').stimuli) await expect(page.getByText(stimulus.en, { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Submit answers', exact: true }).click();
  await expect(page.locator('[data-assessment-score]')).toHaveText('0%');
  const saved = (await state(page)).assessments;
  await expect(page.getByText('No answer help recorded', { exact: true })).toBeVisible();
  const summary = page.locator('.assessment-score'); const feedback = page.locator('.assessment-feedback');
  await expect(feedback).toBeVisible();
  await columnsOrStack(page, summary, feedback);
  await feedback.locator('details').first().locator('summary').click();
  await expect(feedback.getByText('Your answer:', { exact: true }).first()).toBeVisible();
  await expect(feedback.getByText('Unanswered', { exact: false }).first()).toBeVisible();
  await expect(feedback.getByText('Accepted:', { exact: true }).first()).toBeVisible();
  await page.screenshot({ path: info.outputPath('checks-result.png') });
  await page.goto(`/#assessment/${saved.attempts[0].id}`);
  await expect(page.locator('[data-assessment-score]')).toHaveText('0%');
  await expect(page.locator('[data-assessment-form]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Try a new attempt', exact: true }).click();
  await expect(page.locator('[data-assessment-run]')).toBeVisible();
  const retried = (await state(page)).assessments;
  expect(retried.attempts).toHaveLength(2);
  expect(retried.attempts.find(attempt => attempt.id === saved.attempts[0].id)).toEqual(saved.attempts[0]);
  expect(retried.evaluations).toEqual(saved.evaluations);
  expect(retried.attempts.find(attempt => attempt.id !== saved.attempts[0].id).parentAttemptId).toBe(saved.attempts[0].id);
});

test('writing workspace retains advisory counts and separates sealed evidence from grading actions', async ({ page }, info) => {
  await start(page, 'writing');
  await expect(page.locator('.assessment-workspace')).toBeVisible();
  await columnsOrStack(page, page.locator('[data-assessment-fields]'), page.locator('.assessment-submit'));
  const response = '\nHallo Mia, hast du am Montag Zeit?';
  const input = page.getByRole('textbox', { name: 'Your German response', exact: true });
  await input.fill(response);
  await expect(page.locator('[data-assessment-word-count]')).toContainText('7 words');
  await expect(page.locator('[data-assessment-word-count]')).toContainText('Below the suggested range');
  await page.reload();
  await expect(input).toHaveValue(response);
  await page.screenshot({ path: info.outputPath('checks-writing.png') });
  await page.getByRole('button', { name: 'Save for grading', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Response saved · awaiting a grade', exact: true })).toBeVisible();
  await expect(page.locator('[data-assessment-score]')).toHaveCount(0);
  await columnsOrStack(page, page.locator('#assessment-artifact'), page.locator('#assessment-job'));
  await page.getByText('Your sealed writing', { exact: true }).click();
  await expect(page.locator('#assessment-artifact [lang="de"]')).toHaveText(response);
  await expect(page.locator('[data-grade-pack]')).toHaveValue(new RegExp('GRADE THE SUBMITTED ARTIFACT NOW'));
  const saved = (await state(page)).assessments;
  expect(saved.attempts[0].submission.text).toBe(response);
  expect(saved.attempts[0].draft).toBeNull();
  expect(saved.evaluations).toEqual([]); expect(saved.jobs).toEqual([]);
  await noOverflow(page);
});

test('Gemini handoff keeps partial criteria unobserved and validates edits, binding and duplicate imports', async ({ page }, info) => {
  await start(page, 'roleplay', { external: true });
  await expect(page.locator('.assessment-handoff-grid')).toBeVisible();
  await columnsOrStack(page, page.locator('.assessment-handoff-pack'), page.locator('.assessment-handoff-report'));
  const attempt = (await state(page)).assessments.attempts[0]; const def = definition('roleplay');
  const report = { app: 'sprich-assessment', schemaVersion: 1, attemptId: attempt.id, definitionId: def.id, definitionVersion: def.version,
    rubricId: def.rubricId, scope: 'external-live', bindingHash: attempt.exportContextHash, reportedPercent: 99,
    result: { ratings: assessmentRubric(def.rubricId).criteria.map(([id], index) => ({ id, score: index === 0 ? 3 : null,
      reasonEn: index === 0 ? 'The drink order was reported clearly.' : 'No learner evidence for this criterion.',
      evidence: index === 0 ? [{ refId: null, quote: 'Einen kleinen Tee, bitte.' }] : [] })),
    strengths: ['The drink order was clear.'], corrections: [], retryDe: 'Bestellen Sie ein anderes Getränk.', retryEn: 'Order a different drink.' } };
  const input = page.getByRole('textbox', { name: 'Gemini assessment report', exact: true });
  const check = page.getByRole('button', { name: 'Check report', exact: true });
  const save = page.getByRole('button', { name: 'Save imported grade', exact: true });
  await input.fill(JSON.stringify(report)); await check.click();
  await expect(page.locator('[data-grade-import-preview]')).toContainText('Partial / insufficient evidence');
  await expect(save).toBeVisible();
  await input.fill(JSON.stringify({ ...report, bindingHash: '0'.repeat(64) }));
  await expect(save).toBeHidden();
  await check.click();
  await expect(page.locator('[data-grade-import-preview]')).toContainText('bindingHash mismatch');
  expect((await state(page)).assessments.evaluations).toEqual([]);
  for (let count = 0; count < 2; count++) {
    await input.fill(JSON.stringify(report)); await check.click(); await save.click();
    await expect(page.locator('[data-assessment-score]')).toHaveText('Not enough evidence for a complete score');
  }
  await expect(page.getByRole('heading', { name: /Not observed/ })).toHaveCount(4);
  await expect(page.getByRole('heading', { name: /0\/4|99%/ })).toHaveCount(0);
  await expect(page.getByText('Imported Gemini assessment', { exact: true })).toBeVisible();
  await expect(page.getByText('External Live performance · reported, not verified', { exact: true })).toBeVisible();
  await columnsOrStack(page, page.locator('.assessment-score'), page.locator('.assessment-feedback'));
  const saved = (await state(page)).assessments;
  expect(saved.evaluations).toHaveLength(1);
  // The published rubric has five criteria, four points each; one observed 3 is partial 3/20.
  expect(saved.evaluations[0].result).toMatchObject({ earned: 3, maximum: 20, percentage: null });
  await page.screenshot({ path: info.outputPath('checks-partial-result.png'), fullPage: true });
  await input.fill(JSON.stringify({ ...report, result: { ...report.result, strengths: ['A different report.'] } }));
  await check.click();
  await expect(page.locator('[data-grade-import-preview]')).toContainText('already submitted with a different report');
  expect((await state(page)).assessments.evaluations).toEqual(saved.evaluations);
  await noOverflow(page);
});

test('grading recovery keeps the saved artifact and fetches the original receipt without another generation', async ({ page }) => {
  await page.goto('/#ai');
  await page.getByLabel('Owner access code').fill(TEST_ACCESS_CODE);
  await page.getByRole('button', { name: 'Unlock AI Talk', exact: true }).click();
  await expect(page.getByText('Unlocked', { exact: true })).toBeVisible();
  await start(page, 'writing');
  await page.getByRole('textbox', { name: 'Your German response', exact: true }).fill('Hallo Mia, hast du am Montag Zeit für einen Tee?');
  await page.getByRole('button', { name: 'Save for grading', exact: true }).click();
  await expect(page.locator('.assessment-result-tools')).toBeVisible();
  let posts = 0;
  await page.route('**/api/v1/assessments/evaluations', async route => {
    posts++;
    const response = await route.fetch();
    expect(response.ok()).toBe(true);
    await route.abort('failed');
  });
  await page.getByRole('button', { name: 'Grade with in-app AI', exact: true }).click();
  const recover = page.getByRole('button', { name: 'Check for my grade', exact: true });
  await expect(recover).toBeVisible();
  await expect(page.locator('[data-assessment-score]')).toHaveCount(0);
  const before = (await state(page)).assessments;
  await recover.click();
  await expect(page.locator('[data-assessment-score]')).toHaveText('75%');
  await expect(page.getByText('Test grader · fixture result', { exact: true })).toBeVisible();
  // The fixture exposes its configured model ID, which is not required to contain “mock”.
  await expect(page.getByText(/Model:/i)).toBeVisible();
  const after = (await state(page)).assessments;
  expect(posts).toBe(1);
  expect(after.jobs).toHaveLength(1); expect(after.jobs[0].id).toBe(before.jobs[0].id);
  expect(after.attempts[0].submission).toEqual(before.attempts[0].submission);
  expect(after.attempts[0].submissionHash).toBe(before.attempts[0].submissionHash);
  await noOverflow(page);
});
