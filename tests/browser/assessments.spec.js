import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { PracticePage } from './practice-page.js';
import { TEST_ACCESS_CODE } from '../../tools/mock-ai-provider.js';
import { assessmentRubric } from '../../shared/assessment-rubrics.js';

const pack = JSON.parse(await readFile(new URL('../../app/public/assessments/pilot-cafe-a-v1.json', import.meta.url), 'utf8'));
const definition = kind => pack.definitions.find(item => item.kind === kind);

class AssessmentPage {
  constructor(page) { this.page = page; this.storage = new PracticePage(page); }
  async unlock() {
    await this.page.goto('/#ai');
    await this.page.getByLabel('Owner access code').fill(TEST_ACCESS_CODE);
    await this.page.getByRole('button', { name: 'Unlock AI Talk', exact: true }).click();
    await expect(this.page.getByText('Unlocked', { exact: true })).toBeVisible();
  }
  async start(kind, { mode = 'practice', external = false } = {}) {
    await this.page.goto('/#assessments');
    await this.page.getByRole('combobox', { name: 'Assessment mode', exact: true }).selectOption(mode);
    const button = this.page.locator(`[data-start-assessment="${definition(kind).id}"]${external ? '[data-gemini-live]' : ':not([data-gemini-live])'}`);
    await button.click();
    await expect(this.page).toHaveURL(kind === 'roleplay' && !external ? /#ai\/session\// : external ? /#assessment-result\// : /#assessment\//);
  }
  async answer(text) {
    const details = this.page.locator('.notes-details');
    if (!await details.evaluate(element => element.open)) await details.getByText('Type a correction instead', { exact: true }).click();
    await this.page.locator('#ai-text').fill(text);
    await this.page.getByRole('button', { name: 'Send to partner', exact: true }).click();
    await expect(this.page.getByRole('log')).toContainText(text);
  }
  async state() { return this.storage.readState(); }
}

test('writing is sealed, graded once through the gateway, and retains model/test provenance', async ({ page }, info) => {
  const app = new AssessmentPage(page);
  await app.unlock();
  const calls = [];
  page.on('request', request => { if (request.method() === 'POST' && request.url().endsWith('/assessments/evaluations')) calls.push(request.postDataJSON()); });
  await app.start('writing', { mode: 'checkpoint' });
  const answer = 'Hallo Lea, möchtest du mit mir einen kleinen Tee trinken? Am Montag um zehn Uhr habe ich Zeit. Wir können uns im Café treffen. Passt das für dich? Viele Grüße, Sam';
  await page.getByRole('textbox', { name: 'Your German response', exact: true }).fill(answer);
  await page.getByRole('button', { name: 'Save for grading', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Response saved · awaiting a grade', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Grade with in-app AI', exact: true }).click();
  await expect(page.getByRole('heading', { name: '75%', exact: true })).toBeVisible();
  await expect(page.getByText('Test grader · fixture result', { exact: true })).toBeVisible();
  await expect(page.getByText('Submitted written text', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: '75%', exact: true })).toBeVisible();
  expect(calls).toHaveLength(1);
  expect(calls[0].submission.text).toBe(answer);
  const state = await app.state();
  expect(state.assessments.attempts[0].submission.text).toBe(answer);
  expect(state.assessments.evaluations[0]).toMatchObject({ source: 'gateway-ai', testMode: true, result: { percentage: 75 } });
  expect(state.attempts).toHaveLength(0);
  expect(state.starter.reviews).toHaveLength(0);
  await page.screenshot({ path: info.outputPath('writing-grade.png') });
  await page.getByRole('link', { name: 'Progress', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Assessment results', exact: true })).toBeVisible();
  await expect(page.locator(`a[href="#assessment-result/${state.assessments.attempts[0].id}"]`)).toHaveCount(0);
});

test('an A1 assessed roleplay retains only real learner replies and sends a sealed complete segment', async ({ page }) => {
  const app = new AssessmentPage(page);
  await app.unlock(); await app.start('roleplay', { mode: 'checkpoint' });
  await expect(page.getByRole('heading', { name: definition('roleplay').title, exact: true })).toBeVisible();
  await expect(page.locator('[data-op="hint"]')).toBeDisabled();
  await page.locator('[data-op="rephrase"]').click();
  await expect.poll(async () => (await app.state()).aiSessions[0].turns.length).toBe(1);
  await expect(page.getByRole('button', { name: 'End & grade', exact: true })).toBeDisabled();
  for (const answer of ['Ich möchte einen kleinen Tee, bitte.', 'Klein, bitte.', 'Mit Karte, danke.']) await app.answer(answer);
  await expect(page.locator('[data-evidence-ref] .meaning')).toHaveCount(0);
  await page.getByRole('button', { name: 'End & grade', exact: true }).click();
  await expect(page).toHaveURL(/#assessment-result\//);
  await expect(page.getByRole('heading', { name: '75%', exact: true })).toBeVisible();
  await expect(page.getByText('Typed conversation · not speaking evidence', { exact: true })).toBeVisible();
  const state = await app.state();
  const submitted = state.assessments.attempts[0];
  expect(submitted.submission.turns.filter(turn => turn.role === 'learner')).toHaveLength(3);
  expect(submitted.submission.turns.filter(turn => turn.role === 'control')).toHaveLength(1);
  expect(submitted.submission.events).toContainEqual(expect.objectContaining({ kind: 'question_rephrase' }));
  expect(state.aiSessions[0].endedAt).toBeTruthy();
  expect(state.attempts).toHaveLength(0);
});

test('Gemini Live imports validate binding and arithmetic and repeated reports do not add grades', async ({ page }) => {
  const app = new AssessmentPage(page);
  await app.start('roleplay', { external: true });
  await expect(page.getByRole('heading', { name: 'Ready for your Gemini roleplay', exact: true })).toBeVisible();
  const state = await app.state(); const attempt = state.assessments.attempts[0];
  const def = definition('roleplay');
  const report = { app: 'sprich-assessment', schemaVersion: 1, attemptId: attempt.id, definitionId: def.id, definitionVersion: def.version,
    rubricId: def.rubricId, scope: 'external-live', bindingHash: attempt.exportContextHash, reportedPercent: 99,
    result: { ratings: assessmentRubric(def.rubricId).criteria.map(([id]) => ({ id, score: 3, reasonEn: 'Reported practice feedback.', evidence: [{ refId: null, quote: 'Einen kleinen Tee, bitte.' }] })),
      strengths: ['The requested drink was clear.'], corrections: [], retryDe: 'Bestellen Sie ein anderes Getränk.', retryEn: 'Order a different drink.' } };
  const input = page.getByRole('textbox', { name: 'Gemini assessment report', exact: true });
  await input.fill(JSON.stringify({ ...report, attemptId: 'different-attempt' }));
  await page.getByRole('button', { name: 'Check report', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('attemptId mismatch');
  expect((await app.state()).assessments.evaluations).toHaveLength(0);
  for (let index = 0; index < 2; index++) {
    await input.fill(JSON.stringify(report));
    await page.getByRole('button', { name: 'Check report', exact: true }).click();
    await page.getByRole('button', { name: 'Save imported grade', exact: true }).click();
    await expect(page.getByRole('heading', { name: '75%', exact: true })).toBeVisible();
  }
  await expect(page.getByText('Imported Gemini assessment', { exact: true })).toBeVisible();
  await expect(page.getByText('External Live performance · reported, not verified', { exact: true })).toBeVisible();
  const saved = await app.state();
  expect(saved.assessments.evaluations).toHaveLength(1);
  expect(saved.assessments.evaluations[0].result.percentage).toBe(75);
  expect(saved.assessments.attempts[0].state).toBe('submitted');
  expect(saved.attempts).toHaveLength(0);
  expect(saved.starter.reviews).toHaveLength(0);
});

test('an opened assessment and its lazy code reload offline and still produce a local grade', async ({ page, context }) => {
  const app = new AssessmentPage(page);
  await app.start('objective');
  await expect.poll(() => page.evaluate(() => document.body.dataset.assessmentOfflineReady)).toBe('true');
  const input = page.locator('[data-assessment-item="cafe.a.vocab.size"]').getByRole('textbox', { name: 'Your answer', exact: true });
  await input.fill('klein');
  await expect(page.locator('[data-assessment-save-status]')).toHaveText('Draft saved on this device');
  await context.setOffline(true);
  await page.reload();
  await expect(input).toHaveValue('klein');
  await page.getByRole('button', { name: 'Submit answers', exact: true }).click();
  await expect(page).toHaveURL(/#assessment-result\//);
  await expect(page.getByText('Checked locally', { exact: true })).toBeVisible();
  const state = await app.state();
  expect(state.assessments.evaluations[0].source).toBe('local-key');
  expect(state.assessments.evaluations[0].result.earned).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
});
