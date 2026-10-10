import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { openDB, deleteDB } from 'idb';
import { createStore } from '../app/js/store.js';
import { newState, upgradeState, validateState } from '../app/js/model.js';
import { prepareAssessmentAttempt, addPreparedAssessment, prepareAssessmentSubmission, saveSealedAssessment,
  verifyAssessmentHashes, assessmentDefinition } from '../app/js/assessment-state.js';
import { buildRoleplaySubmission } from '../app/js/assessment-evidence.js';
import { parseGeminiAssessmentReport } from '../app/js/assessment-gemini.js';
import { createAIConversation, completedAITurn, newAIDraft, aiHistory } from '../app/js/ai-state.js';
import { createSession, tasksFor, draftFor, makeAttempt } from '../app/js/session.js';
import { parsePack, starterSnapshot } from '../app/js/starter-content.js';
import { createStarterSession, starterDraft, starterResponse, createWordSession, wordReview } from '../app/js/starter-state.js';
import { reviewStates } from '../app/js/srs.js';
import { wordMemories } from '../app/js/starter-progress.js';
import { assessmentEvidence, validateAssessmentPack, validateAssessmentSubmission, validateRubricResult } from '../shared/assessment-contracts.js';
import { rubricEvaluation } from '../shared/assessment-results.js';

const NOW = Date.parse('2026-10-09T10:00:00Z');
const packs = await Promise.all(['cafe-a', 'cafe-b', 'appointment-a', 'appointment-b'].map(async name =>
  validateAssessmentPack(JSON.parse(await readFile(new URL(`../app/public/assessments/pilot-${name}-v1.json`, import.meta.url), 'utf8')))));
const starterPack = parsePack(JSON.parse(await readFile(new URL('../app/public/course/starter-2026.10-1.json', import.meta.url), 'utf8')));
const definition = (kind, pack = 0) => structuredClone(packs[pack].definitions.find(item => item.kind === kind));
const WRITING = '  Hallo Mia!\nMöchtest du am Montag um zehn Uhr mit mir im Cafe\u0301 am Park Kaffee trinken?\nHast du Zeit? Liebe Grüße!  ';
const draft = (text = WRITING, answers = {}) => ({ answers, text, events: [] });
const objectiveDraft = () => draft('', {
  'cafe.a.vocab.tea': 'tea',
  'cafe.a.grammar.prepositions': { day: 'am', time: 'am' },
  'cafe.a.grammar.order': ['can', 'i', 'please', 'card', 'pay'],
  'cafe.a.reading.hours': { open: '08:00' },
});
const savedAttempt = (store, id) => store.state.assessments.attempts.find(attempt => attempt.id === id);
const savedConversation = (store, id) => store.state.aiSessions.find(session => session.id === id);
const backup = state => JSON.stringify({ app: 'sprich', format: 1, exportedAt: NOW, state });

let databaseNumber = 0;
async function fixture(t, { seed = null, databaseVersion = 5 } = {}) {
  const name = `assessment-state-${++databaseNumber}`;
  const stores = [];
  let clock = NOW;
  t.after(async () => { stores.forEach(store => store.close()); await deleteDB(name); });
  if (seed) {
    const db = await openDB(name, databaseVersion, { upgrade(db) {
      for (const key of ['meta', 'recordings', 'ttsCache', 'coursePacks', ...(databaseVersion >= 5 ? ['assessmentPacks'] : [])]) db.createObjectStore(key);
    } });
    try { await db.put('meta', seed, 'state'); } finally { db.close(); }
  }
  const open = async () => {
    const store = await createStore({ name, now: () => clock }); stores.push(store); return store;
  };
  const inspect = async (edit = null, key = 'state') => {
    const db = await openDB(name);
    try {
      if (edit) await db.put('meta', edit, key);
      return await db.get('meta', key);
    } finally { db.close(); }
  };
  return { store: await open(), open, inspect, at: time => { clock = time; } };
}

function turnResult(session, transcript, replyDe = 'Danke. Haben Sie noch eine Frage?') {
  return { requestId: session.draft.requestId, sessionId: session.id, inputStatus: 'clear', transcript,
    ...(session.assessmentRef ? { assessmentRef: structuredClone(session.assessmentRef) } : {}),
    reply: { replyDe, meaningEn: 'Thank you. Do you have another question?', action: 'question' },
    model: 'fixture-partner', promptVersion: 'fixture-turn-1', usage: { inputTokens: 10, outputTokens: 5 } };
}
async function sendTurn(store, sessionId, { id, text, operation = 'reply', supersedes = '', recordingMs = 0, audioKey = '', replyDe } = {}) {
  await store.saveAIDraft(sessionId, { ...newAIDraft(NOW), requestId: id, text: recordingMs ? '' : text,
    operation, supersedes, recordingMs, audioKey, status: 'sending' });
  const session = savedConversation(store, sessionId);
  await store.completeAITurn(sessionId, turnResult(session, text, replyDe));
}
async function startRoleplay(store, attemptId = 'roleplay') {
  const def = definition('roleplay');
  await store.createAssessmentAttempt(def, { attemptId });
  const sessionId = await store.startAssessmentConversation(attemptId);
  return { attemptId, sessionId, def };
}
async function threeReplies(store, sessionId) {
  for (const [id, text] of [['order', 'Ich möchte einen kleinen Tee.'], ['price', 'Was kostet er?'], ['payment', 'Mit Karte, bitte.']]) {
    await sendTurn(store, sessionId, { id, text });
  }
}
async function writingAttempt(store, { attemptId = 'writing', def = definition('writing'), text = WRITING } = {}) {
  await store.createAssessmentAttempt(def, { attemptId });
  await store.saveAssessmentDraft(attemptId, draft(text));
  return store.submitAssessment(attemptId);
}
async function rejectsUnchanged(store, action, pattern) {
  const before = structuredClone(await store.refresh());
  await assert.rejects(action, pattern);
  assert.deepEqual(store.state, before, 'A failed operation must not change the in-memory snapshot.');
  assert.deepEqual(await store.refresh(), before, 'A failed operation must not change IndexedDB.');
}
function learningOnly(state) {
  const { assessments: _assessments, updatedAt: _updatedAt, ...learning } = structuredClone(state);
  return learning;
}
const memories = state => ({ phrases: reviewStates(state.attempts), words: wordMemories(state.starter) });

function learningState() {
  const state = newState(NOW - 60_000);
  state.profile.studies = 'Informatik'; state.preferences.learningPath = 'work'; state.preferences.englishSupport = 'always';
  const lesson = createSession(state, 'first-interview', { id: 'old-lesson', now: NOW - 50_000 });
  const task = tasksFor(lesson).find(item => item.kind === 'recall');
  const response = { ...draftFor(lesson, task.id), text: 'Ich studiere Informatik.', aloud: true, attemptedBeforeReveal: true };
  lesson.cursor = 3; lesson.drafts[task.id] = response;
  state.sessions.push(lesson);
  state.attempts.push(makeAttempt(lesson, task, response, 'independent', 'Europe/Berlin', NOW - 45_000));
  state.activity.push({ id: 'old-activity', sessionId: lesson.id, start: NOW - 50_000, end: NOW - 45_000, ms: 5000, day: '2026-10-09' });

  const ai = createAIConversation(state, 'first-interview', { id: 'old-ai', now: NOW - 40_000, fields: ['studies'] });
  ai.draft.requestId = 'old-ai-turn'; ai.draft.text = 'Ich studiere Informatik.'; ai.reviewRequestId = 'old-ai-review';
  const turn = completedAITurn(ai, turnResult(ai, ai.draft.text), NOW - 39_000);
  delete turn.inputMode; // Schema 5 ordinary conversations did not require this provenance field.
  ai.turns.push(turn); ai.draft = { ...newAIDraft(NOW - 38_000), requestId: 'old-ai-draft', text: 'Ich kann montags arbeiten.' };
  state.aiSessions.push(ai);
  state.companionNotes.push({ id: 'old-note', missionId: 'first-interview', text: 'Ich habe eine Rückfrage geübt.', minutes: 5, createdAt: NOW - 37_000 });

  const beginner = createStarterSession(starterSnapshot(starterPack, 'starter-hello'), { id: 'old-starter', now: NOW - 30_000 });
  beginner.responses.push(starterResponse(beginner, { id: 'warmup', kind: 'warmup' }, { ...starterDraft(), aloud: true, text: 'Hallo!' }, 'unscored', NOW - 29_000));
  beginner.cursor = 4; beginner.drafts['reply-1'] = { ...starterDraft(), text: 'Ich heiße Sam.' };
  state.starter.sessions.push(beginner);
  const word = starterPack.words[0];
  const words = createWordSession([word], 'recall', { id: 'old-words', now: NOW - 20_000 });
  const review = wordReview(words, word, { ...starterDraft(), attempted: true, revealed: true, aloud: true, text: 'Hallo!' }, 'independent', '2026-10-09', NOW - 19_000);
  words.cursor = 1; words.completedAt = NOW - 19_000;
  state.starter.wordSessions.push(words); state.starter.reviews.push(review);
  state.starter.wordMarks.push({ id: word.id, saved: true, updatedAt: NOW - 18_000 });
  state.starter.plans.push({ id: '2026-10-09', lessonId: 'starter-hello', wordIds: [word.id], reflection: 'Ask a name.', createdAt: NOW - 30_000, updatedAt: NOW - 18_000 });
  return validateState(state);
}

function minimalValidRawResult(rubricId, { refId = null, quote = 'Einen kleinen Tee, bitte.', scores = [0, 1, 2, 3, 4] } = {}) {
  const ids = rubricId === 'writing:1' ? ['task', 'organisation', 'vocabulary', 'grammar', 'mechanics'] : ['task', 'interaction', 'clarity', 'vocabulary', 'grammar'];
  return { ratings: ids.map((id, index) => ({ id, score: scores[index],
    reasonEn: scores[index] === null ? 'There was no evidence for this criterion.' : 'The learner quotation supports the criterion rating.',
    evidence: scores[index] === null ? [] : [{ refId, quote }] })),
  strengths: [], corrections: [], retryDe: 'Versuche es mit einem anderen Getränk.', retryEn: 'Try again with a different drink.' };
}
function geminiReport(attempt, def, result) {
  const external = attempt.execution === 'gemini_live';
  return { app: 'sprich-assessment', schemaVersion: 1, attemptId: attempt.id, definitionId: def.id,
    definitionVersion: def.version, rubricId: def.rubricId, scope: external ? 'external-live' : 'submitted-text',
    bindingHash: external ? attempt.exportContextHash : attempt.submissionHash, result };
}
function deferred() {
  let resolve;
  const promise = new Promise(yes => { resolve = yes; });
  return { promise, resolve };
}
function pauseNextHash(t) {
  const started = deferred(); const released = deferred();
  const digest = crypto.subtle.digest.bind(crypto.subtle);
  let paused = false;
  // Delay a real SHA-256 result; never replace identity verification with a fake hash.
  t.mock.method(crypto.subtle, 'digest', async (...args) => {
    const result = await digest(...args);
    if (!paused) { paused = true; started.resolve(); await released.promise; }
    return result;
  });
  t.after(() => released.resolve());
  return { started: started.promise, release: released.resolve };
}

test('schema 5 upgrades to 6 while preserving populated lesson, AI, starter and SRS evidence', async t => {
  const old = learningState(); old.schemaVersion = 5; delete old.assessments;
  const before = structuredClone(old);
  const upgraded = upgradeState(old);
  assert.deepEqual(old, before);
  assert.deepEqual(upgraded, { ...before, schemaVersion: 6, assessments: { definitions: [], attempts: [], evaluations: [], jobs: [] } });
  assert.notEqual(upgraded.starter.sessions, old.starter.sessions);
  const { store, open, inspect } = await fixture(t, { seed: old, databaseVersion: 4 });
  assert.deepEqual(store.state, upgraded);
  assert.deepEqual(await inspect(null, 'schema-5-backup'), before);
  assert.deepEqual(JSON.parse(await store.previousBackup()).state, before);
  assert.equal(memories(store.state).phrases.size, 1); assert.equal(memories(store.state).words.size, 1);
  store.close();
  assert.deepEqual((await open()).state, upgraded);
  assert.deepEqual(await inspect(null, 'schema-5-backup'), before);
});

test('keyed partial scores survive reopening and duplicate transfers without promoting SRS', async t => {
  const { store, open, at } = await fixture(t, { seed: learningState() });
  const learning = learningOnly(store.state); const memory = memories(store.state);
  await store.createAssessmentAttempt(definition('objective'), { attemptId: 'keyed' });
  await store.saveAssessmentDraft('keyed', objectiveDraft());
  at(NOW + 1000);
  const sealed = await store.submitAssessment('keyed');
  const progress = structuredClone(store.state.assessments);
  assert.equal(sealed.state, 'submitted'); assert.equal(sealed.draft, null); assert.equal(sealed.submittedAt, NOW + 1000);
  assert.equal(sealed.submission.answers['cafe.a.grammar.modal'], null);
  assert.equal(Object.keys(sealed.submission.answers).length, 15);
  const [grade] = progress.evaluations;
  assert.equal(grade.result.earned, 5); assert.equal(grade.result.maximum, 20); assert.equal(grade.result.percentage, 25);
  assert.equal(grade.source, 'local-key'); assert.equal(grade.createdAt, NOW + 1000);
  assert.equal(sealed.activeEvaluationId, grade.id); assert.deepEqual(progress.jobs, []);
  at(NOW + 2000);
  assert.deepEqual(await store.submitAssessment('keyed'), sealed);
  assert.deepEqual(store.state.assessments, progress);
  assert.deepEqual(learningOnly(store.state), learning); assert.deepEqual(memories(store.state), memory);
  store.close();
  const reopened = await open();
  assert.deepEqual(reopened.state.assessments, progress);
  const { store: destination } = await fixture(t);
  const exported = await reopened.export();
  await destination.import(exported); await destination.import(exported);
  assert.deepEqual(destination.state.assessments, progress);
  await reopened.import(await destination.export());
  assert.deepEqual(reopened.state.assessments, progress);
  assert.deepEqual(learningOnly(reopened.state), learning); assert.deepEqual(memories(reopened.state), memory);
});

test('definition snapshots deduplicate by content and reject reuse of a published identity for changed content', async t => {
  const { store, open } = await fixture(t);
  const def = definition('writing'); const original = structuredClone(def);
  await store.createAssessmentAttempt(def, { attemptId: 'one' });
  const reordered = Object.fromEntries(Object.entries(original).reverse());
  await store.createAssessmentAttempt(reordered, { attemptId: 'two' });
  await store.createAssessmentAttempt(reordered, { attemptId: 'two' });
  assert.equal(store.state.assessments.definitions.length, 1); assert.equal(store.state.assessments.attempts.length, 2);
  assert.equal(savedAttempt(store, 'one').definitionHash, savedAttempt(store, 'two').definitionHash);
  def.task.prompt = 'A later caller edit';
  assert.deepEqual(assessmentDefinition(store.state.assessments, savedAttempt(store, 'one')), original);
  await rejectsUnchanged(store, () => store.createAssessmentAttempt(def, { attemptId: 'changed' }), /published assessment version changed/);
  await rejectsUnchanged(store, () => store.createAssessmentAttempt(original, { attemptId: 'one', mode: 'checkpoint' }), /Conflicting assessment attempt/);
  await store.createAssessmentAttempt({ ...def, version: '2' }, { attemptId: 'new-version' });
  assert.equal(store.state.assessments.definitions.length, 2);
  assert.notEqual(savedAttempt(store, 'new-version').definitionHash, savedAttempt(store, 'one').definitionHash);
  assert.deepEqual((await open()).state.assessments, store.state.assessments);
});

test('compare-and-seal rejects a draft revision changed in another tab while hashing is in flight', async t => {
  const { store, open, inspect, at } = await fixture(t);
  await store.createAssessmentAttempt(definition('writing'), { attemptId: 'race' });
  await store.saveAssessmentDraft('race', draft());
  const other = await open(); const oldSnapshot = structuredClone(store.state);
  const hash = pauseNextHash(t);
  const rejected = assert.rejects(store.submitAssessment('race'), /draft changed while saving/);
  await hash.started;
  at(NOW + 1000);
  await other.saveAssessmentDraft('race', draft('Hallo Mia! Am Dienstag habe ich Zeit.'));
  const latest = structuredClone(other.state);
  hash.release(); await rejected;
  assert.deepEqual(store.state, oldSnapshot); assert.deepEqual(await inspect(), latest);
  assert.equal(savedAttempt(other, 'race').draftRevision, 2); assert.equal(savedAttempt(other, 'race').submission, null);
  await store.refresh();
  at(NOW + 2000);
  const sealed = await store.submitAssessment('race');
  assert.equal(sealed.submission.text, 'Hallo Mia! Am Dienstag habe ich Zeit.');
  assert.equal(sealed.submittedAt, NOW + 2000);
});

test('submitted writing is immutable, including raw whitespace and input provenance', async t => {
  const { store, open } = await fixture(t);
  const def = definition('writing'); const sealed = await writingAttempt(store, { def });
  assert.equal(sealed.submission.text, WRITING); assert.equal(sealed.submission.inputMode, 'typed');
  await rejectsUnchanged(store, () => store.saveAssessmentDraft(sealed.id, draft('Replacement')), /sealed/);
  await rejectsUnchanged(store, () => store.abandonAssessment(sealed.id), /immutable/);
  for (const patch of [{ text: WRITING.trim() }, { inputMode: 'dictated' }]) {
    const candidate = await prepareAssessmentSubmission(sealed, def, { ...sealed.submission, ...patch });
    await rejectsUnchanged(store, () => store.update(root => { root.assessments = saveSealedAssessment(root.assessments, candidate, NOW + 1000); }), /cannot be replaced/);
  }
  assert.deepEqual(await store.submitAssessment(sealed.id), sealed);
  assert.deepEqual(savedAttempt(await open(), sealed.id), sealed);
});

test('bad backup hashes are rejected before changing profile, progress or persisted state', async t => {
  const { store, open } = await fixture(t, { seed: learningState() });
  await writingAttempt(store);
  const original = JSON.parse(await store.export());
  const cases = [
    ['definition content', value => { value.assessments.definitions[0].definition.title += ' edited'; }, /definition hash/],
    ['submission text', value => { value.assessments.attempts[0].submission.text += ' '; }, /submitted assessment text changed/],
    ['prepared context', value => { value.assessments.attempts[0].exportContextHash = 'f'.repeat(64); }, /prepared assessment context changed/],
  ];
  for (const [name, corrupt, pattern] of cases) await t.test(name, async () => {
    const incoming = structuredClone(original); corrupt(incoming.state); incoming.state.profile.studies = 'Incoming profile';
    validateState(incoming.state); // Shape-valid corruption must reach the actual cryptographic checks.
    await rejectsUnchanged(store, () => store.import(JSON.stringify(incoming), true), pattern);
    assert.deepEqual((await open()).state, original.state);
  });
  for (const raw of ['{broken', backup({ ...original.state, schemaVersion: 99 })]) {
    await rejectsUnchanged(store, () => store.import(raw), /valid JSON|unsupported version/);
  }
});

test('opening current-schema 6 storage still verifies definition, submission and context hashes without rewriting corruption', async t => {
  for (const [name, corrupt, pattern] of [
    ['definition', value => { value.assessments.definitions[0].definition.title += ' changed'; }, /definition hash/],
    ['submission', value => { value.assessments.attempts[0].submission.text += '\n'; }, /submitted assessment text changed/],
    ['context', value => { value.assessments.attempts[0].exportContextHash = 'f'.repeat(64); }, /prepared assessment context changed/],
  ]) await t.test(name, async t => {
    const { store, open, inspect } = await fixture(t);
    await writingAttempt(store);
    const damaged = structuredClone(store.state); corrupt(damaged);
    assert.equal(damaged.schemaVersion, 6); validateState(damaged);
    store.close(); await inspect(damaged);
    await assert.rejects(open(), pattern);
    assert.deepEqual(await inspect(), damaged);
    assert.equal(await inspect(null, 'schema-5-backup'), undefined, 'Verification must not masquerade as a migration.');
  });
});

test('valid but conflicting submitted attempts and evaluation IDs abort the entire merge', async t => {
  await t.test('same attempt ID with independently sealed divergent answers', async t => {
    const { store: local } = await fixture(t); const { store: remote } = await fixture(t);
    const def = definition('writing');
    await local.createAssessmentAttempt(def, { attemptId: 'shared' });
    await remote.import(await local.export());
    await local.saveAssessmentDraft('shared', draft('Hallo Mia! Ich habe am Montag Zeit.'));
    await remote.saveAssessmentDraft('shared', draft('Hallo Mia! Ich habe am Dienstag Zeit.'));
    await local.submitAssessment('shared'); await remote.submitAssessment('shared');
    await verifyAssessmentHashes(remote.state.assessments);
    const incoming = await remote.export();
    await rejectsUnchanged(local, () => local.import(incoming), /Conflicting submitted answers/);
  });
  await t.test('same evaluation ID with different valid feedback', async t => {
    const { store } = await fixture(t); const def = definition('writing'); const attempt = await writingAttempt(store, { def });
    const job = await store.ensureAssessmentJob(attempt.id, { requestId: 'grade:shared' });
    const evaluation = rubricEvaluation({ requestId: job.id, attemptId: attempt.id, definitionHash: attempt.definitionHash,
      submissionHash: attempt.submissionHash, mode: attempt.mode, definition: def, submission: attempt.submission,
      raw: minimalValidRawResult('writing:1', { refId: 'writing', quote: 'Hallo Mia!' }), model: 'fixture-grader', promptVersion: 'fixture-1', now: NOW });
    await store.acceptAssessmentEvaluation(job.id, evaluation);
    const changed = structuredClone(evaluation); changed.result.raw.retryEn = 'Use a different time next time.';
    await rejectsUnchanged(store, () => store.acceptAssessmentEvaluation(job.id, changed), /Conflicting evaluation/);
    const incoming = structuredClone(store.state); incoming.assessments.evaluations[0] = changed;
    validateState(incoming); await verifyAssessmentHashes(incoming.assessments);
    await rejectsUnchanged(store, () => store.import(backup(incoming)), /Conflicting immutable assessment records/);
    assert.equal(store.state.assessments.jobs[0].state, 'complete');
    assert.deepEqual(store.state.assessments.evaluations, [evaluation]);
  });
  await t.test('same attempt ID cannot change assessment mode', async t => {
    const { store: local } = await fixture(t); const { store: remote } = await fixture(t);
    await local.createAssessmentAttempt(definition('writing'), { attemptId: 'identity', mode: 'practice' });
    await remote.createAssessmentAttempt(definition('writing'), { attemptId: 'identity', mode: 'checkpoint' });
    const incoming = await remote.export();
    await rejectsUnchanged(local, () => local.import(incoming), /Conflicting assessment identity/);
  });
});

test('empty or equal pre-submit drafts merge with a sealed submission in either transfer direction', async t => {
  for (const kind of ['writing', 'objective']) for (const content of ['empty', 'equal']) for (const direction of ['to-draft', 'to-submitted']) {
    await t.test(`${kind}, ${content}, ${direction}`, async t => {
      const localFixture = await fixture(t); const remoteFixture = await fixture(t);
      const local = localFixture.store; const remote = remoteFixture.store;
      const answer = kind === 'writing' ? draft() : objectiveDraft();
      await local.createAssessmentAttempt(definition(kind), { attemptId: 'fork' });
      if (content === 'equal') await local.saveAssessmentDraft('fork', answer);
      await remote.import(await local.export());
      await remote.saveAssessmentDraft('fork', answer);
      remoteFixture.at(NOW + 1000);
      const sealed = await remote.submitAssessment('fork');
      localFixture.at(NOW + 5000);
      await local.saveAssessmentDraft('fork', content === 'equal' ? answer : draft(''));
      const target = direction === 'to-draft' ? local : remote;
      const source = direction === 'to-draft' ? remote : local;
      const raw = await source.export();
      await target.import(raw); await target.import(raw);
      assert.equal(target.state.assessments.attempts.length, 1); assert.equal(target.state.assessments.definitions.length, 1);
      assert.deepEqual(savedAttempt(target, 'fork').submission, sealed.submission);
      assert.equal(savedAttempt(target, 'fork').submittedAt, NOW + 1000);
      assert.equal(savedAttempt(target, 'fork').draft, null);
      assert.equal(target.state.assessments.evaluations.length, kind === 'objective' ? 1 : 0);
    });
  }
});

test('divergent unfinished text, answers or support cannot be overwritten by a submitted fork', async t => {
  for (const [kind, change] of [
    ['writing', value => { value.text += ' '; }],
    ['objective', value => { value.answers['cafe.a.vocab.tea'] = 'coffee'; }],
    ['support', value => { value.events.push({ id: 'help', kind: 'answer_hint', phase: 'assessment', refId: null, at: NOW }); }],
  ]) for (const direction of ['to-draft', 'to-submitted']) await t.test(`${kind}, ${direction}`, async t => {
    const { store: local } = await fixture(t); const { store: remote } = await fixture(t);
    const def = definition(kind === 'objective' ? 'objective' : 'writing');
    const answer = kind === 'objective' ? objectiveDraft() : draft();
    await local.createAssessmentAttempt(def, { attemptId: 'fork' });
    await local.saveAssessmentDraft('fork', answer); await remote.import(await local.export());
    await remote.submitAssessment('fork');
    const divergent = structuredClone(answer); change(divergent); await local.saveAssessmentDraft('fork', divergent);
    const target = direction === 'to-draft' ? local : remote; const source = direction === 'to-draft' ? remote : local;
    const raw = await source.export();
    await rejectsUnchanged(target, () => target.import(raw), /conflicts with an unfinished local answer/);
  });
});

test('Gemini reports are parsed, saved and reimported at later timestamps exactly once, without SRS promotion', async t => {
  for (const execution of ['gemini_live', 'in_app']) await t.test(execution, async t => {
    const { store, open, at } = await fixture(t, { seed: learningState() });
    t.mock.method(globalThis, 'fetch', () => { assert.fail('Manual report imports must not call a provider.'); });
    const learning = learningOnly(store.state); const memory = memories(store.state);
    assert.equal(memory.phrases.size, 1); assert.equal(memory.words.size, 1);
    const def = definition(execution === 'gemini_live' ? 'roleplay' : 'writing');
    const attemptId = await store.createAssessmentAttempt(def, { attemptId: 'gemini', execution, mode: 'checkpoint' });
    if (execution === 'in_app') { await store.saveAssessmentDraft(attemptId, draft()); await store.submitAssessment(attemptId); }
    const result = minimalValidRawResult(def.rubricId, execution === 'in_app' ? { refId: 'writing', quote: 'Hallo Mia!' } : {});
    const report = geminiReport(savedAttempt(store, attemptId), def, result);
    const parsed = await parseGeminiAssessmentReport(JSON.stringify(report), savedAttempt(store, attemptId), def, { now: NOW + 1000 });
    assert.equal(parsed.candidate === null, execution === 'in_app');
    at(NOW + 1000); await store.acceptGeminiEvaluation(attemptId, parsed);
    const sealed = structuredClone(savedAttempt(store, attemptId));
    const evaluation = structuredClone(store.state.assessments.evaluations[0]);
    assert.equal(evaluation.source, 'gemini-import'); assert.equal(evaluation.createdAt, NOW + 1000);
    assert.equal(evaluation.model, 'Gemini (reported)'); assert.equal(evaluation.promptVersion, 'gemini-assessment-1');
    assert.equal(evaluation.support, execution === 'gemini_live' ? 'external-claim' : 'no-answer-help-recorded');
    assert.equal(evaluation.result.percentage, 50); assert.equal(evaluation.result.earned, 10); assert.equal(evaluation.result.maximum, 20);
    assert.equal(sealed.state, 'submitted'); assert.equal(sealed.activeEvaluationId, evaluation.id);
    if (execution === 'gemini_live') {
      assert.equal(sealed.submission.kind, 'external'); assert.equal(sealed.submission.exportContextHash, sealed.exportContextHash);
      assert.match(sealed.submission.reportHash, /^[a-f0-9]{64}$/u);
    }
    const duplicate = await parseGeminiAssessmentReport(JSON.stringify(Object.fromEntries(Object.entries(report).reverse()), null, 2), sealed, def, { now: NOW + 9000 });
    assert.equal(duplicate.evaluation.id, evaluation.id); assert.equal(duplicate.evaluation.createdAt, NOW + 9000);
    at(NOW + 9000); await store.acceptGeminiEvaluation(attemptId, duplicate);
    assert.deepEqual(store.state.assessments.evaluations, [evaluation]);
    assert.deepEqual(savedAttempt(store, attemptId).submission, sealed.submission);
    assert.equal(savedAttempt(store, attemptId).submittedAt, sealed.submittedAt);
    assert.deepEqual(store.state.assessments.jobs, []);
    assert.deepEqual(learningOnly(store.state), learning); assert.deepEqual(memories(store.state), memory);
    store.close(); const reopened = await open();
    assert.deepEqual(reopened.state.assessments.evaluations, [evaluation]);
    const { store: destination } = await fixture(t);
    const raw = await reopened.export(); await destination.import(raw); await destination.import(raw);
    assert.deepEqual(destination.state.assessments, reopened.state.assessments);
    assert.deepEqual(memories(destination.state), memory);
  });
});

test('a parsed external candidate cannot seal a newer draft or replace an already sealed Live report', async t => {
  const { store } = await fixture(t); const def = definition('roleplay');
  await store.createAssessmentAttempt(def, { attemptId: 'live', execution: 'gemini_live' });
  const raw = geminiReport(savedAttempt(store, 'live'), def, minimalValidRawResult('conversation:1'));
  const candidate = await parseGeminiAssessmentReport(JSON.stringify(raw), savedAttempt(store, 'live'), def, { now: NOW });
  await store.saveAssessmentDraft('live', draft('Preparation changed'));
  await rejectsUnchanged(store, () => store.acceptGeminiEvaluation('live', candidate), /draft changed/);
  const latest = await parseGeminiAssessmentReport(JSON.stringify(raw), savedAttempt(store, 'live'), def, { now: NOW });
  const alternate = structuredClone(raw); alternate.result.retryEn = 'A different report for the same Live task.';
  const competing = await parseGeminiAssessmentReport(JSON.stringify(alternate), savedAttempt(store, 'live'), def, { now: NOW });
  await store.acceptGeminiEvaluation('live', latest);
  await rejectsUnchanged(store, () => store.acceptGeminiEvaluation('live', competing), /cannot be replaced/);
  assert.equal(store.state.assessments.evaluations.length, 1);
});

test('roleplay snapshots keep whole typed/transcribed utterances and exclude superseded answers, preparation and synthetic controls from learner evidence', async t => {
  const { store, open } = await fixture(t); const { attemptId, sessionId } = await startRoleplay(store);
  await store.saveAssessmentDraft(attemptId, draft('PREPARATION_ONLY: Ich bestelle einen Kaffee.'));
  const prepEvent = { id: 'preparation', kind: 'model_answer', phase: 'preparation', refId: null, at: NOW };
  await store.updateAIConversation(sessionId, session => { session.assessmentEvents.push(prepEvent); });
  await sendTurn(store, sessionId, { id: 'old-order', text: 'Ich möchte einen großen Kaffee.', replyDe: 'ALTE_PARTNERANTWORT' });
  await sendTurn(store, sessionId, { id: 'hint', text: 'SYNTHETIC_HINT', operation: 'hint', replyDe: 'Ich möchte einen kleinen Tee.' });
  await store.putRecording('price-audio', new Blob(['original price recording'], { type: 'audio/webm' }));
  await sendTurn(store, sessionId, { id: 'price', text: 'wie\n  viel kostet er', recordingMs: 2500, audioKey: 'price-audio' });
  await sendTurn(store, sessionId, { id: 'rephrase', text: 'SYNTHETIC_REPHRASE', operation: 'rephrase' });
  await sendTurn(store, sessionId, { id: 'payment', text: '  Kann ich mit Karte bezahlen?\n' });
  await sendTurn(store, sessionId, { id: 'edit-one', text: 'Ich möchte ein Tee.', supersedes: 'old-order', replyDe: 'ZWISCHENANTWORT' });
  await sendTurn(store, sessionId, { id: 'edit-final', text: 'Ich möchte einen kleinen Tee.\n', supersedes: 'edit-one' });
  const session = structuredClone(savedConversation(store, sessionId)); const before = structuredClone(session);
  const submission = buildRoleplaySubmission(session);
  assert.deepEqual(session, before);
  const evidence = assessmentEvidence(submission);
  assert.deepEqual(evidence, [
    { id: 'price', role: 'learner', phase: 'assessment', inputMode: 'transcribed', text: 'wie\n  viel kostet er', audioKey: 'price-audio', edited: false },
    { id: 'payment', role: 'learner', phase: 'assessment', inputMode: 'typed', text: '  Kann ich mit Karte bezahlen?\n', audioKey: '', edited: false },
    { id: 'edit-final', role: 'learner', phase: 'assessment', inputMode: 'typed', text: 'Ich möchte einen kleinen Tee.\n', audioKey: '', edited: true },
  ]);
  assert.deepEqual(submission.turns.filter(turn => turn.role === 'control').map(turn => [turn.id, turn.text, turn.inputMode]), [['hint', '', 'control'], ['rephrase', '', 'control']]);
  assert.doesNotMatch(JSON.stringify(submission), /SYNTHETIC_|PREPARATION_ONLY|ALTE_PARTNERANTWORT|ZWISCHENANTWORT|großen Kaffee/);
  assert.equal(submission.turns[0].text, 'Guten Tag! Was möchten Sie trinken?');
  assert.deepEqual(submission.events, [prepEvent,
    { id: 'operation:hint', kind: 'answer_hint', phase: 'assessment', refId: 'hint', at: NOW },
    { id: 'operation:rephrase', kind: 'question_rephrase', phase: 'assessment', refId: 'rephrase', at: NOW }]);
  const sealed = await store.submitAssessment(attemptId);
  assert.deepEqual(sealed.submission, submission);
  assert.equal(savedConversation(store, sessionId).endedAt, NOW);
  assert.deepEqual(savedAttempt(await open(), attemptId).submission, submission);
  assert.deepEqual(store.state.attempts, []); assert.deepEqual(store.state.starter.reviews, []);
  for (const [refId, quote] of [['old-order', 'Ich möchte einen großen Kaffee.'], ['edit-one', 'Ich möchte ein Tee.'], ['hint:partner', 'Ich möchte einen kleinen Tee.']]) {
    assert.throws(() => validateRubricResult(minimalValidRawResult('conversation:1', { refId, quote }), 'conversation:1', sealed.submission), /absent from the learner evidence/);
  }
});

test('help buttons, superseded replies and empty utterances cannot satisfy the three-reply minimum', async t => {
  const { store } = await fixture(t); const { attemptId, sessionId } = await startRoleplay(store);
  await sendTurn(store, sessionId, { id: 'first', text: 'Tee, bitte.' });
  await sendTurn(store, sessionId, { id: 'replacement', text: 'Einen kleinen Tee.', supersedes: 'first' });
  await sendTurn(store, sessionId, { id: 'blank', text: ' \n\t ' });
  await sendTurn(store, sessionId, { id: 'hint', text: '', operation: 'hint' });
  await sendTurn(store, sessionId, { id: 'repeat', text: '', operation: 'rephrase' });
  await rejectsUnchanged(store, () => store.submitAssessment(attemptId), /three actual learner replies/);
  await sendTurn(store, sessionId, { id: 'price', text: 'Was kostet er?' });
  await rejectsUnchanged(store, () => store.submitAssessment(attemptId), /three actual learner replies/);
  await sendTurn(store, sessionId, { id: 'pay', text: 'Mit Karte, bitte.' });
  assert.equal((await store.submitAssessment(attemptId)).state, 'submitted');
});

test('unsent text, untranscribed audio and a pending control turn block sealing without ending the conversation', async t => {
  const { store } = await fixture(t); const { attemptId, sessionId } = await startRoleplay(store);
  await threeReplies(store, sessionId);
  for (const patch of [{ text: 'Noch eine Frage.' }, { audioKey: 'unsent-audio' }, { recordingMs: 1000 },
    { operation: 'hint', status: 'sending' }, { text: 'Failed draft remains evidence.', status: 'error' }]) {
    await store.saveAIDraft(sessionId, { ...newAIDraft(NOW), ...patch });
    await rejectsUnchanged(store, () => store.submitAssessment(attemptId), /Send or discard your unfinished answer/);
    assert.equal(savedConversation(store, sessionId).endedAt, null); assert.equal(savedAttempt(store, attemptId).submission, null);
  }
  await store.saveAIDraft(sessionId, newAIDraft(NOW));
  const sealed = await store.submitAssessment(attemptId);
  const closed = savedConversation(store, sessionId);
  await rejectsUnchanged(store, () => store.completeAITurn(sessionId, turnResult(closed, 'Late extra answer.')), /newer draft replaced/);
  assert.deepEqual(savedAttempt(store, attemptId), sealed);
});

test('a new conversation turn arriving while hashing cannot be omitted from the sealed evidence', async t => {
  const { store, open, inspect } = await fixture(t); const { attemptId, sessionId } = await startRoleplay(store);
  await threeReplies(store, sessionId);
  const other = await open(); const hash = pauseNextHash(t);
  const rejected = assert.rejects(store.submitAssessment(attemptId), /conversation changed while saving/);
  await hash.started;
  await sendTurn(other, sessionId, { id: 'last', text: 'Vielen Dank und auf Wiedersehen!' });
  const current = structuredClone(other.state);
  hash.release(); await rejected;
  assert.deepEqual(await inspect(), current); assert.equal(savedConversation(other, sessionId).endedAt, null);
  await store.refresh();
  assert.equal(assessmentEvidence((await store.submitAssessment(attemptId)).submission).at(-1).text, 'Vielen Dank und auf Wiedersehen!');
});

test('grading keeps the full history beyond the twelve-turn chat window, then rejects the evidence-unit cap without truncation', async t => {
  for (const count of [13, 31, 32]) await t.test(`${count} replies`, async t => {
    const { store } = await fixture(t); const { attemptId, sessionId } = await startRoleplay(store);
    for (let index = 1; index <= count; index += 1) await sendTurn(store, sessionId, { id: `reply-${index}`, text: `Antwort ${index}: Tee, bitte.`, replyDe: `Frage ${index}?` });
    const session = savedConversation(store, sessionId);
    assert.equal(aiHistory(session).length, 12);
    const submission = buildRoleplaySubmission(session);
    assert.equal(assessmentEvidence(submission).length, count);
    assert.equal(assessmentEvidence(submission)[0].text, 'Antwort 1: Tee, bitte.');
    assert.equal(assessmentEvidence(submission).at(-1).text, `Antwort ${count}: Tee, bitte.`);
    if (count === 32) {
      assert.equal(submission.turns.length, 65);
      await rejectsUnchanged(store, () => store.submitAssessment(attemptId), /complete assessed segment/);
      assert.equal(savedConversation(store, sessionId).turns.length, 32); assert.equal(savedConversation(store, sessionId).endedAt, null);
    } else {
      const sealed = await store.submitAssessment(attemptId);
      assert.deepEqual(sealed.submission, submission);
      assert.equal(sealed.submission.turns.length, count === 13 ? 27 : 63);
    }
  });
});

test('the full 8000-character evidence limit counts partner context and rejects one extra character atomically', async t => {
  for (const extra of [0, 1]) await t.test(`${8000 + extra} characters`, async t => {
    const { store } = await fixture(t); const { attemptId, sessionId } = await startRoleplay(store);
    const opening = savedConversation(store, sessionId).context.openingDe;
    const partner = 'Danke.';
    const final = 'Ende.' + 'c'.repeat(8000 + extra - opening.length - partner.length * 3 - 5400 - 5);
    for (const [id, text] of [['first', 'a'.repeat(2700)], ['middle', 'b'.repeat(2700)], ['last', final]]) {
      await sendTurn(store, sessionId, { id, text, replyDe: partner });
    }
    const submission = buildRoleplaySubmission(savedConversation(store, sessionId));
    assert.equal(submission.turns.reduce((length, turn) => length + turn.text.length, 0), 8000 + extra);
    assert.equal(assessmentEvidence(submission).at(-1).text, final);
    if (extra) {
      await rejectsUnchanged(store, () => store.submitAssessment(attemptId), /too long.*no turns were silently dropped/);
      assert.equal(savedConversation(store, sessionId).endedAt, null);
    } else assert.deepEqual((await store.submitAssessment(attemptId)).submission, submission);
  });
});

test('sealed assessment audio alone blocks overwrites across tabs; deletion and blob-free transfers preserve the evidence', async t => {
  const def = definition('roleplay');
  const prepared = await prepareAssessmentAttempt(def, { attemptId: 'archived-roleplay', now: NOW });
  const state = newState(NOW);
  state.assessments = addPreparedAssessment(state.assessments, prepared);
  const submission = { kind: 'roleplay', complete: true, events: [], turns: [
    { id: 'one', role: 'learner', phase: 'assessment', inputMode: 'transcribed', text: 'Einen kleinen Tee, bitte.', audioKey: 'sealed-audio', edited: false },
    { id: 'two', role: 'learner', phase: 'assessment', inputMode: 'typed', text: 'Was kostet er?', audioKey: '', edited: false },
    { id: 'three', role: 'learner', phase: 'assessment', inputMode: 'typed', text: 'Mit Karte, bitte.', audioKey: '', edited: false },
  ] };
  validateAssessmentSubmission(def, submission);
  state.assessments = saveSealedAssessment(state.assessments, await prepareAssessmentSubmission(prepared.attempt, def, submission), NOW);
  const { store, open } = await fixture(t);
  await store.putRecording('sealed-audio', new Blob(['original sealed audio'], { type: 'audio/webm' }));
  const stale = await open();
  await store.import(backup(state));
  assert.deepEqual(store.state.aiSessions, []); assert.deepEqual(store.state.attempts, []); assert.deepEqual(store.state.starter.sessions, []);
  assert.deepEqual(stale.state.assessments.attempts, [], 'The stale tab must use transaction state, not its old snapshot, to protect audio.');
  const before = structuredClone(store.state);
  await assert.rejects(stale.putRecording('sealed-audio', new Blob(['replacement'])), /submitted assessment/);
  assert.equal(await (await store.getRecording('sealed-audio')).text(), 'original sealed audio');
  assert.deepEqual(await store.refresh(), before);
  await store.putRecording('unreferenced', new Blob(['draft']));
  await store.putRecording('unreferenced', new Blob(['new draft']));
  assert.equal(await (await store.getRecording('unreferenced')).text(), 'new draft');
  const exported = await store.export();
  assert.doesNotMatch(exported, /original sealed audio|new draft/);
  await store.deleteRecordings();
  assert.equal(await store.getRecording('sealed-audio'), undefined); assert.equal(await store.recordingSize(), 0);
  assert.deepEqual((await open()).state.assessments, before.assessments);
  assert.deepEqual(JSON.parse(await store.export()).state.assessments, before.assessments);
  const { store: destination } = await fixture(t);
  await destination.import(exported); await destination.import(exported);
  assert.equal(await destination.getRecording('sealed-audio'), undefined);
  assert.deepEqual(destination.state.assessments, before.assessments);
  await verifyAssessmentHashes(destination.state.assessments);
});
