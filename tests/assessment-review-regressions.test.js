import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { deleteDB } from 'idb';
import { createStore } from '../app/js/store.js';
import { validateState } from '../app/js/model.js';
import { newAIDraft } from '../app/js/ai-state.js';
import { createAIClient, GatewayError } from '../app/js/ai-gateway.js';
import { evaluationRequest, verifyAssessmentHashes } from '../app/js/assessment-state.js';
import { runAssessmentJob } from '../app/js/assessment-jobs.js';
import { parseGeminiAssessmentReport } from '../app/js/assessment-gemini.js';
import { validateAssessmentPack } from '../shared/assessment-contracts.js';
import { createGateway } from '../worker/index.js';
import { RequestLedger } from '../worker/ledger.js';
import { sqliteD1 } from '../worker/sqlite-adapter.js';
import { sha256 } from '../worker/auth.js';
import { loadLocalAssessment } from '../tools/assessment-definitions.js';
import { createMockProvider, TEST_ACCESS_CODE, TEST_SESSION_SECRET } from '../tools/mock-ai-provider.js';

const NOW = Date.parse('2026-10-09T12:00:00Z');
const BASE = 'http://localhost:8787';
const EVALUATIONS = '/api/v1/assessments/evaluations';
const pack = validateAssessmentPack(JSON.parse(await readFile(new URL('../app/public/assessments/pilot-cafe-a-v1.json', import.meta.url), 'utf8')));
const migration = await readFile(new URL('../worker/migrations/0001_ai.sql', import.meta.url), 'utf8');
const definition = kind => structuredClone(pack.definitions.find(item => item.kind === kind));
const WRITING = '  Hallo Mia!\nMöchtest du am Montag um zehn Uhr im Café am Park Kaffee trinken? Hast du Zeit? Liebe Grüße!  ';
const REPLIES = ['Einen kleinen Tee, bitte.', 'Was kostet er?', 'Mit Karte, bitte.'];
const savedAttempt = (store, id) => store.state.assessments.attempts.find(item => item.id === id);
const savedSession = (store, id) => store.state.aiSessions.find(item => item.id === id);
const savedJob = (store, id) => store.state.assessments.jobs.find(item => item.id === id);
const backup = state => JSON.stringify({ app: 'sprich', format: 1, exportedAt: NOW, state });
const sealedResponse = attempt => structuredClone({ definitionHash: attempt.definitionHash, mode: attempt.mode,
  submittedAt: attempt.submittedAt, submissionHash: attempt.submissionHash, submission: attempt.submission });

test.beforeEach(t => {
  t.mock.method(globalThis, 'fetch', () => { assert.fail('Regression tests must use the injected in-memory gateway and mock provider.'); });
});

async function device(t, clock = { time: NOW }) {
  const name = `assessment-review-${crypto.randomUUID()}`;
  const stores = [];
  const open = async () => {
    const store = await createStore({ name, now: () => clock.time });
    stores.push(store);
    return store;
  };
  t.after(async () => { stores.forEach(store => store.close()); await deleteDB(name); });
  return { store: await open(), open, clock };
}

async function rejectsImportUnchanged(target, raw, pattern) {
  const before = structuredClone(await target.store.refresh());
  await assert.rejects(target.store.import(raw, true), pattern);
  assert.deepEqual(target.store.state, before, 'A refused import must preserve the whole in-memory state.');
  assert.deepEqual(await target.store.refresh(), before, 'A refused import must not partially commit progress.');
  assert.deepEqual((await target.open()).state, before, 'The original work must survive reopening.');
}

async function startRoleplay(store) {
  const attemptId = await store.createAssessmentAttempt(definition('roleplay'), { attemptId: 'shared-roleplay', mode: 'checkpoint' });
  const sessionId = await store.startAssessmentConversation(attemptId);
  return { attemptId, sessionId };
}

function turnResult(session, transcript) {
  return { requestId: session.draft.requestId, sessionId: session.id, assessmentRef: structuredClone(session.assessmentRef),
    inputStatus: 'clear', transcript, reply: { replyDe: 'Danke. Haben Sie noch eine Frage?', meaningEn: 'Thank you. Do you have another question?', action: 'question' },
    model: 'fixture-partner', promptVersion: 'fixture-roleplay-1', usage: { inputTokens: 10, outputTokens: 5 } };
}

async function reply(store, sessionId, index, text = REPLIES[index]) {
  await store.saveAIDraft(sessionId, { ...newAIDraft(NOW + index), requestId: `reply-${index + 1}`, text, status: 'sending' });
  await store.completeAITurn(sessionId, turnResult(savedSession(store, sessionId), text));
}

async function writingJob(store) {
  const attemptId = await store.createAssessmentAttempt(definition('writing'), { attemptId: 'saved-writing', mode: 'checkpoint' });
  await store.saveAssessmentDraft(attemptId, { answers: {}, text: WRITING, events: [] });
  const attempt = await store.submitAssessment(attemptId);
  const job = await store.ensureAssessmentJob(attemptId, { requestId: 'original-grade' });
  return { attempt, job };
}

function reportFor(attempt, def) {
  const external = attempt.execution === 'gemini_live';
  const criteria = def.kind === 'writing' ? ['task', 'organisation', 'vocabulary', 'grammar', 'mechanics']
    : ['task', 'interaction', 'clarity', 'vocabulary', 'grammar'];
  return { app: 'sprich-assessment', schemaVersion: 1, attemptId: attempt.id, definitionId: def.id, definitionVersion: def.version,
    rubricId: def.rubricId, scope: external ? 'external-live' : 'submitted-text', bindingHash: external ? attempt.exportContextHash : attempt.submissionHash,
    result: { ratings: criteria.map((id, score) => ({ id, score, reasonEn: 'Synthetic criterion feedback for a transfer regression.',
      evidence: [{ refId: external ? null : 'writing', quote: external ? REPLIES[0] : 'Hallo Mia!' }] })),
    strengths: [], corrections: [], retryDe: 'Versuche es mit einem anderen Tag.', retryEn: 'Try again with a different day.' } };
}

async function importReport(target, raw, attemptId, def) {
  const parsed = await parseGeminiAssessmentReport(raw, savedAttempt(target.store, attemptId), def, { now: target.clock.time });
  await target.store.acceptGeminiEvaluation(attemptId, parsed);
  return structuredClone(target.store.state.assessments.evaluations[0]);
}

/** Real client, authentication, gateway and ledger; only the provider and network transport are fixtures. */
async function gateway(t) {
  const db = sqliteD1(':memory:');
  db.exec(migration);
  const background = [];
  t.after(async () => { await Promise.allSettled(background); db.close(); });
  const clock = { time: NOW };
  const control = { quota: false, dropNextGradeResponse: false };
  const provider = createMockProvider();
  const fetcher = t.mock.fn((url, options) => {
    assert.equal(url, 'https://api.groq.com/openai/v1/chat/completions');
    if (control.quota) return Response.json({ error: 'Synthetic provider quota' }, { status: 429, headers: { 'Retry-After': '2' } });
    return provider.fetch(url, options);
  });
  const env = { AI_DB: db, OWNER_TOKEN_HASH: await sha256(TEST_ACCESS_CODE), SESSION_SECRET: TEST_SESSION_SECRET,
    GROQ_API_KEY: 'test-only-assessment-review-key', GROQ_FREE_TIER_CONFIRMED: 'true', AI_DAILY_REVIEWS: '50', AI_MINUTE_TURNS: '100' };
  const worker = createGateway({ fetcher, now: () => clock.time, testMode: true, loadAssessmentDefinition: loadLocalAssessment,
    logger: { warn: t.mock.fn(), error: t.mock.fn() } });
  const ledger = new RequestLedger(db, () => clock.time);
  const calls = [];
  let cookie = '';
  const client = createAIClient({ baseUrl: `${BASE}/api/v1`, polls: 1, fetchImpl: async (url, options = {}) => {
    const address = new URL(url);
    assert.equal(address.origin, BASE);
    const headers = new Headers(options.headers);
    headers.set('Origin', BASE);
    if (cookie) headers.set('Cookie', cookie);
    const request = new Request(address, { ...options, headers });
    calls.push({ method: request.method, path: address.pathname, body: options.body === undefined ? null : JSON.parse(options.body) });
    const response = await worker.fetch(request, env, { waitUntil: promise => { background.push(promise); } });
    const setCookie = response.headers.get('Set-Cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    if (control.dropNextGradeResponse && address.pathname === EVALUATIONS && request.method === 'POST' && response.ok) {
      control.dropNextGradeResponse = false;
      throw new TypeError('Synthetic connection loss after the gateway saved the grade.');
    }
    return response;
  } });
  await client.unlock(TEST_ACCESS_CODE);
  return { client, ledger, clock, control, fetcher, calls, gradePosts: () => calls.filter(call => call.method === 'POST' && call.path === EVALUATIONS) };
}

test('sealed roleplay transfers reject unsent typed/audio answers and extra completed turns in both directions', async t => {
  for (const conflict of ['typed draft', 'audio draft', 'extra completed turn']) {
    for (const direction of ['into unfinished device', 'into submitted device']) await t.test(`${conflict}, ${direction}`, async t => {
      const pending = await device(t); const submitted = await device(t);
      const { attemptId, sessionId } = await startRoleplay(pending.store);
      for (let index = 0; index < REPLIES.length; index++) await reply(pending.store, sessionId, index);
      await submitted.store.import(await pending.store.export());
      pending.clock.time = NOW + 1000;
      const audioKey = 'unsent-roleplay-audio';
      if (conflict === 'typed draft') {
        await pending.store.saveAIDraft(sessionId, { ...savedSession(pending.store, sessionId).draft, text: '  Und ein Glas Wasser, bitte.\n' });
      } else if (conflict === 'audio draft') {
        await pending.store.putRecording(audioKey, new Blob(['original unsent audio'], { type: 'audio/webm' }));
        await pending.store.saveAIDraft(sessionId, { ...savedSession(pending.store, sessionId).draft, audioKey, recordingMs: 1500 });
      } else await reply(pending.store, sessionId, 3, 'Und ein Glas Wasser, bitte.');
      submitted.clock.time = NOW + 2000;
      await submitted.store.submitAssessment(attemptId);
      assert.ok(savedSession(submitted.store, sessionId).updatedAt > savedSession(pending.store, sessionId).updatedAt,
        'Exercise the newer sealed snapshot that previously replaced the local draft.');
      const pendingBefore = structuredClone(pending.store.state);
      const submittedBefore = structuredClone(submitted.store.state);
      const target = direction === 'into unfinished device' ? pending : submitted;
      const source = direction === 'into unfinished device' ? submitted : pending;
      await rejectsImportUnchanged(target, await source.store.export(), conflict === 'extra completed turn' ? /additional local turns/ : /unsent roleplay answer/);
      assert.deepEqual(await pending.store.refresh(), pendingBefore);
      assert.deepEqual(await submitted.store.refresh(), submittedBefore);
      assert.equal(savedAttempt(pending.store, attemptId).state, 'in_progress');
      assert.equal(savedSession(pending.store, sessionId).endedAt, null);
      if (conflict === 'audio draft') assert.equal(await (await pending.store.getRecording(audioKey)).text(), 'original unsent audio');
    });
  }
});

test('blank, older-prefix and equal unsubmitted roleplays accept the compatible sealed conversation in both directions', async t => {
  for (const count of [0, 1, 3]) {
    for (const direction of ['into unfinished device', 'into submitted device']) await t.test(`${count} existing replies, ${direction}`, async t => {
      const pending = await device(t); const submitted = await device(t);
      const { attemptId, sessionId } = await startRoleplay(pending.store);
      for (let index = 0; index < count; index++) await reply(pending.store, sessionId, index);
      await submitted.store.import(await pending.store.export());
      submitted.clock.time = NOW + 2000;
      for (let index = count; index < REPLIES.length; index++) await reply(submitted.store, sessionId, index);
      const sealed = structuredClone(await submitted.store.submitAssessment(attemptId));
      const conversation = structuredClone(savedSession(submitted.store, sessionId));
      const target = direction === 'into unfinished device' ? pending : submitted;
      const source = direction === 'into unfinished device' ? submitted : pending;
      const raw = await source.store.export();
      await target.store.import(raw); await target.store.import(raw);
      const reopened = await target.open();
      assert.deepEqual(savedAttempt(reopened, attemptId), sealed);
      assert.deepEqual(savedSession(reopened, sessionId), conversation);
      assert.equal(reopened.state.aiSessions.length, 1);
      assert.equal(reopened.state.assessments.attempts.length, 1);
      assert.deepEqual(reopened.state.attempts, []);
      assert.deepEqual(reopened.state.starter.reviews, []);
    });
  }
});

test('the same Gemini report independently imported on two devices reconciles receipt times without duplicate grades', async t => {
  for (const execution of ['gemini_live', 'in_app']) {
    for (const direction of ['earlier into later', 'later into earlier']) await t.test(`${execution}, ${direction}`, async t => {
      const earlier = await device(t); const later = await device(t);
      const def = definition(execution === 'gemini_live' ? 'roleplay' : 'writing');
      const attemptId = await earlier.store.createAssessmentAttempt(def, { attemptId: 'same-gemini-report', execution, mode: 'checkpoint' });
      if (execution === 'in_app') {
        await earlier.store.saveAssessmentDraft(attemptId, { answers: {}, text: WRITING, events: [] });
        await earlier.store.submitAssessment(attemptId);
      }
      await later.store.import(await earlier.store.export());
      const raw = JSON.stringify(reportFor(savedAttempt(earlier.store, attemptId), def));
      earlier.clock.time = NOW + 1000; later.clock.time = NOW + 2000;
      const first = await importReport(earlier, raw, attemptId, def);
      const second = await importReport(later, raw, attemptId, def);
      assert.equal(first.id, second.id); assert.notEqual(first.createdAt, second.createdAt);
      assert.deepEqual({ ...second, createdAt: first.createdAt }, first);
      assert.equal(first.result.percentage, 50);
      const target = direction === 'earlier into later' ? later : earlier;
      const source = direction === 'earlier into later' ? earlier : later;
      const sealed = sealedResponse(savedAttempt(target.store, attemptId));
      const transfer = await source.store.export();
      await target.store.import(transfer); await target.store.import(transfer);
      await source.store.import(await target.store.export());
      for (const item of [target, source]) {
        const reopened = await item.open();
        assert.deepEqual(reopened.state.assessments.evaluations, [first]);
        assert.equal(reopened.state.assessments.attempts.length, 1);
        assert.equal(savedAttempt(reopened, attemptId).activeEvaluationId, first.id);
      }
      assert.deepEqual(sealedResponse(savedAttempt(target.store, attemptId)), sealed);
    });
  }
});

const keyedDraft = () => ({ text: '', events: [], answers: { 'cafe.a.vocab.tea': 'tea',
  'cafe.a.grammar.prepositions': { day: 'am', time: 'am' }, 'cafe.a.grammar.order': ['can', 'i', 'please', 'card', 'pay'],
  'cafe.a.reading.hours': { open: '08:00' } } });

test('identical keyed responses independently submitted on two devices merge once despite different checker times', async t => {
  for (const direction of ['earlier into later', 'later into earlier']) await t.test(direction, async t => {
    const earlier = await device(t); const later = await device(t);
    const attemptId = await earlier.store.createAssessmentAttempt(definition('objective'), { attemptId: 'same-keyed-response' });
    await earlier.store.saveAssessmentDraft(attemptId, keyedDraft());
    await later.store.import(await earlier.store.export());
    earlier.clock.time = NOW + 1000; later.clock.time = NOW + 2000;
    await earlier.store.submitAssessment(attemptId); await later.store.submitAssessment(attemptId);
    const first = structuredClone(earlier.store.state.assessments.evaluations[0]);
    const second = later.store.state.assessments.evaluations[0];
    assert.equal(first.id, second.id); assert.notEqual(first.createdAt, second.createdAt);
    assert.deepEqual({ ...second, createdAt: first.createdAt }, first);
    assert.equal(first.result.earned, 5); assert.equal(first.result.maximum, 20); assert.equal(first.result.percentage, 25);
    const target = direction === 'earlier into later' ? later : earlier;
    const source = direction === 'earlier into later' ? earlier : later;
    const sealed = sealedResponse(savedAttempt(target.store, attemptId));
    const raw = await source.store.export();
    await target.store.import(raw); await target.store.import(raw);
    await source.store.import(await target.store.export());
    for (const item of [target, source]) {
      const reopened = await item.open();
      assert.deepEqual(reopened.state.assessments.evaluations, [first]);
      assert.equal(reopened.state.assessments.attempts.length, 1);
      assert.equal(savedAttempt(reopened, attemptId).activeEvaluationId, first.id);
    }
    assert.deepEqual(sealedResponse(savedAttempt(target.store, attemptId)), sealed);
  });
});

test('timestamp reconciliation still rejects changed Gemini grading content under the same evaluation ID', async t => {
  for (const change of ['feedback', 'rating and recomputed total']) await t.test(change, async t => {
    const target = await device(t); const def = definition('roleplay');
    const attemptId = await target.store.createAssessmentAttempt(def, { execution: 'gemini_live' });
    await importReport(target, JSON.stringify(reportFor(savedAttempt(target.store, attemptId), def)), attemptId, def);
    const incoming = structuredClone(target.store.state);
    const evaluation = incoming.assessments.evaluations[0];
    evaluation.createdAt += 1000;
    if (change === 'feedback') evaluation.result.raw.retryEn = 'A different report despite the reused ID.';
    else {
      evaluation.result.raw.ratings[0].score = 4;
      evaluation.result.earned = 14; evaluation.result.percentage = 70;
    }
    // Make the conflict reach immutable merge comparison, rather than failing shape or arithmetic checks.
    validateState(incoming); await verifyAssessmentHashes(incoming.assessments);
    await rejectsImportUnchanged(target, backup(incoming), /Conflicting immutable assessment records/);
  });
});

test('different legitimately checked answers still conflict when their local evaluation ID is the same', async t => {
  const local = await device(t); const remote = await device(t);
  const attemptId = await local.store.createAssessmentAttempt(definition('objective'), { attemptId: 'conflicting-keyed-response' });
  await local.store.saveAssessmentDraft(attemptId, keyedDraft());
  await remote.store.import(await local.store.export());
  const changed = keyedDraft(); changed.answers['cafe.a.vocab.tea'] = 'coffee';
  await remote.store.saveAssessmentDraft(attemptId, changed);
  local.clock.time = NOW + 1000; remote.clock.time = NOW + 2000;
  await local.store.submitAssessment(attemptId); await remote.store.submitAssessment(attemptId);
  const left = local.store.state.assessments.evaluations[0]; const right = remote.store.state.assessments.evaluations[0];
  assert.equal(left.id, right.id); assert.notEqual(left.result.earned, right.result.earned);
  validateState(remote.store.state); await verifyAssessmentHashes(remote.store.state.assessments);
  await rejectsImportUnchanged(local, await remote.store.export(), /Conflicting immutable assessment records/);
});

test('two actual provider 429s exhaust the ledger request; an explicit new job grades the unchanged sealed response', async t => {
  const h = await gateway(t); const target = await device(t, h.clock);
  const { attempt, job } = await writingJob(target.store);
  const sealed = sealedResponse(attempt);
  const originalPayload = evaluationRequest(target.store.state.assessments, job);
  h.control.quota = true;
  await assert.rejects(runAssessmentJob(target.store, h.client, job.id), error => error instanceof GatewayError && error.status === 429 && error.code === 'provider_quota');
  assert.equal(savedJob(target.store, job.id).state, 'retryable');
  assert.equal((await h.ledger.get(job.id)).attempts, 1);
  h.clock.time += 2000;
  await assert.rejects(runAssessmentJob(target.store, h.client, job.id), error => error.status === 409 && error.code === 'retry_exhausted');
  const exhausted = await h.ledger.get(job.id);
  assert.equal(exhausted.status, 'failed'); assert.equal(exhausted.attempts, 2);
  assert.equal(JSON.parse(exhausted.error_json).code, 'retry_exhausted');
  assert.equal(exhausted.response_json, null);
  assert.equal(savedJob(target.store, job.id).state, 'failed');
  assert.equal(savedJob(target.store, job.id).lastError.code, 'retry_exhausted');
  assert.deepEqual(target.store.state.assessments.evaluations, []);
  assert.equal(h.fetcher.mock.callCount(), 2);

  h.control.quota = false; h.clock.time += 2000;
  await assert.rejects(h.client.receipt(job.id), error => error.code === 'retry_exhausted');
  assert.equal((await target.store.ensureAssessmentJob(attempt.id)).id, job.id);
  await assert.rejects(runAssessmentJob(target.store, h.client, job.id), error => error.code === 'retry_exhausted');
  assert.equal(h.gradePosts().length, 2, 'Retrying a terminal local job must not issue another grading POST.');
  assert.equal(h.fetcher.mock.callCount(), 2);
  const fresh = await target.store.ensureAssessmentJob(attempt.id, { requestId: 'after-quota-recovery', retryUncertain: true });
  assert.notEqual(fresh.id, job.id); assert.equal(fresh.submissionHash, job.submissionHash);
  const evaluation = await runAssessmentJob(target.store, h.client, fresh.id);
  assert.equal(evaluation.id, fresh.id); assert.equal(evaluation.attemptId, attempt.id);
  assert.equal(evaluation.source, 'gateway-ai'); assert.equal(evaluation.testMode, true);
  assert.equal(evaluation.result.percentage, 75);
  assert.equal(h.fetcher.mock.callCount(), 3);
  assert.deepEqual(h.gradePosts().map(call => call.body.requestId), [job.id, job.id, fresh.id]);
  for (const call of h.gradePosts()) assert.deepEqual({ ...call.body, requestId: job.id }, originalPayload);
  assert.equal((await h.ledger.get(job.id)).status, 'failed');
  assert.equal((await h.ledger.get(fresh.id)).status, 'complete');
  const reopened = await target.open();
  assert.deepEqual(sealedResponse(savedAttempt(reopened, attempt.id)), sealed);
  assert.deepEqual(reopened.state.assessments.evaluations, [evaluation]);
  assert.equal(savedJob(reopened, job.id).state, 'failed'); assert.equal(savedJob(reopened, fresh.id).state, 'complete');
  assert.deepEqual(reopened.state.attempts, []); assert.deepEqual(reopened.state.starter.reviews, []);
});

test('a locked receipt remains recoverable after unlocking, including legacy failed/locked jobs', async t => {
  for (const legacy of [false, true]) await t.test(legacy ? 'legacy failed/locked receipt' : 'pending receipt receives 401', async t => {
    const h = await gateway(t); const target = await device(t, h.clock);
    const { attempt, job } = await writingJob(target.store);
    const sealed = sealedResponse(attempt);
    h.control.dropNextGradeResponse = true;
    await assert.rejects(runAssessmentJob(target.store, h.client, job.id), error => error.code === 'network');
    const receipt = await h.ledger.get(job.id);
    assert.equal(receipt.status, 'complete');
    const original = JSON.parse(receipt.response_json);
    assert.equal(savedJob(target.store, job.id).state, 'pending');
    assert.deepEqual(target.store.state.assessments.evaluations, []);
    await h.client.lock();
    await assert.rejects(runAssessmentJob(target.store, h.client, job.id, { recoverOnly: true }), error => error.status === 401 && error.code === 'locked');
    assert.equal(savedJob(target.store, job.id).state, 'pending');
    assert.equal(savedJob(target.store, job.id).lastError.code, 'locked');
    if (legacy) {
      // Persist the old client's failed/locked shape; recovery must work after a real reload too.
      await target.store.updateAssessmentJob(job.id, { state: 'failed', lastError: { code: 'locked', message: 'Unlock the private AI connection first.' } });
    }
    const reopened = await target.open();
    assert.equal(savedJob(reopened, job.id).state, legacy ? 'failed' : 'pending');
    assert.equal(h.gradePosts().length, 1);
    await h.client.unlock(TEST_ACCESS_CODE);
    const recovered = await runAssessmentJob(reopened, h.client, job.id, { recoverOnly: true });
    assert.deepEqual(recovered, original);
    assert.deepEqual(reopened.state.assessments.evaluations, [original]);
    assert.equal(reopened.state.assessments.jobs.length, 1);
    assert.equal(savedJob(reopened, job.id).state, 'complete'); assert.equal(savedJob(reopened, job.id).lastError, null);
    assert.deepEqual(sealedResponse(savedAttempt(reopened, attempt.id)), sealed);
    assert.equal(h.gradePosts().length, 1, 'Unlocking and recovery must issue zero additional grading POSTs.');
    assert.equal(h.fetcher.mock.callCount(), 1, 'Recover the original server grade instead of generating another one.');
    assert.deepEqual(h.calls.filter(call => call.method === 'GET').map(call => call.path), [`/api/v1/requests/${job.id}`, `/api/v1/requests/${job.id}`]);
  });
});

test('a stale tab cannot clear sending audio, replace its draft or overwrite its blob; completion preserves transcription provenance', async t => {
  const target = await device(t);
  const { attemptId, sessionId } = await startRoleplay(target.store);
  const audioKey = 'sending-roleplay-audio';
  await target.store.putRecording(audioKey, new Blob(['original recorded utterance'], { type: 'audio/webm' }));
  await target.store.saveAIDraft(sessionId, { ...savedSession(target.store, sessionId).draft, audioKey, recordingMs: 1850 });
  const stale = await target.open();
  const staleState = structuredClone(stale.state);
  const oldDraft = structuredClone(savedSession(stale, sessionId).draft);
  await target.store.saveAIDraft(sessionId, { ...oldDraft, status: 'sending' });
  const sendingState = structuredClone(target.store.state);
  const sending = structuredClone(savedSession(target.store, sessionId).draft);
  assert.equal(savedSession(stale, sessionId).draft.status, 'draft');
  for (const changed of [oldDraft,
    { ...sending, text: '', recordingMs: 0, audioKey: '' },
    { ...sending, text: 'Einen Tee, bitte.', recordingMs: 0, audioKey: '' },
    { ...sending, recordingMs: 2400, audioKey: 'replacement-audio' },
  ]) {
    await assert.rejects(stale.saveAIDraft(sessionId, changed), /being sent/);
    assert.deepEqual(stale.state, staleState, 'A failed stale save must not alter that tab\'s snapshot.');
    assert.deepEqual(await target.store.refresh(), sendingState, 'The transaction must protect the sending draft from stale metadata.');
  }
  await assert.rejects(stale.putRecording(audioKey, new Blob(['replacement audio'], { type: 'audio/webm' })), /being sent/);
  assert.equal(await (await target.store.getRecording(audioKey)).text(), 'original recorded utterance');
  assert.deepEqual(await target.store.refresh(), sendingState);
  const transcript = 'ich möchte einen kleinen tee';
  await target.store.completeAITurn(sessionId, turnResult(savedSession(target.store, sessionId), transcript));
  const completed = savedSession(target.store, sessionId).turns[0];
  assert.equal(completed.id, sending.requestId);
  assert.equal(completed.transcript, transcript); assert.equal(completed.inputMode, 'transcribed');
  assert.equal(completed.audioKey, audioKey); assert.equal(completed.recordingMs, 1850);
  assert.notEqual(savedSession(target.store, sessionId).draft.requestId, sending.requestId);
  for (const index of [1, 2]) await reply(target.store, sessionId, index);
  await target.store.submitAssessment(attemptId);
  const reopened = await target.open();
  assert.deepEqual(savedSession(reopened, sessionId).turns[0], completed);
  assert.deepEqual(savedAttempt(reopened, attemptId).submission.turns.find(turn => turn.id === completed.id), {
    id: completed.id, role: 'learner', phase: 'assessment', inputMode: 'transcribed', text: transcript, audioKey, edited: false,
  });
  assert.equal(await (await reopened.getRecording(audioKey)).text(), 'original recorded utterance');
});
