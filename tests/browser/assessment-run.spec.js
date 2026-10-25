import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { newState } from '../../app/js/model.js';
import { prepareAssessmentAttempt, addPreparedAssessment } from '../../app/js/assessment-state.js';
import { PracticePage } from './practice-page.js';

const cafe = JSON.parse(await readFile(new URL('../../app/public/assessments/pilot-cafe-a-v1.json', import.meta.url), 'utf8'));
const appointment = JSON.parse(await readFile(new URL('../../app/public/assessments/pilot-appointment-a-v1.json', import.meta.url), 'utf8'));
const objective = cafe.definitions.find(definition => definition.kind === 'objective');
const writing = cafe.definitions.find(definition => definition.kind === 'writing');
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// These exercise the future #assessment/<id> route and assessment journal recovery.
// Hold the outgoing result hashchange to inspect A09's sealed state before A10 starts grading.
class AssessmentRunPage {
  constructor(page) { this.page = page; this.storage = new PracticePage(page); }
  get root() { return this.page.locator(`[data-assessment-run="${this.id}"]`); }
  item(id) { return this.root.locator(`[data-assessment-item="${id}"]`); }
  stimulus(id) { return this.root.locator(`[data-assessment-stimulus="${id}"]`); }
  async seed(definition = objective, mode = 'checkpoint') {
    this.definition = definition;
    await this.page.addInitScript(() => {
      window.addEventListener('hashchange', event => {
        if (new URL(event.newURL).hash.startsWith('#assessment-result/')) event.stopImmediatePropagation();
      }, { capture: true });
    });
    await this.page.goto('/#settings');
    await expect(this.page.getByLabel('What should we call you?')).toBeVisible();
    const state = newState();
    state.preferences.englishSupport = 'always'; // This preference must not bypass assessment conditions.
    const prepared = await prepareAssessmentAttempt(definition, { mode });
    this.id = prepared.attempt.id;
    state.assessments = addPreparedAssessment(state.assessments, prepared);
    await this.page.evaluate(async data => {
      const db = await new Promise((resolve, reject) => { const request = indexedDB.open('sprich-german-v2'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
      try {
        await new Promise((resolve, reject) => {
          const tx = db.transaction('meta', 'readwrite');
          tx.objectStore('meta').put(data, 'state');
          tx.oncomplete = resolve; tx.onabort = () => reject(tx.error); tx.onerror = () => reject(tx.error);
        });
      } finally { db.close(); }
    }, state);
    await this.page.goto(`/#assessment/${this.id}`);
    await expect(this.root.getByRole('heading', { name: definition.title, exact: true })).toBeVisible();
  }
  async progress() { return (await this.storage.readState()).assessments; }
  async attempt() { return (await this.progress()).attempts.find(attempt => attempt.id === this.id); }
  async journal() { return this.page.evaluate(id => JSON.parse(localStorage.getItem(`sprich-pending-draft:${id}`)), this.id); }
  async submit() {
    await this.root.getByRole('button', { name: this.definition.kind === 'writing' ? 'Save for grading' : 'Submit answers', exact: true }).click();
    await this.expectSubmitted();
  }
  async expectSubmitted() {
    await expect(this.page).toHaveURL(new RegExp(`#assessment-result/${this.id}$`));
    await expect(this.page.getByRole('link', { name: 'View assessment result' })).toHaveAttribute('href', `#assessment-result/${this.id}`);
    await expect.poll(async () => (await this.attempt()).state).toBe('submitted');
  }
  async blockWrites() {
    // A real outstanding transaction delays commit without mocking the runner/store API.
    await this.page.evaluate(async () => {
      const db = await new Promise((resolve, reject) => { const request = indexedDB.open('sprich-german-v2'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
      const tx = db.transaction('meta', 'readwrite');
      let held = true;
      const keepOpen = () => {
        const request = tx.objectStore('meta').get('state');
        request.onsuccess = () => { if (held) keepOpen(); };
      };
      window.__releaseAssessmentWrites = () => { held = false; };
      tx.oncomplete = () => db.close(); tx.onabort = () => db.close();
      keepOpen();
    });
  }
  async releaseWrites() { await this.page.evaluate(() => window.__releaseAssessmentWrites?.()); }
}

test('keyed controls retain raw text, option/slot/token IDs, partial gaps and unanswered zeroes', async ({ page }) => {
  const app = new AssessmentRunPage(page);
  await app.seed();
  await expect(app.root.locator('[data-assessment-item]')).toHaveCount(15);
  await app.item('cafe.a.vocab.tea').getByRole('radio', { name: 'der Tee', exact: true }).check();
  const text = app.item('cafe.a.vocab.size').getByRole('textbox', { name: 'Your answer', exact: true });
  await text.evaluate(input => { input.dataset.originalControl = 'true'; });
  await text.fill(' KLEIN! ');
  await expect(text).toBeFocused();
  await expect(text).toHaveAttribute('data-original-control', 'true');
  await expect(text).toHaveAttribute('maxlength', '500');
  const slots = app.item('cafe.a.grammar.prepositions');
  await slots.getByRole('textbox', { name: 'Before Montag', exact: true }).fill('am');
  await slots.getByRole('textbox', { name: 'Before zehn Uhr', exact: true }).fill('um');
  await slots.getByRole('textbox', { name: 'Before zehn Uhr', exact: true }).fill('');

  const order = app.item('cafe.a.grammar.order');
  const tokens = order.getByRole('list', { name: 'Your token order' }).getByRole('listitem');
  const kann = order.getByRole('button', { name: 'Add token 2: Kann', exact: true });
  await kann.focus(); await page.keyboard.press('Enter');
  await expect(kann).toBeFocused();
  await expect(kann).toHaveAttribute('aria-disabled', 'true');
  await page.keyboard.press('Enter'); // An already-used token cannot be added twice.
  await expect(tokens).toHaveText(['Kann']);
  await order.getByRole('button', { name: 'Add token 5: ich', exact: true }).click();
  await order.getByRole('button', { name: 'Undo last token', exact: true }).click();
  await expect(tokens).toHaveText(['Kann']);
  await order.getByRole('button', { name: 'Reset order', exact: true }).click();
  await expect(tokens).toHaveCount(0);
  await expect(order.getByRole('button', { name: 'Undo last token', exact: true })).toBeDisabled();
  for (const name of ['Add token 2: Kann', 'Add token 5: ich', 'Add token 1: mit Karte', 'Add token 4: bitte', 'Add token 3: bezahlen?']) {
    await order.getByRole('button', { name, exact: true }).click();
  }
  await expect(tokens).toHaveText(['Kann', 'ich', 'mit Karte', 'bitte', 'bezahlen?']);
  await expect(text).toHaveValue(' KLEIN! ');
  await expect(text).toHaveAttribute('data-original-control', 'true');
  await expect(app.root.locator('[data-assessment-submit-note]')).toContainText('Unanswered items and empty gaps score 0.');
  expect((await app.progress()).evaluations).toHaveLength(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await app.submit();

  const progress = await app.progress();
  const saved = await app.attempt();
  expect(saved.draft).toBeNull();
  expect(saved.submission).toMatchObject({ kind: 'objective', events: [], answers: {
    'cafe.a.vocab.tea': 'tea', 'cafe.a.vocab.size': ' KLEIN! ',
    'cafe.a.grammar.prepositions': { day: 'am', time: '' },
    'cafe.a.grammar.order': ['can', 'i', 'card', 'please', 'pay'],
    'cafe.a.vocab.cash': null, 'cafe.a.writing.order': null,
  } });
  expect(Object.keys(saved.submission.answers)).toHaveLength(15);
  expect(progress.evaluations).toHaveLength(1);
  expect(progress.evaluations[0]).toMatchObject({ source: 'local-key', result: { earned: 5, maximum: 20, percentage: 25 } });
  expect(progress.evaluations[0].result.items).toContainEqual(expect.objectContaining({ itemId: 'cafe.a.grammar.prepositions', earned: 1, maximum: 2 }));
  expect(progress.evaluations[0].result.items).toContainEqual(expect.objectContaining({ itemId: 'cafe.a.vocab.cash', earned: 0 }));
});

test('practice records each reveal before display and retains support alongside newer typed drafts', async ({ page }) => {
  const app = new AssessmentRunPage(page);
  await app.seed(objective, 'practice');
  const question = app.item('cafe.a.vocab.tea');
  const answer = question.getByRole('region', { name: 'Revealed answer', includeHidden: true });
  const reading = app.stimulus('cafe.a.menu');
  const stimulus = objective.stimuli.find(stimulus => stimulus.id === 'cafe.a.menu');
  await expect(app.root.getByRole('button', { name: 'Reveal answer', exact: true })).toHaveCount(15);
  await expect(answer).toBeEmpty();
  await expect(reading.getByText(stimulus.en, { exact: true })).toHaveCount(0);
  await app.blockWrites();
  await question.getByRole('button', { name: 'Reveal answer', exact: true }).click();
  await expect(answer).toBeHidden();
  await expect(answer).toBeEmpty();
  await expect(app.root.getByRole('button', { name: 'Submit answers', exact: true })).toBeDisabled();
  const pending = await app.journal();
  expect(pending).toMatchObject({ sessionId: app.id, taskId: 'draft', channel: 'assessment' });
  expect(pending.draft.events).toHaveLength(1);
  expect(pending.draft.events[0]).toEqual({ id: expect.stringMatching(uuid), kind: 'answer_reveal', phase: 'assessment', refId: 'cafe.a.vocab.tea', at: expect.any(Number) });
  await app.item('cafe.a.vocab.size').getByRole('textbox', { name: 'Your answer', exact: true }).fill('klein');
  expect((await app.journal()).draft.answers['cafe.a.vocab.size']).toBe('klein');
  await app.releaseWrites();
  await expect(answer).toContainText('Tea is der Tee');
  await expect(question.getByRole('radio', { name: 'der Tee', exact: true })).not.toBeChecked();
  await expect.poll(async () => (await app.attempt()).draft.answers['cafe.a.vocab.size']).toBe('klein');
  await reading.getByRole('button', { name: 'Reveal English translation', exact: true }).click();
  await expect(reading.getByText(stimulus.en, { exact: true })).toBeVisible();
  const events = (await app.attempt()).draft.events;
  expect(events).toHaveLength(2);
  expect(events[0]).toEqual(pending.draft.events[0]);
  expect(events[1]).toEqual({ id: expect.stringMatching(uuid), kind: 'question_translation', phase: 'assessment', refId: 'cafe.a.menu', at: expect.any(Number) });
  expect(events[0].id).not.toBe(events[1].id);
  await page.reload();
  await expect(question.getByRole('button', { name: 'Answer revealed', exact: true })).toBeDisabled();
  await expect(answer).toBeVisible();
  await expect(reading.getByText(stimulus.en, { exact: true })).toBeVisible();
  expect((await app.attempt()).draft.events).toEqual(events);
  expect(await app.journal()).toBeNull();
});

test('checkpoint keeps German stimuli and English instructions but omits all answer/translation controls', async ({ page }) => {
  const app = new AssessmentRunPage(page);
  const definition = appointment.definitions.find(definition => definition.kind === 'objective');
  await app.seed(definition);
  await expect(app.root.getByText('Target level: A2', { exact: true })).toBeVisible();
  await expect(app.root.getByText('Checkpoint', { exact: true })).toBeVisible();
  await expect(app.root.locator('#assessment-conditions')).toContainText('Self-directed checkpoint');
  await expect(app.root.getByRole('button', { name: /reveal|hint|model|translation/i })).toHaveCount(0);
  await expect(app.root.locator('[data-assessment-answer], [data-assessment-translation-content]')).toHaveCount(0);
  for (const stimulus of definition.stimuli) {
    await expect(app.stimulus(stimulus.id).getByText(stimulus.de, { exact: true })).toHaveAttribute('lang', 'de');
    await expect(app.root.getByText(stimulus.en, { exact: true })).toHaveCount(0);
  }
  for (const item of definition.items) await expect(app.item(item.id).getByText(item.promptEn, { exact: true })).toHaveAttribute('lang', 'en');
  await app.submit();
  const saved = await app.attempt();
  const progress = await app.progress();
  expect(saved.submission.events).toEqual([]);
  expect(Object.values(saved.submission.answers).every(answer => answer === null)).toBe(true);
  expect(progress.evaluations[0].result).toMatchObject({ earned: 0, maximum: 20, percentage: 0 });
  const activity = (await app.storage.readState()).activity;
  await page.goto(`/#assessment/${app.id}`);
  await app.expectSubmitted();
  await expect(page.getByRole('form', { name: 'Assessment answers' })).toHaveCount(0);
  expect((await app.attempt()).submissionHash).toBe(saved.submissionHash);
  expect((await app.progress()).evaluations).toEqual(progress.evaluations);
  expect((await app.storage.readState()).activity).toEqual(activity);
});

test('an edit followed by reload in the same task restores all keyed draft shapes from the journal', async ({ page }) => {
  const app = new AssessmentRunPage(page);
  await app.seed();
  await app.item('cafe.a.vocab.tea').getByRole('radio', { name: 'der Tee', exact: true }).check();
  await app.item('cafe.a.grammar.prepositions').getByRole('textbox', { name: 'Before Montag', exact: true }).fill('am');
  await app.item('cafe.a.grammar.order').getByRole('button', { name: 'Add token 2: Kann', exact: true }).click();
  const input = app.item('cafe.a.vocab.size').getByRole('textbox', { name: 'Your answer', exact: true });
  const [, journal] = await Promise.all([
    page.waitForEvent('load'),
    input.evaluate((element, id) => {
      element.value = '  KLEIN!  ';
      element.dispatchEvent(new Event('input', { bubbles: true }));
      const pending = JSON.parse(localStorage.getItem(`sprich-pending-draft:${id}`));
      location.reload(); // No debounce timer or IndexedDB completion can run before this reload request.
      return pending;
    }, app.id),
  ]);
  expect(journal).toMatchObject({ sessionId: app.id, taskId: 'draft', channel: 'assessment', draft: {
    text: '', events: [], answers: { 'cafe.a.vocab.tea': 'tea', 'cafe.a.vocab.size': '  KLEIN!  ', 'cafe.a.grammar.prepositions': { day: 'am' }, 'cafe.a.grammar.order': ['can'] },
  } });
  await expect(input).toHaveValue('  KLEIN!  ');
  await expect(app.item('cafe.a.vocab.tea').getByRole('radio', { name: 'der Tee', exact: true })).toBeChecked();
  await expect(app.item('cafe.a.grammar.prepositions').getByRole('textbox', { name: 'Before Montag', exact: true })).toHaveValue('am');
  await expect(app.item('cafe.a.grammar.order').getByRole('listitem')).toHaveText(['Kann']);
  expect((await app.attempt()).draft).toEqual(journal.draft);
  expect((await app.progress()).evaluations).toHaveLength(0);
});

test('writing has an advisory word range, a 3000-character limit, reload recovery and a sealed ungraded response', async ({ page }) => {
  const app = new AssessmentRunPage(page);
  await app.seed(writing, 'practice');
  const textarea = app.root.getByRole('textbox', { name: 'Your German response', exact: true });
  const save = app.root.getByRole('button', { name: 'Save for grading', exact: true });
  await expect(textarea).toHaveAttribute('maxlength', '3000');
  await expect(app.root.getByText(writing.task.prompt, { exact: true })).toBeVisible();
  for (const goal of writing.task.goals) await expect(app.root.getByText(goal, { exact: true })).toBeVisible();
  await expect(app.root.getByText(/Suggested length: 20–40 words/)).toBeVisible();
  await save.click();
  expect((await app.attempt()).submission).toBeNull();
  await textarea.fill('  \n  '); await save.click();
  await expect(app.root.getByRole('alert')).toContainText('Write a response before submitting');
  expect((await app.attempt()).submission).toBeNull();
  await textarea.evaluate(element => { element.dataset.originalControl = 'true'; });
  const longText = 'Wort '.repeat(600);
  await textarea.fill(longText); await textarea.press('End'); await textarea.press('x');
  await expect(textarea).toHaveValue(longText);
  await expect(app.root.locator('[data-assessment-word-count]')).toContainText('600 words');
  await expect(app.root.locator('[data-assessment-word-count]')).toContainText('Above the suggested range');
  await expect(save).toBeEnabled();
  const response = '\nHallo Mia,\nhast du am Montag Zeit?';
  await textarea.fill(response);
  await expect(textarea).toBeFocused();
  await expect(textarea).toHaveAttribute('data-original-control', 'true');
  await page.reload();
  await expect(textarea).toHaveValue(response);
  await expect(app.root.locator('[data-assessment-word-count]')).toContainText('7 words');
  await expect(app.root.locator('[data-assessment-word-count]')).toContainText('Below the suggested range');
  await expect(save).toBeEnabled();
  expect((await app.progress()).evaluations).toHaveLength(0);
  await expect(app.root.getByRole('button', { name: /reveal|model answer/i })).toHaveCount(0);
  const apiPosts = [];
  page.on('request', request => { if (request.method() === 'POST' && new URL(request.url()).pathname.startsWith('/api/')) apiPosts.push(request.url()); });
  await app.blockWrites();
  await save.click();
  await expect(textarea).toBeDisabled();
  await expect(save).toBeDisabled();
  await expect(app.root.locator('[data-assessment-clock]')).toContainText('paused for submission');
  await app.releaseWrites();
  await app.expectSubmitted();
  const saved = await app.attempt();
  expect(saved).toMatchObject({ state: 'submitted', draft: null, activeEvaluationId: null, submission: { kind: 'writing', text: response, inputMode: 'typed', events: [] } });
  expect(saved.submittedAt).toEqual(expect.any(Number));
  expect(saved.submissionHash).toMatch(/^[a-f0-9]{64}$/);
  expect((await app.progress()).evaluations).toEqual([]);
  expect((await app.progress()).jobs).toEqual([]);
  expect(apiPosts).toEqual([]);
  expect((await app.storage.readState()).activity.some(segment => segment.sessionId === app.id && segment.ms > 0)).toBe(true);
});

test('a failed reveal save stays hidden and a later edit recovers the queue without duplicating support', async ({ page }) => {
  const app = new AssessmentRunPage(page);
  await app.seed(objective, 'practice');
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.evaluate(() => {
    const original = window.IDBObjectStore.prototype.put;
    let fail = true;
    window.IDBObjectStore.prototype.put = function (value, ...args) {
      if (fail && this.name === 'meta' && value.assessments?.attempts.some(attempt => attempt.draftRevision > 0)) {
        fail = false;
        throw new DOMException('Test: draft storage temporarily unavailable.', 'QuotaExceededError');
      }
      return original.call(this, value, ...args);
    };
  });
  const question = app.item('cafe.a.vocab.size');
  const answer = question.getByRole('region', { name: 'Revealed answer', includeHidden: true });
  await question.getByRole('button', { name: 'Reveal answer', exact: true }).click();
  await expect(app.root.getByRole('button', { name: 'Retry draft save', exact: true })).toBeVisible();
  await expect(answer).toBeHidden();
  await expect(answer).toBeEmpty();
  const events = (await app.journal()).draft.events;
  expect(events).toHaveLength(1);
  const input = question.getByRole('textbox', { name: 'Your answer', exact: true });
  await input.fill('klein');
  await expect(app.root.locator('[data-assessment-save-status]')).toHaveText('Draft saved on this device');
  await expect(input).toBeFocused();
  await question.getByRole('button', { name: 'Reveal answer', exact: true }).click();
  await expect(answer).toBeVisible();
  expect((await app.attempt()).draft).toMatchObject({ answers: { 'cafe.a.vocab.size': 'klein' }, events });
  expect(await app.journal()).toBeNull();
  expect(errors).toEqual([]);
});

test('leaving during a pending reveal awaits its save without mutating the departed form', async ({ page }) => {
  const app = new AssessmentRunPage(page);
  await app.seed(objective, 'practice');
  const question = app.item('cafe.a.vocab.tea');
  await question.locator('[data-assessment-answer]').evaluate(node => { window.__departedAssessmentAnswer = node; });
  await app.blockWrites();
  await question.getByRole('button', { name: 'Reveal answer', exact: true }).click();
  await app.root.getByRole('link', { name: 'Back to Lessons', exact: true }).click();
  await expect(page).toHaveURL(/#lessons$/);
  await app.releaseWrites();
  await expect(page.getByRole('heading', { name: 'Greetings and names', exact: true })).toBeVisible();
  expect(await page.evaluate(() => ({ hidden: window.__departedAssessmentAnswer.hidden, html: window.__departedAssessmentAnswer.innerHTML, connected: window.__departedAssessmentAnswer.isConnected }))).toEqual({ hidden: true, html: '', connected: false });
  expect((await app.attempt()).draft.events).toEqual([expect.objectContaining({ kind: 'answer_reveal', phase: 'assessment', refId: 'cafe.a.vocab.tea' })]);
});
