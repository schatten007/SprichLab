import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { newState, dateKey, validateState } from '../../app/js/model.js';
import { MISSIONS } from '../../app/data/missions.js';
import { createSession, tasksFor, draftFor, makeAttempt } from '../../app/js/session.js';
import { createResourceSession, resourceAttempt } from '../../app/js/resources.js';
import { RESOURCES } from '../../app/data/resources.js';
import { parsePack, starterSnapshot } from '../../app/js/starter-content.js';
import { createStarterSession, starterSteps, starterDraft, starterResponse, createWordSession, wordReview } from '../../app/js/starter-state.js';
import { prepareAssessmentAttempt, addPreparedAssessment, prepareAssessmentSubmission, saveSealedAssessment, addAssessmentEvaluation } from '../../app/js/assessment-state.js';
import { rubricEvaluation } from '../../shared/assessment-results.js';
import { PracticePage } from './practice-page.js';

const NOW = Date.parse('2026-10-21T12:00:00Z');
const MINUTE = 60_000;
const DAY = 86_400_000;
const course = parsePack(JSON.parse(await readFile(new URL('../../app/public/course/starter-2026.10-1.json', import.meta.url), 'utf8')));
const assessmentPack = JSON.parse(await readFile(new URL('../../app/public/assessments/pilot-cafe-a-v1.json', import.meta.url), 'utf8'));
const labels = ['Measured', 'Self-rated', 'Checked locally', 'Self-reported', 'AI estimate', 'Imported Gemini assessment'];

async function populatedState() {
  const state = newState(NOW - 3 * DAY, 'UTC');
  state.preferences.dailyMinutes = 30;
  for (const [id, missionId, time, recordingMs] of [
    ['first', MISSIONS[0].id, NOW - 2 * DAY, 60_000],
    ['other', MISSIONS[1].id, NOW - DAY, 10_000],
    ['recent', MISSIONS[0].id, NOW - MINUTE, 30_000],
    ['typed', MISSIONS[0].id, NOW - 2 * MINUTE, 0],
  ]) {
    const session = createSession(state, missionId, { id, now: time });
    const task = tasksFor(session).find(item => item.id === 'intro') ?? tasksFor(session).find(item => item.kind === 'speak');
    const draft = { ...draftFor(session, task.id), text: 'Ich studiere Informatik.', recordingMs, criteria: task.criteria };
    session.cursor = tasksFor(session).findIndex(item => item.id === task.id);
    if (id === 'first') session.completedAt = time + MINUTE;
    state.sessions.push(session);
    state.attempts.push(makeAttempt(session, task, draft, 'helped', 'UTC', time));
  }
  for (const [offset, count] of [[0, 11], [1, 20]]) {
    for (let index = 0; index < count; index++) {
      const start = NOW - offset * DAY - (index + 1) * MINUTE;
      state.activity.push({ id: `time-${offset}-${index}`, sessionId: 'recent', start, end: start + MINUTE,
        day: dateKey(start, 'UTC'), ms: MINUTE });
    }
  }
  state.activity.push({ ...state.activity[0], id: 'overlapping-window' });

  const beginner = createStarterSession(starterSnapshot(course, 'starter-hello'), { id: 'beginner', now: NOW - DAY });
  for (const task of starterSteps(beginner).filter(item => ['warmup', 'speak'].includes(item.kind))) {
    beginner.responses.push(starterResponse(beginner, task, { ...starterDraft(), aloud: true,
      recordingMs: task.id === 'warmup' ? 20_000 : 0, recordingKey: task.id === 'warmup' ? 'beginner-audio' : '' },
    task.kind === 'warmup' ? 'unscored' : 'independent', NOW - DAY));
  }
  beginner.completedAt = NOW - DAY;
  state.starter.sessions.push(beginner);
  for (const mode of ['recall', 'meaning']) {
    const word = course.words[mode === 'recall' ? 0 : 1];
    const session = createWordSession([word], mode, { id: `words-${mode}`, now: NOW - DAY });
    state.starter.reviews.push(wordReview(session, word, { ...starterDraft(), attempted: true, revealed: true,
      aloud: mode === 'recall' }, 'independent', dateKey(NOW, 'UTC'), NOW));
    session.cursor = 1; session.completedAt = NOW;
    state.starter.wordSessions.push(session);
  }
  const resource = createResourceSession(state, RESOURCES[0].id, { id: 'resource', now: NOW - DAY });
  state.sessions.push(resource);
  state.attempts.push(resourceAttempt(resource, { ...draftFor(resource, 'resource'), text: 'Eine neue Frage.', externalMinutes: 13 }, 'UTC', NOW));
  state.companionNotes.push({ id: 'takeaway', missionId: 'starter-hello', minutes: 7, createdAt: NOW,
    text: '<b>Bitte wiederholen.</b> ' + 'Wiederholungsfrage'.repeat(16) });
  state.starter.plans.push({ id: '2026-10-21', lessonId: 'starter-hello', wordIds: [], reflection: 'Ask one more question.', createdAt: NOW, updatedAt: NOW });

  for (const [id, source, testMode] of [['local', 'local-key', false], ['ai', 'gateway-ai', false], ['import', 'gemini-import', false], ['fixture', 'gateway-ai', true]]) {
    const definition = assessmentPack.definitions.find(item => item.kind === (source === 'local-key' ? 'objective' : 'writing'));
    const prepared = await prepareAssessmentAttempt(definition, { attemptId: id, mode: 'practice', now: NOW });
    prepared.attempt.draft.text = source === 'local-key' ? '' : 'Hallo Mia, möchtest du am Montag einen Kaffee trinken?';
    state.assessments = addPreparedAssessment(state.assessments, prepared);
    state.assessments = saveSealedAssessment(state.assessments, await prepareAssessmentSubmission(prepared.attempt, definition), NOW);
    if (source !== 'local-key') {
      const attempt = state.assessments.attempts.find(item => item.id === id);
      const raw = { ratings: ['task', 'organisation', 'vocabulary', 'grammar', 'mechanics'].map((criterion, index) => ({
        id: criterion, score: source === 'gemini-import' && index === 4 ? null : 2,
        reasonEn: 'Evidence from the submitted text.', evidence: source === 'gemini-import' && index === 4 ? [] : [{ refId: 'writing', quote: 'Hallo Mia' }],
      })), strengths: [], corrections: [], retryDe: 'Frage nach der Uhrzeit.', retryEn: 'Ask about the time.' };
      state.assessments = addAssessmentEvaluation(state.assessments, rubricEvaluation({ requestId: `grade-${id}`, attemptId: id,
        definitionHash: attempt.definitionHash, submissionHash: attempt.submissionHash, mode: attempt.mode, definition,
        submission: attempt.submission, raw, source, model: 'Browser test', promptVersion: '1', testMode, now: NOW }), NOW);
    }
  }
  return validateState(state);
}

async function seed(page, state, withAudio = false) {
  await page.clock.setFixedTime(new Date(NOW));
  await page.goto('/#progress');
  await expect(page.getByRole('heading', { name: 'Notice what is getting easier.' })).toBeVisible();
  await page.evaluate(async ({ state, withAudio }) => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('sprich-german-v2');
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    let blob;
    if (withAudio) {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      try {
        const recorder = new MediaRecorder(stream);
        const chunks = [];
        recorder.ondataavailable = event => chunks.push(event.data);
        const stopped = new Promise(resolve => { recorder.onstop = resolve; });
        recorder.start(); await new Promise(resolve => { setTimeout(resolve, 250); }); recorder.stop(); await stopped;
        blob = new Blob(chunks, { type: recorder.mimeType });
      } finally { stream.getTracks().forEach(track => track.stop()); }
    }
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(['meta', 'recordings'], 'readwrite');
        tx.objectStore('meta').put(state, 'state');
        if (blob) for (const key of ['first:intro', 'recent:intro', 'beginner-audio']) tx.objectStore('recordings').put(blob, key);
        tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
      });
    } finally { db.close(); }
  }, { state, withAudio });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Notice what is getting easier.' })).toBeVisible();
}

async function noOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  for (const box of await page.locator('.evidence-card, .evidence-day, .comparison-item, .history-item').all()) {
    if (await box.isVisible()) expect(await box.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
  }
}

test('empty evidence shows six honest sources, a zero week and useful next actions', async ({ page }, info) => {
  await seed(page, newState(NOW, 'UTC'));
  const before = await new PracticePage(page).readState();
  const cards = page.locator('.evidence-grid > .evidence-card');
  await expect(cards).toHaveCount(6);
  for (const label of labels) await expect(cards.getByText(label, { exact: true })).toBeVisible();
  await expect(page.locator('.evidence-week .evidence-day')).toHaveCount(7);
  await expect(page.locator('.evidence-day strong')).toHaveText(Array(7).fill('0 min'));
  await expect(page.locator('.progress-kpis')).toContainText('0 min');
  await expect(page.getByRole('progressbar', { name: /Today's goal/ })).toHaveAttribute('aria-valuenow', '0');
  await expect(page.getByText('Your first submitted check or imported grade will appear here.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your voice is the baseline.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Choose a mission', exact: true })).toHaveAttribute('href', '#practice');
  await page.getByText('Details and saved practice', { exact: true }).click();
  await expect(page.getByText('Your first completed exercise will appear here.')).toBeVisible();
  await expect(page.getByText('Save a Gemini or daily takeaway to revisit it here.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Export progress', exact: true }).first()).toHaveAttribute('href', '#settings');
  await noOverflow(page);
  await page.screenshot({ path: info.outputPath('evidence-empty.png'), fullPage: true });
  expect(await new PracticePage(page).readState()).toEqual(before);
});

test('populated evidence keeps measured, reported, self-rated and graded results distinct', async ({ page }, info) => {
  await seed(page, await populatedState());
  const before = await new PracticePage(page).readState();
  const measured = page.locator('.evidence-card[data-source="measured"]');
  await expect(measured).toContainText('31 min');
  await expect(measured).toContainText('2 min');
  await expect(page.locator('.evidence-day strong')).toHaveText(['0 min', '0 min', '0 min', '0 min', '0 min', '20 min', '11 min']);
  await expect(page.getByRole('progressbar', { name: /Today's goal/ })).toHaveAttribute('aria-valuenow', '37');
  const self = page.locator('.evidence-card[data-source="self-rated"]');
  await expect(self).toContainText('1 / 48');
  await expect(self.locator('[data-metric="recalled"]')).toHaveText('1');
  await expect(self.locator('[data-metric="spoken"]')).toHaveText('8');
  await expect(page.locator('.evidence-card[data-source="reported"]')).toContainText('13 min');
  await expect(page.locator('.evidence-card[data-source="reported"]')).toContainText('7 min');
  for (const source of ['checked', 'ai', 'external']) {
    await expect(page.locator(`.evidence-card[data-source="${source}"] [data-metric="grades"]`)).toHaveText('1');
  }
  const results = page.locator('.evidence-results a[href^="#assessment-result/"]');
  await expect(results).toHaveCount(3);
  for (const [id, source, score] of [['local', 'Checked locally', '0%'], ['ai', 'AI estimate', '50%'], ['import', 'Imported Gemini assessment', 'Partial']]) {
    const result = page.locator(`.evidence-results a[href="#assessment-result/${id}"]`);
    await expect(result).toContainText(source);
    await expect(result).toContainText(score);
    await expect(result).toContainText('practice');
    await expect(result).toContainText('No answer help recorded');
  }
  await page.getByText('Details and saved practice', { exact: true }).click();
  await expect(page.locator('.history-item[href="#session/first"]')).toContainText('Completed');
  await expect(page.locator('.history-item[href="#session/recent"]')).toContainText('In progress');
  await expect(page.locator('.history-item[href="#learn/beginner"]')).toContainText('Completed');
  await expect(page.locator('.history-item[href="#word-session/words-recall"]')).toContainText('Completed');
  await expect(page.locator('.takeaway').first()).toContainText('<b>Bitte wiederholen.</b>');
  await expect(page.locator('.takeaway b')).toHaveCount(0);
  await expect(page.getByText('Ask one more question.', { exact: true })).toBeVisible();
  await noOverflow(page);
  await page.screenshot({ path: info.outputPath('evidence-populated.png'), fullPage: true });
  expect(await new PracticePage(page).readState()).toEqual(before);
  await page.locator('.history-item[href="#session/recent"]').click();
  await expect(page.getByRole('heading', { name: 'One clear answer is enough.' })).toBeVisible();
});

test('recording comparison filters real saved clips, handles missing audio and releases playback', async ({ page }) => {
  await page.addInitScript(() => {
    window.__revokedEvidenceAudio = [];
    const revoke = URL.revokeObjectURL.bind(URL);
    URL.revokeObjectURL = url => { window.__revokedEvidenceAudio.push(url); revoke(url); };
  });
  await seed(page, await populatedState(), true);
  const before = await new PracticePage(page).readState();
  const comparison = page.locator('#recording-comparison');
  await expect(comparison.getByText('First saved answer', { exact: true })).toBeVisible();
  await expect(comparison.getByText('Most recent answer', { exact: true })).toBeVisible();
  await expect(comparison).toContainText('1:00');
  await expect(comparison).toContainText('0:30');
  await comparison.locator('[data-recording="first:intro"]').click();
  const first = comparison.locator('audio');
  await expect(first).toBeVisible();
  await expect.poll(() => first.evaluate(audio => audio.readyState)).toBeGreaterThan(0);
  const firstURL = await first.getAttribute('src');
  await page.getByLabel('Compare recordings for').selectOption(MISSIONS[1].id);
  await expect(comparison.locator('.comparison-item')).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => window.__revokedEvidenceAudio)).toContain(firstURL);
  await comparison.getByRole('button', { name: 'Replay my answer' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'This audio is not stored on this device.' })).toBeVisible();
  await expect(comparison.getByRole('button', { name: 'Replay my answer' })).toBeEnabled();
  await page.getByText('Details and saved practice', { exact: true }).click();
  await page.locator('[data-recording="beginner-audio"]').click();
  const beginner = page.locator('[data-audio="beginner-audio"] audio');
  await expect(beginner).toBeVisible();
  const beginnerURL = await beginner.getAttribute('src');
  await noOverflow(page);
  await page.getByRole('link', { name: 'How progress is measured', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'What your numbers actually mean.' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__revokedEvidenceAudio)).toContain(beginnerURL);
  expect(await new PracticePage(page).readState()).toEqual(before);
});

test('the explainer presents source cards, attempt conditions and the real streak rules', async ({ page }, info) => {
  await page.goto('/#how');
  await expect(page.getByRole('heading', { name: 'What your numbers actually mean.' })).toBeVisible();
  const cards = page.locator('.evidence-guide .evidence-grid > .evidence-card');
  await expect(cards).toHaveCount(6);
  await expect(page.locator('.prov')).toHaveCount(6);
  for (const label of labels) await expect(cards.getByText(label, { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Typed notes and spoken answers' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'On your own' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'With help' })).toBeVisible();
  await expect(page.getByText('15 minutes of measured practice', { exact: true })).toBeVisible();
  await expect(page.locator('.evidence-streak-rules')).toContainText('Six qualifying days');
  await expect(page.locator('.evidence-streak-rules')).toContainText('two days in a row');
  await expect(page.getByRole('heading', { name: 'These numbers describe this device' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Settings & backups', exact: true })).toHaveAttribute('href', '#settings');
  const positions = await cards.evaluateAll(elements => elements.map(el => ({ x: el.getBoundingClientRect().x, y: el.getBoundingClientRect().y })));
  if (page.viewportSize().width > 1000) expect(positions[0].y).toBe(positions[2].y);
  else expect(positions[1].y).toBeGreaterThan(positions[0].y);
  await noOverflow(page);
  await page.screenshot({ path: info.outputPath('evidence-how.png'), fullPage: true });
  await page.getByRole('link', { name: 'See your progress', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Notice what is getting easier.' })).toBeVisible();
});

test('expanded evidence and the guide fit 320px and 390px screens without clipping controls', async ({ page }, info) => {
  await seed(page, await populatedState(), true);
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/#progress');
    await page.getByText('Details and saved practice', { exact: true }).click();
    await expect(page.locator('.evidence-grid > .evidence-card')).toHaveCount(6);
    await page.locator('[data-recording="beginner-audio"]').click();
    await expect(page.locator('[data-audio="beginner-audio"] audio')).toBeVisible();
    await noOverflow(page);
    for (const control of [page.getByLabel('Compare recordings for'), page.locator('[data-audio="beginner-audio"] audio')]) {
      const bounds = await control.boundingBox();
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    }
    await page.screenshot({ path: info.outputPath(`evidence-${width}.png`), fullPage: true });
    await page.goto('/#how');
    await expect(page.locator('.evidence-guide .evidence-card')).toHaveCount(6);
    await noOverflow(page);
  }
});
