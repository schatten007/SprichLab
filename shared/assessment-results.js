import { check, record, id, hash, time, text, canonicalJSON, validateRubricResult, supportSummary } from './assessment-contracts.js';
import { scoreObjective, calculateRubricScore, KEYED_SCORER_VERSION } from './assessment-scoring.js';

export function keyedEvaluation(attempt, definition, now = Date.now()) {
  return { id: `local:${attempt.id}`, attemptId: attempt.id, definitionHash: attempt.definitionHash, submissionHash: attempt.submissionHash,
    source: 'local-key', createdAt: now, mode: attempt.mode, rubricId: null, scorerVersion: KEYED_SCORER_VERSION,
    model: null, promptVersion: null, testMode: false, support: supportSummary(attempt.submission),
    result: scoreObjective(definition, attempt.submission) };
}
export function rubricEvaluation({ requestId, attemptId, definitionHash, submissionHash, mode, definition, submission, raw,
  source = 'gateway-ai', model, promptVersion, testMode = false, now = Date.now() }) {
  validateRubricResult(raw, definition.rubricId, submission, { external: source === 'gemini-import' && submission.kind === 'external' });
  return { id: requestId, attemptId, definitionHash, submissionHash, source, createdAt: now, mode, rubricId: definition.rubricId,
    scorerVersion: null, model, promptVersion, testMode, support: supportSummary(submission), result: calculateRubricScore(definition.rubricId, raw) };
}
export function validateAssessmentEvaluation(value, attempt, definition) {
  check(record(value) && id(value.id) && value.attemptId === attempt.id && hash(value.definitionHash) && value.definitionHash === attempt.definitionHash
    && hash(value.submissionHash) && value.submissionHash === attempt.submissionHash && attempt.state === 'submitted', 'The grade does not match its sealed submission.');
  check(time(value.createdAt) && value.mode === attempt.mode && typeof value.testMode === 'boolean' && value.support === supportSummary(attempt.submission), 'Invalid grading conditions.');
  check(['local-key', 'gateway-ai', 'gemini-import'].includes(value.source), 'Unknown grading source.');
  check(Object.keys(value).every(key => ['id', 'attemptId', 'definitionHash', 'submissionHash', 'source', 'createdAt', 'mode', 'rubricId', 'scorerVersion', 'model', 'promptVersion', 'testMode', 'support', 'result', 'externalNotes'].includes(key)), 'Unexpected grade fields.');
  if (value.externalNotes) check(value.source === 'gemini-import' && record(value.externalNotes) && text(value.externalNotes.delivery, 1000) && text(value.externalNotes.assistance, 1000), 'Invalid external observations.');
  let expected;
  if (value.source === 'local-key') {
    check(definition.kind === 'objective' && value.scorerVersion === KEYED_SCORER_VERSION && value.rubricId === null
      && value.model === null && value.promptVersion === null && !value.testMode, 'Invalid local checker provenance.');
    expected = scoreObjective(definition, attempt.submission);
  } else {
    check(definition.kind !== 'objective' && value.rubricId === definition.rubricId && value.scorerVersion === null
      && text(value.model, 150) && value.model && text(value.promptVersion, 100) && value.promptVersion, 'Invalid AI grading provenance.');
    check(value.source !== 'gateway-ai' || attempt.submission.kind !== 'external', 'A Gemini claim cannot be labelled as gateway evidence.');
    validateRubricResult(value.result?.raw, definition.rubricId, attempt.submission, { external: value.source === 'gemini-import' && attempt.submission.kind === 'external' });
    expected = calculateRubricScore(definition.rubricId, value.result.raw);
  }
  check(canonicalJSON(value.result) === canonicalJSON(expected), 'The stored grade does not match the scoring rules.');
  return value;
}
