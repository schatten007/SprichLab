import { ASSESSMENT_MODES, check, record, id, hash, time, text, canonicalJSON, hashJSON, submissionDigest,
  validateAssessmentDefinition, validateAssessmentSubmission, validateSupportEvents } from '../../shared/assessment-contracts.js';
import { validateAssessmentEvaluation, keyedEvaluation } from '../../shared/assessment-results.js';

export const emptyAssessments = () => ({ definitions: [], attempts: [], evaluations: [], jobs: [] });
export const emptyAssessmentDraft = () => ({ answers: {}, text: '', events: [] });
const immutableEqual = (a, b) => canonicalJSON(a) === canonicalJSON(b);
export const assessmentDefinition = (state, attempt) => state.definitions.find(entry => entry.id === attempt.definitionHash)?.definition;
export const assessmentRef = (attempt, definition) => ({ attemptId: attempt.id, definitionId: definition.id,
  definitionVersion: definition.version, definitionHash: attempt.definitionHash, mode: attempt.mode });

function validateDraft(definition, draft) {
  check(record(draft) && Object.keys(draft).every(key => ['answers', 'text', 'events'].includes(key)) && record(draft.answers) && text(draft.text, 3000), 'Invalid assessment draft.');
  canonicalJSON(draft); validateSupportEvents(draft.events);
  if (definition.kind === 'objective') {
    check(Object.keys(draft.answers).every(key => definition.items.some(item => item.id === key)), 'Unknown draft question.');
    validateAssessmentSubmission(definition, { kind: 'objective', answers: Object.fromEntries(definition.items.map(item => [item.id, draft.answers[item.id] ?? null])), events: draft.events });
  } else check(Object.keys(draft.answers).length === 0, 'This task does not have keyed questions.');
}

export async function prepareAssessmentAttempt(definition, { mode = 'practice', execution = 'in_app', now = Date.now(), attemptId = crypto.randomUUID(), parentAttemptId = null } = {}) {
  validateAssessmentDefinition(definition);
  check(ASSESSMENT_MODES.includes(mode) && ['in_app', 'gemini_live'].includes(execution), 'Choose an assessment mode.');
  check(execution !== 'gemini_live' || definition.kind === 'roleplay', 'Only a roleplay can start as an external Live attempt.');
  const definitionHash = await hashJSON(definition);
  const attempt = { id: attemptId, definitionHash, mode, execution, state: 'prepared', createdAt: now, updatedAt: now,
    startedAt: null, submittedAt: null, parentAttemptId, aiSessionId: null, draftRevision: 0, draft: emptyAssessmentDraft(),
    submission: null, submissionHash: null, exportContextHash: await hashJSON({ attemptId, definitionHash, mode, execution }), activeEvaluationId: null };
  return { definition: { id: definitionHash, definition: structuredClone(definition) }, attempt };
}
export function addPreparedAssessment(state, prepared) {
  const next = structuredClone(state);
  const existingDefinition = next.definitions.find(entry => entry.id === prepared.definition.id);
  if (existingDefinition) check(immutableEqual(existingDefinition, prepared.definition), 'Conflicting assessment definition hash.');
  else {
    check(!next.definitions.some(entry => entry.definition.id === prepared.definition.definition.id && entry.definition.version === prepared.definition.definition.version), 'A published assessment version changed.');
    next.definitions.push(structuredClone(prepared.definition));
  }
  const existing = next.attempts.find(attempt => attempt.id === prepared.attempt.id);
  if (existing) check(immutableEqual(existing, prepared.attempt), 'Conflicting assessment attempt.');
  else next.attempts.push(structuredClone(prepared.attempt));
  return validateAssessmentState(next);
}
export function reviseAssessmentDraft(attempt, draft, now = Date.now()) {
  check(['prepared', 'in_progress'].includes(attempt.state), 'Submitted answers are sealed. Start a new attempt to change them.');
  check(record(draft) && record(draft.answers) && text(draft.text, 3000), 'Invalid assessment draft.');
  validateSupportEvents(draft.events);
  return { ...attempt, state: 'in_progress', startedAt: attempt.startedAt ?? now, updatedAt: now,
    draftRevision: attempt.draftRevision + 1, draft: structuredClone(draft) };
}
export async function prepareAssessmentSubmission(attempt, definition, supplied = null) {
  check(attempt.execution === 'in_app' && ['prepared', 'in_progress', 'submitted'].includes(attempt.state), 'This attempt cannot be submitted here.');
  let submission = supplied;
  if (!submission) {
    if (definition.kind === 'objective') submission = { kind: 'objective', answers: Object.fromEntries(definition.items.map(item => [item.id, attempt.draft.answers[item.id] ?? null])), events: structuredClone(attempt.draft.events) };
    else if (definition.kind === 'writing') submission = { kind: 'writing', text: attempt.draft.text, inputMode: 'typed', events: structuredClone(attempt.draft.events) };
    else throw new Error('Finish the roleplay before requesting its grade.');
  }
  validateAssessmentSubmission(definition, submission);
  return { attemptId: attempt.id, draftRevision: attempt.draftRevision, submission: structuredClone(submission),
    submissionHash: await submissionDigest(attempt.definitionHash, attempt.mode, submission) };
}
/** Called inside the existing synchronous store mutator; hashing has already finished. */
export function sealAssessmentSubmission(attempt, candidate, now = Date.now()) {
  check(candidate.attemptId === attempt.id, 'Submission belongs to another attempt.');
  if (attempt.state === 'submitted') {
    check(attempt.submissionHash === candidate.submissionHash && immutableEqual(attempt.submission, candidate.submission), 'Submitted answers cannot be replaced.');
    return attempt;
  }
  check(['prepared', 'in_progress'].includes(attempt.state) && attempt.draftRevision === candidate.draftRevision, 'The draft changed while saving. Submit it again.');
  return { ...attempt, state: 'submitted', startedAt: attempt.startedAt ?? now, submittedAt: now, updatedAt: now,
    submission: candidate.submission, submissionHash: candidate.submissionHash, draft: null };
}
export function addAssessmentEvaluation(state, evaluation, now = Date.now()) {
  const next = structuredClone(state);
  const attempt = next.attempts.find(item => item.id === evaluation.attemptId);
  check(attempt, 'This assessment attempt is missing.');
  validateAssessmentEvaluation(evaluation, attempt, assessmentDefinition(next, attempt));
  const previous = next.evaluations.find(item => item.id === evaluation.id);
  if (previous) check(immutableEqual(previous, evaluation), 'Conflicting evaluation with the same ID.');
  else next.evaluations.push(structuredClone(evaluation));
  attempt.activeEvaluationId ??= evaluation.id;
  attempt.updatedAt = now;
  return validateAssessmentState(next);
}
export function saveSealedAssessment(state, candidate, now = Date.now()) {
  let next = structuredClone(state);
  const index = next.attempts.findIndex(attempt => attempt.id === candidate.attemptId);
  check(index >= 0, 'This assessment attempt is missing.');
  next.attempts[index] = sealAssessmentSubmission(next.attempts[index], candidate, now);
  const attempt = next.attempts[index]; const definition = assessmentDefinition(next, attempt);
  validateAssessmentSubmission(definition, attempt.submission, { external: attempt.execution === 'gemini_live' });
  if (definition.kind === 'objective' && !next.evaluations.some(item => item.id === `local:${attempt.id}`)) next = addAssessmentEvaluation(next, keyedEvaluation(attempt, definition, now), now);
  return validateAssessmentState(next);
}
export function ensureAssessmentJob(state, attemptId, { requestId = crypto.randomUUID(), now = Date.now(), retryUncertain = false } = {}) {
  const next = structuredClone(state);
  const attempt = next.attempts.find(item => item.id === attemptId);
  check(attempt?.state === 'submitted' && attempt.execution === 'in_app', 'Submit the response before grading.');
  check(assessmentDefinition(next, attempt).kind !== 'objective', 'This test is checked locally.');
  const previous = next.jobs.filter(job => job.attemptId === attemptId).at(-1);
  if (previous && (!retryUncertain || ['queued', 'sending', 'pending', 'retryable', 'complete'].includes(previous.state))) return { state: next, job: previous };
  const job = { id: requestId, attemptId, submissionHash: attempt.submissionHash, state: 'queued', createdAt: now, updatedAt: now, evaluationId: null, lastError: null };
  next.jobs.push(job);
  return { state: validateAssessmentState(next), job };
}
export function evaluationRequest(state, job) {
  const attempt = state.attempts.find(item => item.id === job.attemptId);
  const definition = assessmentDefinition(state, attempt);
  return { requestId: job.id, attemptId: attempt.id, definitionRef: { id: definition.id, version: definition.version },
    definitionHash: attempt.definitionHash, mode: attempt.mode, submissionHash: attempt.submissionHash, submission: structuredClone(attempt.submission) };
}

export function validateAssessmentState(state) {
  check(record(state), 'Missing assessment progress.');
  for (const key of ['definitions', 'attempts', 'evaluations', 'jobs']) {
    check(Array.isArray(state[key]) && state[key].length <= 20000 && state[key].every(item => record(item) && id(item.id)) && new Set(state[key].map(item => item.id)).size === state[key].length, 'Invalid or duplicate assessment records.');
  }
  const versions = new Set();
  state.definitions.forEach(entry => {
    check(hash(entry.id), 'Invalid definition hash.'); validateAssessmentDefinition(entry.definition);
    const version = `${entry.definition.id}:${entry.definition.version}`;
    check(!versions.has(version), 'Conflicting published definition versions.'); versions.add(version);
  });
  for (const attempt of state.attempts) {
    const definition = assessmentDefinition(state, attempt);
    check(definition && ASSESSMENT_MODES.includes(attempt.mode) && ['in_app', 'gemini_live'].includes(attempt.execution) && ['prepared', 'in_progress', 'submitted', 'abandoned'].includes(attempt.state), 'Invalid assessment attempt.');
    check(attempt.execution !== 'gemini_live' || definition.kind === 'roleplay', 'Invalid external assessment type.');
    check([attempt.createdAt, attempt.updatedAt].every(time) && [attempt.startedAt, attempt.submittedAt].every(value => value === null || time(value)), 'Invalid assessment dates.');
    check(Number.isInteger(attempt.draftRevision) && attempt.draftRevision >= 0 && hash(attempt.exportContextHash), 'Invalid assessment draft identity.');
    check(attempt.parentAttemptId === null || (attempt.parentAttemptId !== attempt.id && state.attempts.some(item => item.id === attempt.parentAttemptId)), 'Invalid assessment retry reference.');
    check(attempt.aiSessionId === null || id(attempt.aiSessionId), 'Invalid roleplay reference.');
    if (attempt.state === 'submitted') {
      check(hash(attempt.submissionHash) && time(attempt.submittedAt) && attempt.draft === null, 'Submitted answers must be sealed.');
      validateAssessmentSubmission(definition, attempt.submission, { external: attempt.execution === 'gemini_live' });
    } else {
      check(attempt.submission === null && attempt.submissionHash === null && attempt.submittedAt === null, 'An unfinished attempt cannot have a submission.');
      validateDraft(definition, attempt.draft);
    }
    check(attempt.activeEvaluationId === null || state.evaluations.some(evaluation => evaluation.id === attempt.activeEvaluationId && evaluation.attemptId === attempt.id), 'Invalid active grade reference.');
  }
  for (const evaluation of state.evaluations) {
    const attempt = state.attempts.find(item => item.id === evaluation.attemptId);
    check(attempt, 'An evaluation is missing its attempt.');
    validateAssessmentEvaluation(evaluation, attempt, assessmentDefinition(state, attempt));
  }
  for (const job of state.jobs) {
    const attempt = state.attempts.find(item => item.id === job.attemptId);
    check(attempt?.state === 'submitted' && job.submissionHash === attempt.submissionHash && ['queued', 'sending', 'pending', 'retryable', 'uncertain', 'complete', 'failed'].includes(job.state), 'Invalid assessment grading job.');
    check(time(job.createdAt) && time(job.updatedAt) && (job.lastError === null || record(job.lastError) && text(job.lastError.code, 100) && text(job.lastError.message, 1000)), 'Invalid grading status.');
    check(job.evaluationId === null || state.evaluations.some(evaluation => evaluation.id === job.evaluationId && evaluation.attemptId === attempt.id), 'Invalid grading receipt reference.');
    check(job.state !== 'complete' || job.evaluationId !== null, 'A completed job needs a grade.');
  }
  return state;
}

export async function verifyAssessmentHashes(state) {
  validateAssessmentState(state);
  for (const entry of state.definitions) check(await hashJSON(entry.definition) === entry.id, 'The assessment definition hash does not match its content.');
  for (const attempt of state.attempts) {
    check(await hashJSON({ attemptId: attempt.id, definitionHash: attempt.definitionHash, mode: attempt.mode, execution: attempt.execution }) === attempt.exportContextHash, 'The prepared assessment context changed.');
    if (attempt.submission) check(await submissionDigest(attempt.definitionHash, attempt.mode, attempt.submission) === attempt.submissionHash, 'The submitted assessment text changed.');
  }
  return state;
}
export function mergeAssessments(local, incoming) {
  const result = structuredClone(local);
  for (const key of ['definitions', 'evaluations']) {
    for (const record of incoming[key]) {
      const previous = result[key].find(item => item.id === record.id);
      if (previous) {
        if (key === 'evaluations' && ['local-key', 'gemini-import'].includes(previous.source) && record.source === previous.source) {
          check(immutableEqual({ ...previous, createdAt: 0 }, { ...record, createdAt: 0 }), 'Conflicting immutable assessment records. No progress was imported.');
          previous.createdAt = Math.min(previous.createdAt, record.createdAt);
        } else check(immutableEqual(previous, record), 'Conflicting immutable assessment records. No progress was imported.');
      }
      else result[key].push(structuredClone(record));
    }
  }
  for (const other of incoming.attempts) {
    const index = result.attempts.findIndex(item => item.id === other.id);
    if (index < 0) { result.attempts.push(structuredClone(other)); continue; }
    const current = result.attempts[index];
    check(current.definitionHash === other.definitionHash && current.mode === other.mode && current.execution === other.execution, 'Conflicting assessment identity.');
    if (current.submission && other.submission) check(current.submissionHash === other.submissionHash && immutableEqual(current.submission, other.submission), 'Conflicting submitted answers. Export the other attempt separately.');
    if (Boolean(current.submission) !== Boolean(other.submission)) {
      const draft = current.submission ? other : current;
      const submitted = current.submission ? current : other;
      const definition = assessmentDefinition(result, draft);
      const empty = !draft.draft.text && !Object.values(draft.draft.answers).some(value => value !== null && value !== '') && !draft.draft.events.length;
      const comparable = definition.kind === 'objective'
        ? { kind: 'objective', answers: Object.fromEntries(definition.items.map(item => [item.id, draft.draft.answers[item.id] ?? null])), events: draft.draft.events }
        : definition.kind === 'writing' ? { kind: 'writing', text: draft.draft.text, inputMode: 'typed', events: draft.draft.events } : null;
      check(empty || comparable && immutableEqual(comparable, submitted.submission), 'An imported submission conflicts with an unfinished local answer. Keep a backup before resolving it.');
    }
    const chosen = current.submission ? current : other.submission || other.updatedAt > current.updatedAt ? other : current;
    result.attempts[index] = structuredClone(chosen);
    result.attempts[index].activeEvaluationId ??= other.activeEvaluationId;
  }
  for (const other of incoming.jobs) {
    const index = result.jobs.findIndex(job => job.id === other.id);
    if (index < 0) { result.jobs.push(structuredClone(other)); continue; }
    const current = result.jobs[index];
    check(current.attemptId === other.attemptId && current.submissionHash === other.submissionHash, 'Conflicting assessment jobs.');
    if (current.state !== 'complete' && (other.state === 'complete' || other.updatedAt > current.updatedAt)) result.jobs[index] = structuredClone(other);
  }
  return validateAssessmentState(result);
}

/** Roleplay drafts live in aiSessions, not attempt.draft. Check both transfer directions before merging. */
export function assertAssessmentConversationMerge(local, incoming) {
  const protect = (pendingRoot, submittedRoot) => {
    for (const finished of submittedRoot.assessments.attempts.filter(attempt => attempt.state === 'submitted' && attempt.aiSessionId)) {
      const pending = pendingRoot.assessments.attempts.find(attempt => attempt.id === finished.id);
      if (!pending || pending.state === 'submitted') continue;
      const conversation = pendingRoot.aiSessions.find(session => session.id === pending.aiSessionId);
      const completed = submittedRoot.aiSessions.find(session => session.id === finished.aiSessionId);
      check(conversation && completed, 'The assessment conversation is missing.');
      const draft = conversation.draft;
      check(draft.status !== 'sending' && !draft.text.trim() && !draft.audioKey && !draft.recordingMs, 'An imported grade conflicts with an unsent roleplay answer. Save or export that draft before importing.');
      check(conversation.turns.every(turn => completed.turns.some(other => other.id === turn.id && immutableEqual(other, turn)))
        && (conversation.assessmentEvents ?? []).every(event => (completed.assessmentEvents ?? []).some(other => other.id === event.id && immutableEqual(other, event))),
      'The roleplay has additional local turns or help events not present in the imported assessment.');
    }
  };
  protect(local, incoming); protect(incoming, local);
}
