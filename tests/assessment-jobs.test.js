import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { deleteDB } from 'idb';
import { createStore } from '../app/js/store.js';
import { GatewayError } from '../app/js/ai-gateway.js';
import { runAssessmentJob } from '../app/js/assessment-jobs.js';
import { evaluationRequest } from '../app/js/assessment-state.js';
import { validateAssessmentPack } from '../shared/assessment-contracts.js';
import { rubricEvaluation } from '../shared/assessment-results.js';
import { assessmentRubric } from '../shared/assessment-rubrics.js';
import { createSession, tasksFor, draftFor, makeAttempt } from '../app/js/session.js';
import { reviewStates } from '../app/js/srs.js';

const pack = validateAssessmentPack(JSON.parse(await readFile(new URL('../app/public/assessments/pilot-cafe-a-v1.json', import.meta.url), 'utf8')));
const definition = pack.definitions.find(item => item.kind === 'writing');
const writing = 'Hallo Mia! Möchtest du am Montag um zehn Uhr mit mir im Café am Park Kaffee trinken? Hast du Zeit? Liebe Grüße!';

function grade(attempt, requestId) {
  return rubricEvaluation({ requestId, attemptId: attempt.id, definitionHash: attempt.definitionHash,
    submissionHash: attempt.submissionHash, mode: attempt.mode, definition, submission: attempt.submission,
    model: 'fixture-grader', promptVersion: 'assessment-fixture-1', testMode: true, now: 100,
    raw: { ratings: assessmentRubric(definition.rubricId).criteria.map(([id]) => ({ id, score: 3,
      reasonEn: 'The learner addresses the friend in a short invitation.', evidence: [{ refId: 'writing', quote: 'Hallo Mia!' }] })),
    strengths: ['The invitation addresses the friend.'], corrections: [], retryDe: 'Schreibe eine neue Einladung.', retryEn: 'Write a new invitation.' } });
}

async function addJob(store, text = writing) {
  const attemptId = await store.createAssessmentAttempt(definition);
  await store.saveAssessmentDraft(attemptId, { answers: {}, text, events: [] });
  const attempt = await store.submitAssessment(attemptId);
  const job = await store.ensureAssessmentJob(attemptId);
  return { attempt, job, evaluation: grade(attempt, job.id) };
}

async function fixture(t) {
  const name = `assessment-jobs-${crypto.randomUUID()}`;
  const stores = [];
  const open = async () => { const store = await createStore({ name }); stores.push(store); return store; };
  t.after(async () => { stores.forEach(store => store.close()); await deleteDB(name); });
  t.mock.method(globalThis, 'fetch', () => { assert.fail('Assessment job tests must use injected fake clients.'); });
  const store = await open();
  return { store, open, ...await addJob(store) };
}

function fakeClient({ post, receipt } = {}) {
  const calls = [];
  return {
    calls,
    async evaluateAssessment(payload, { signal } = {}) {
      calls.push({ method: 'POST', payload: structuredClone(payload), signal });
      assert.ok(post, 'Unexpected assessment POST');
      return post(payload, { signal });
    },
    async receipt(id, { signal } = {}) {
      calls.push({ method: 'GET', id, signal });
      assert.ok(receipt, 'Unexpected assessment receipt lookup');
      return receipt(id, { signal });
    },
  };
}

function deferred() {
  let resolve; let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const savedJob = (store, id) => store.state.assessments.jobs.find(job => job.id === id);
const savedAttempt = (store, id) => store.state.assessments.attempts.find(attempt => attempt.id === id);
const failure = (code, options = {}) => new GatewayError('Fixture transport detail', { code, ...options });

test('a queued job persists sending before one POST, then repeated complete runs return the saved grade', async t => {
  const { store, open, job, attempt, evaluation } = await fixture(t);
  const expected = evaluationRequest(store.state.assessments, job);
  const controller = new AbortController();
  const observer = await open();
  const client = fakeClient({ post: async (payload, { signal }) => {
    await observer.refresh();
    assert.equal(savedJob(observer, job.id).state, 'sending');
    assert.equal(savedJob(observer, job.id).lastError, null);
    assert.equal(signal, controller.signal);
    assert.deepEqual(payload, expected);
    assert.notEqual(payload.submission, savedAttempt(store, attempt.id).submission);
    payload.submission.text = 'A client-side edit cannot change sealed evidence.';
    return evaluation;
  } });

  assert.deepEqual(await runAssessmentJob(store, client, job.id, { signal: controller.signal }), evaluation);
  assert.deepEqual(client.calls, [{ method: 'POST', payload: expected, signal: controller.signal }]);
  assert.deepEqual(savedAttempt(store, attempt.id).submission, attempt.submission);
  assert.equal(savedAttempt(store, attempt.id).activeEvaluationId, evaluation.id);
  assert.equal(savedJob(store, job.id).state, 'complete');
  assert.equal(savedJob(store, job.id).evaluationId, evaluation.id);
  assert.equal(evaluation.result.percentage, 75);

  controller.abort();
  for (const recoverOnly of [false, true]) {
    assert.deepEqual(await runAssessmentJob(store, client, job.id, { recoverOnly, signal: controller.signal }), evaluation);
  }
  const reopened = await open();
  assert.deepEqual(await runAssessmentJob(reopened, client, job.id), evaluation);
  assert.equal(client.calls.length, 1);
  assert.equal(reopened.state.assessments.evaluations.length, 1);
});

test('sending, pending and uncertain jobs use receipts even on an explicit run', async t => {
  for (const state of ['sending', 'pending', 'uncertain']) await t.test(state, async t => {
    const { store, job, evaluation } = await fixture(t);
    await store.updateAssessmentJob(job.id, { state });
    const controller = new AbortController();
    const client = fakeClient({ receipt: async () => evaluation });
    assert.deepEqual(await runAssessmentJob(store, client, job.id, { signal: controller.signal }), evaluation);
    assert.deepEqual(client.calls, [{ method: 'GET', id: job.id, signal: controller.signal }]);
  });
});

test('recoverOnly looks up receipts for every unfinished nonfailed state, including queued and retryable', async t => {
  for (const state of ['queued', 'sending', 'pending', 'retryable', 'uncertain']) await t.test(state, async t => {
    const { store, job, evaluation } = await fixture(t);
    await store.updateAssessmentJob(job.id, { state });
    const client = fakeClient({ receipt: async () => evaluation });
    assert.deepEqual(await runAssessmentJob(store, client, job.id, { recoverOnly: true }), evaluation);
    assert.deepEqual(client.calls, [{ method: 'GET', id: job.id, signal: undefined }]);
  });
});

test('polling exhaustion stays pending across reopening and later runs only recover the original receipt', async t => {
  const { store, open, job, evaluation } = await fixture(t);
  const pending = failure('pending');
  let checks = 0;
  const client = fakeClient({ post: async () => { throw pending; }, receipt: async () => {
    if (++checks === 1) throw pending;
    return evaluation;
  } });
  await assert.rejects(runAssessmentJob(store, client, job.id), error => error === pending);
  assert.equal(savedJob(store, job.id).state, 'pending');
  assert.equal(savedJob(store, job.id).lastError.code, 'pending');
  const reopened = await open();
  await assert.rejects(runAssessmentJob(reopened, client, job.id), error => error === pending);
  assert.equal(savedJob(reopened, job.id).state, 'pending');
  assert.deepEqual(await runAssessmentJob(reopened, client, job.id, { recoverOnly: true }), evaluation);
  assert.deepEqual(client.calls.map(call => call.method), ['POST', 'GET', 'GET']);
  assert.ok(client.calls.slice(1).every(call => call.id === job.id));
  assert.equal(reopened.state.assessments.jobs.length, 1);
});

test('uncertain and provider-timeout responses require receipt recovery, never another generation', async t => {
  for (const code of ['uncertain', 'provider_timeout']) await t.test(code, async t => {
    const { store, job, evaluation } = await fixture(t);
    const error = failure(code);
    let checks = 0;
    const client = fakeClient({ post: async () => { throw error; }, receipt: async () => {
      if (++checks === 1) throw error;
      return evaluation;
    } });
    await assert.rejects(runAssessmentJob(store, client, job.id), caught => caught === error);
    assert.equal(savedJob(store, job.id).state, 'uncertain');
    await assert.rejects(runAssessmentJob(store, client, job.id), caught => caught === error);
    assert.equal(savedJob(store, job.id).state, 'uncertain');
    assert.deepEqual(await runAssessmentJob(store, client, job.id), evaluation);
    assert.deepEqual(client.calls.map(call => call.method), ['POST', 'GET', 'GET']);
    assert.equal(store.state.assessments.jobs.length, 1);
  });
});

test('network and timeout errors persist recoverable status and rethrow the original error', async t => {
  for (const error of [failure('network'), failure('timeout'), new TypeError('Failed to fetch'), new DOMException('Timed out', 'TimeoutError')]) {
    await t.test(String(error.code || error.name), async t => {
      const { store, job, evaluation } = await fixture(t);
      const client = fakeClient({ post: async () => { throw error; }, receipt: async () => evaluation });
      await assert.rejects(runAssessmentJob(store, client, job.id), caught => caught === error);
      assert.equal(savedJob(store, job.id).state, 'pending');
      assert.match(savedJob(store, job.id).lastError.message, /draft is saved/);
      assert.deepEqual(await runAssessmentJob(store, client, job.id), evaluation);
      assert.deepEqual(client.calls.map(call => call.method), ['POST', 'GET']);
    });
  }
});

test('a failed connection during uncertain recovery does not make the request eligible for POST', async t => {
  const { store, job } = await fixture(t);
  await store.updateAssessmentJob(job.id, { state: 'uncertain' });
  const error = failure('network');
  const client = fakeClient({ receipt: async () => { throw error; } });
  for (const recoverOnly of [true, false]) {
    await assert.rejects(runAssessmentJob(store, client, job.id, { recoverOnly }), caught => caught === error);
    assert.equal(savedJob(store, job.id).state, 'uncertain');
  }
  assert.deepEqual(client.calls.map(call => call.method), ['GET', 'GET']);
});

test('quota and cooldown failures require an explicit retry with the exact same request ID and body', async t => {
  for (const [code, status] of [['network', 429], ['provider_quota', 0], ['app_quota', 429], ['cooldown', 429]]) await t.test(code, async t => {
    const { store, job, evaluation } = await fixture(t);
    const error = failure(code, { status, retryAfterSeconds: 60, requestId: 'unrelated-error-id' });
    let posts = 0;
    const client = fakeClient({ post: async () => {
      if (++posts === 1) throw error;
      return evaluation;
    }, receipt: async () => { throw error; } });
    await assert.rejects(runAssessmentJob(store, client, job.id), caught => caught === error && caught.retryAfterSeconds === 60);
    assert.equal(savedJob(store, job.id).state, 'retryable');
    assert.equal(savedJob(store, job.id).lastError.code, code);
    await assert.rejects(runAssessmentJob(store, client, job.id, { recoverOnly: true }), caught => caught === error);
    assert.equal(savedJob(store, job.id).state, 'retryable');
    assert.equal(posts, 1);
    assert.deepEqual(await runAssessmentJob(store, client, job.id), evaluation);
    assert.deepEqual(client.calls.map(call => call.method), ['POST', 'GET', 'POST']);
    assert.deepEqual(client.calls[2].payload, client.calls[0].payload);
    assert.equal(client.calls[2].payload.requestId, job.id);
    assert.equal(savedJob(store, job.id).lastError, null);
    assert.equal(store.state.assessments.jobs.length, 1);
  });
});

test('a missing or expired receipt fails without generation; only an explicit new job can grade the same submission', async t => {
  for (const state of ['queued', 'pending', 'uncertain', 'retryable']) await t.test(state, async t => {
    const { store, job, attempt } = await fixture(t);
    await store.updateAssessmentJob(job.id, { state });
    const missing = failure('request_missing', { status: 404 });
    const client = fakeClient({ receipt: async () => { throw missing; }, post: async payload => grade(attempt, payload.requestId) });
    await assert.rejects(runAssessmentJob(store, client, job.id, { recoverOnly: true }), error => error === missing);
    assert.equal(savedJob(store, job.id).state, 'failed');
    assert.match(savedJob(store, job.id).lastError.message, /expired/);
    assert.match(savedJob(store, job.id).lastError.message, /draft is saved/);
    assert.deepEqual(savedAttempt(store, attempt.id).submission, attempt.submission);
    assert.equal((await store.ensureAssessmentJob(attempt.id)).id, job.id);
    for (const recoverOnly of [false, true]) {
      await assert.rejects(runAssessmentJob(store, client, job.id, { recoverOnly }), error => error.code === 'request_missing' && /explicitly/.test(error.message));
    }
    assert.deepEqual(client.calls.map(call => call.method), ['GET']);
    assert.equal(store.state.assessments.jobs.length, 1);

    const retry = await store.ensureAssessmentJob(attempt.id, { retryUncertain: true });
    assert.notEqual(retry.id, job.id);
    assert.equal(retry.attemptId, job.attemptId);
    assert.equal(retry.submissionHash, job.submissionHash);
    assert.equal((await runAssessmentJob(store, client, retry.id)).id, retry.id);
    assert.deepEqual(client.calls.map(call => call.method), ['GET', 'POST']);
    assert.equal(savedJob(store, job.id).state, 'failed');
  });
});

test('locked, setup and invalid responses are terminal and retain an honest saved-draft message', async t => {
  for (const [code, status] of [['locked', 401], ['setup', 503], ['provider_setup', 503], ['invalid_response', 0], ['request_missing', 404], ['not_found', 404], ['validation', 422]]) {
    await t.test(code, async t => {
      const { store, job, attempt } = await fixture(t);
      const error = failure(code, { status });
      const client = fakeClient({ post: async () => { throw error; } });
      await assert.rejects(runAssessmentJob(store, client, job.id), caught => caught === error);
      assert.equal(savedJob(store, job.id).state, 'failed');
      assert.equal(savedJob(store, job.id).lastError.code, code);
      assert.match(savedJob(store, job.id).lastError.message, /draft is saved/);
      assert.doesNotMatch(savedJob(store, job.id).lastError.message, /Fixture transport detail/);
      assert.deepEqual(savedAttempt(store, attempt.id).submission, attempt.submission);
      await assert.rejects(runAssessmentJob(store, client, job.id), caught => caught.code === code && /explicitly/.test(caught.message));
      assert.equal(client.calls.length, 1);
    });
  }
});

test('missing client integration reports setup failure rather than leaving a sending job', async t => {
  const { store, job } = await fixture(t);
  await assert.rejects(runAssessmentJob(store, {}, job.id), error => error.code === 'setup');
  assert.equal(savedJob(store, job.id).state, 'failed');
  assert.equal(savedJob(store, job.id).lastError.code, 'setup');
});

test('an unknown job and a failed job without details reject locally', async t => {
  const { store, job } = await fixture(t);
  const client = fakeClient();
  await assert.rejects(runAssessmentJob(store, client, 'missing-job'), error => error.code === 'request_missing');
  assert.equal(savedJob(store, job.id).state, 'queued');
  await store.updateAssessmentJob(job.id, { state: 'failed', lastError: null });
  for (const recoverOnly of [false, true]) {
    await assert.rejects(runAssessmentJob(store, client, job.id, { recoverOnly }), error => error.code === 'failed' && /draft is saved/.test(error.message));
  }
  assert.deepEqual(client.calls, []);
});

test('cancellation during POST is persisted after the view aborts and survives reopening', async t => {
  const { store, open, job, attempt, evaluation } = await fixture(t);
  const controller = new AbortController();
  const started = deferred();
  const result = deferred();
  const cancelled = failure('cancelled');
  const client = fakeClient({ post: async (_payload, { signal }) => {
    signal.addEventListener('abort', () => result.reject(cancelled), { once: true });
    started.resolve();
    return result.promise;
  }, receipt: async () => evaluation });
  const rejected = assert.rejects(runAssessmentJob(store, client, job.id, { signal: controller.signal }), error => error === cancelled);
  await started.promise;
  controller.abort();
  await rejected;
  const reopened = await open();
  assert.equal(savedJob(reopened, job.id).state, 'pending');
  assert.equal(savedJob(reopened, job.id).lastError.code, 'cancelled');
  assert.deepEqual(savedAttempt(reopened, attempt.id).submission, attempt.submission);
  assert.deepEqual(await runAssessmentJob(reopened, client, job.id), evaluation);
  assert.deepEqual(client.calls.map(call => call.method), ['POST', 'GET']);
});

test('an already-aborted signal persists cancellation without calling either client method', async t => {
  const { store, open, job } = await fixture(t);
  const controller = new AbortController(); controller.abort();
  const client = fakeClient();
  await assert.rejects(runAssessmentJob(store, client, job.id, { signal: controller.signal }), error => error.code === 'cancelled');
  assert.equal(savedJob(await open(), job.id).lastError.code, 'cancelled');
  assert.equal(savedJob(store, job.id).state, 'pending');
  assert.deepEqual(client.calls, []);
});

test('a native AbortError during receipt recovery is persisted as cancelled', async t => {
  const { store, open, job } = await fixture(t);
  await store.updateAssessmentJob(job.id, { state: 'uncertain' });
  const error = new DOMException('Aborted', 'AbortError');
  const client = fakeClient({ receipt: async () => { throw error; } });
  await assert.rejects(runAssessmentJob(store, client, job.id), caught => caught === error);
  const persisted = savedJob(await open(), job.id);
  assert.equal(persisted.state, 'uncertain');
  assert.equal(persisted.lastError.code, 'cancelled');
});

test('malformed grades and mismatched identity, hashes, source or scores never save an evaluation', async t => {
  const cases = [
    ['null', () => null], ['empty', () => ({})], ['envelope', value => ({ data: value })],
    ['request ID', value => ({ ...value, id: 'foreign-request' })],
    ['attempt ID', value => ({ ...value, attemptId: 'foreign-attempt' })],
    ['submission hash', value => ({ ...value, submissionHash: 'f'.repeat(64) })],
    ['definition hash', value => ({ ...value, definitionHash: 'f'.repeat(64) })],
    ['source', value => ({ ...value, source: 'gemini-import' })],
    ['mode', value => ({ ...value, mode: 'checkpoint' })],
    ['provenance', value => ({ ...value, model: null })],
    ['score', value => { value.result.percentage = 100; return value; }],
    ['criterion', value => { value.result.raw.ratings[0].score = 5; return value; }],
    ['evidence', value => { value.result.raw.ratings[0].evidence[0].quote = 'Fabricated learner words'; return value; }],
  ];
  for (const [index, [name, change]] of cases.entries()) await t.test(name, async t => {
    const { store, job, attempt, evaluation } = await fixture(t);
    const recoverOnly = index % 2 === 0;
    const invalid = change(structuredClone(evaluation));
    const client = fakeClient({ post: async () => invalid, receipt: async () => invalid });
    await assert.rejects(runAssessmentJob(store, client, job.id, { recoverOnly }), Error);
    assert.equal(savedJob(store, job.id).state, 'failed');
    assert.equal(savedJob(store, job.id).lastError.code, 'invalid_response');
    assert.match(savedJob(store, job.id).lastError.message, /could not be verified/);
    assert.equal(savedAttempt(store, attempt.id).activeEvaluationId, null);
    assert.deepEqual(savedAttempt(store, attempt.id).submission, attempt.submission);
    assert.deepEqual(store.state.assessments.evaluations, []);
    assert.equal(store.state.assessments.jobs.length, 1);
    assert.deepEqual(client.calls.map(call => call.method), [recoverOnly ? 'GET' : 'POST']);
  });
});

test('a valid foreign receipt cannot save itself or attach to an attempt with an identical submission hash', async t => {
  const { store, job, attempt } = await fixture(t);
  const other = await addJob(store);
  assert.equal(other.attempt.submissionHash, attempt.submissionHash);
  await store.updateAssessmentJob(job.id, { state: 'pending' });
  const client = fakeClient({ receipt: async () => other.evaluation });
  await assert.rejects(runAssessmentJob(store, client, job.id), /different request/);
  assert.deepEqual(store.state.assessments.evaluations, []);
  assert.equal(savedJob(store, job.id).state, 'failed');
  assert.equal(savedJob(store, other.job.id).state, 'queued');
  assert.equal(savedAttempt(store, other.attempt.id).activeEvaluationId, null);
  assert.equal(client.calls[0].id, job.id);
});

test('a delayed response stays bound to its original job and attempt when another attempt is created', async t => {
  const { store, job, attempt, evaluation } = await fixture(t);
  const started = deferred(); const result = deferred();
  const client = fakeClient({ post: async () => { started.resolve(); return result.promise; } });
  const running = runAssessmentJob(store, client, job.id);
  await started.promise;
  const other = await addJob(store, `${writing} Bis Montag!`);
  result.resolve(evaluation);
  assert.deepEqual(await running, evaluation);
  assert.equal(savedJob(store, job.id).state, 'complete');
  assert.equal(savedAttempt(store, attempt.id).activeEvaluationId, evaluation.id);
  assert.equal(savedJob(store, other.job.id).state, 'queued');
  assert.equal(savedAttempt(store, other.attempt.id).activeEvaluationId, null);
  assert.equal(store.state.assessments.evaluations.length, 1);
});

test('an old uncertain receipt cannot complete a newer grading job for the same sealed attempt', async t => {
  const { store, job, attempt, evaluation } = await fixture(t);
  await store.updateAssessmentJob(job.id, { state: 'uncertain' });
  const started = deferred(); const result = deferred();
  const client = fakeClient({ receipt: async () => { started.resolve(); return result.promise; } });
  const running = runAssessmentJob(store, client, job.id, { recoverOnly: true });
  await started.promise;
  const retry = await store.ensureAssessmentJob(attempt.id, { retryUncertain: true });
  result.resolve(evaluation);
  assert.deepEqual(await running, evaluation);
  assert.equal(savedJob(store, job.id).state, 'complete');
  assert.equal(savedJob(store, retry.id).state, 'queued');
  assert.equal(savedJob(store, retry.id).evaluationId, null);
  assert.equal(savedJob(store, retry.id).submissionHash, job.submissionHash);
  assert.deepEqual(client.calls.map(call => call.method), ['GET']);
});

test('a stale tab refreshes a job completed elsewhere and returns its grade without networking', async t => {
  const { store, open, job, evaluation } = await fixture(t);
  const other = await open();
  await other.acceptAssessmentEvaluation(job.id, evaluation);
  assert.equal(savedJob(store, job.id).state, 'queued');
  const client = fakeClient();
  assert.deepEqual(await runAssessmentJob(store, client, job.id), evaluation);
  assert.deepEqual(client.calls, []);
});

test('concurrent explicit runs in two tabs claim only one POST for a queued job', async t => {
  const { store, open, job, evaluation } = await fixture(t);
  const other = await open();
  const posted = deferred(); const checked = deferred(); const result = deferred();
  const client = fakeClient({ post: async () => { posted.resolve(); return result.promise; },
    receipt: async () => { checked.resolve(); return result.promise; } });
  const first = runAssessmentJob(store, client, job.id);
  const second = runAssessmentJob(other, client, job.id);
  await Promise.all([posted.promise, checked.promise]);
  result.resolve(evaluation);
  assert.deepEqual(await Promise.all([first, second]), [evaluation, evaluation]);
  assert.equal(client.calls.filter(call => call.method === 'POST').length, 1);
  assert.equal(client.calls.filter(call => call.method === 'GET').length, 1);
  await store.refresh();
  assert.equal(store.state.assessments.evaluations.length, 1);
});

test('a job failed by another tab before the send claim stays terminal without networking', async t => {
  const { store, open, job } = await fixture(t);
  const other = await open();
  const client = fakeClient();
  const lastError = { code: 'network', message: 'No grading receipt was found. Your draft is saved; choose a new grading request explicitly.' };
  const rejected = assert.rejects(runAssessmentJob(store, client, job.id), error => error.code === lastError.code && error.message === lastError.message);
  await other.updateAssessmentJob(job.id, { state: 'failed', lastError });
  await rejected;
  await store.refresh();
  assert.equal(savedJob(store, job.id).state, 'failed');
  assert.deepEqual(savedJob(store, job.id).lastError, lastError);
  assert.deepEqual(client.calls, []);
});

test('a late cancellation or invalid receipt never overwrites a grade completed in another tab', async t => {
  for (const invalid of [false, true]) await t.test(invalid ? 'invalid receipt' : 'cancelled receipt', async t => {
    const { store, open, job, evaluation } = await fixture(t);
    await store.updateAssessmentJob(job.id, { state: 'pending' });
    const other = await open();
    const started = deferred(); const result = deferred();
    const client = fakeClient({ receipt: async () => { started.resolve(); return result.promise; } });
    const cancelled = failure('cancelled');
    const rejected = assert.rejects(runAssessmentJob(store, client, job.id), error => invalid ? /different request/.test(error.message) : error === cancelled);
    await started.promise;
    await other.acceptAssessmentEvaluation(job.id, evaluation);
    if (invalid) result.resolve({});
    else result.reject(cancelled);
    await rejected;
    assert.equal(savedJob(store, job.id).state, 'complete');
    assert.equal(savedJob(store, job.id).lastError, null);
    assert.deepEqual(store.state.assessments.evaluations, [evaluation]);
    assert.deepEqual(await runAssessmentJob(store, client, job.id), evaluation);
    assert.equal(client.calls.length, 1);
  });
});

test('grading, receipt recovery and explicit quota retries leave existing SRS evidence and other learning progress intact', async t => {
  const { store, job, evaluation } = await fixture(t);
  const session = createSession(store.state, 'first-interview');
  await store.addSession(session);
  const task = tasksFor(session).find(item => item.kind === 'recall');
  const draft = { ...draftFor(session, task.id), aloud: true, attemptedBeforeReveal: true };
  await store.addAttempts([makeAttempt(session, task, draft, 'independent', 'Europe/Berlin')]);
  const learning = state => {
    const { assessments: _assessments, updatedAt: _updatedAt, ...rest } = structuredClone(state);
    return rest;
  };
  const before = learning(store.state);
  const memory = reviewStates(store.state.attempts);
  assert.equal(memory.size, 1);
  const quota = failure('cooldown', { status: 429 });
  let posts = 0;
  const client = fakeClient({ post: async () => { if (++posts === 1) throw quota; return evaluation; }, receipt: async () => { throw quota; } });
  await assert.rejects(runAssessmentJob(store, client, job.id), error => error === quota);
  await assert.rejects(runAssessmentJob(store, client, job.id, { recoverOnly: true }), error => error === quota);
  await runAssessmentJob(store, client, job.id);
  await store.refresh();
  assert.deepEqual(learning(store.state), before);
  assert.deepEqual(reviewStates(store.state.attempts), memory);
  assert.deepEqual(client.calls.map(call => call.method), ['POST', 'GET', 'POST']);
});
