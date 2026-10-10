import { ASSESSMENT_LIMITS, ASSESSMENT_MODES, check, id, hash, record, text, hashJSON, submissionDigest,
  validateAssessmentDefinition, validateAssessmentSubmission, assessmentEvidence } from '../shared/assessment-contracts.js';
import { rubricEvaluation } from '../shared/assessment-results.js';
import { problem } from './errors.js';

export async function trustedAssessment(reference, expectedHash, loadDefinition, context) {
  const definition = await loadDefinition(reference, context);
  try { validateAssessmentDefinition(definition); }
  catch { throw problem(503, 'assessment_content', 'The published assessment is not valid. Your response is saved.'); }
  if (definition.id !== reference.id || definition.version !== reference.version || await hashJSON(definition) !== expectedHash) {
    throw problem(409, 'assessment_changed', 'The assessment content changed. Start a new attempt; submitted answers remain saved.');
  }
  return definition;
}

export async function evaluateAssessment(input, { loadDefinition, request, env, ledger, limits, now, testMode, execution, grade }) {
  try {
    check(record(input) && Object.keys(input).every(key => ['requestId', 'attemptId', 'definitionRef', 'definitionHash', 'mode', 'submissionHash', 'submission'].includes(key)), 'Unsupported grading request fields.');
    check(id(input.requestId) && id(input.attemptId) && record(input.definitionRef) && id(input.definitionRef.id) && text(input.definitionRef.version, 100), 'Invalid grading request identity.');
    check(hash(input.definitionHash) && hash(input.submissionHash) && ASSESSMENT_MODES.includes(input.mode), 'Invalid grading hashes or conditions.');
    check(input.submission?.kind !== 'external', 'External reports cannot be relabelled as gateway evidence.');
  } catch (error) { throw problem(422, 'assessment_validation', error.message); }
  const logicalHash = await hashJSON({ ...input, requestId: null });
  // Existing receipts do not depend on whether that content is still in the current catalog.
  const prior = await ledger.get(input.requestId);
  if (prior?.status === 'complete' || prior?.status === 'pending') {
    const claim = await ledger.claim(input.requestId, logicalHash, 'assessment');
    if (!claim.claimed) return claim.pending ? { status: 202, data: { requestId: input.requestId, status: 'pending' } } : { status: 200, data: claim.response, meta: { cached: true } };
  }
  const definition = await trustedAssessment(input.definitionRef, input.definitionHash, loadDefinition, { env, request });
  if (definition.kind === 'objective') throw problem(422, 'assessment_kind', 'This assessment is checked locally.');
  try { validateAssessmentSubmission(definition, input.submission); }
  catch (error) { throw problem(422, 'assessment_validation', error.message); }
  if (definition.kind === 'roleplay' && assessmentEvidence(input.submission).length < ASSESSMENT_LIMITS.minReplies) throw problem(422, 'assessment_insufficient_evidence', 'Have at least three actual learner replies before grading.');
  if (await submissionDigest(input.definitionHash, input.mode, input.submission) !== input.submissionHash) throw problem(409, 'assessment_changed', 'The submitted evidence does not match its hash.');
  const claim = await ledger.claim(input.requestId, logicalHash, 'assessment');
  if (!claim.claimed) return claim.pending ? { status: 202, data: { requestId: input.requestId, status: 'pending' } } : { status: 200, data: claim.response, meta: { cached: true } };
  const run = async () => {
    try {
      const day = new Date(now()).toISOString().slice(0, 10);
      await ledger.consume(`reviews:${day}`, limits.dailyReviews);
      await ledger.consume(`minute:${Math.floor(now() / 60000)}`, limits.minuteTurns, 1, 60000);
      const generated = await grade(definition, input.submission, input.mode);
      let evaluation;
      try {
        evaluation = rubricEvaluation({ ...input, definition, raw: generated.raw, source: 'gateway-ai', model: generated.model,
          promptVersion: generated.promptVersion, testMode, now: now() });
      } catch { throw problem(502, 'assessment_evidence', 'The grade could not be validated against your words. No score was added.'); }
      await ledger.finish(input.requestId, evaluation);
      return evaluation;
    } catch (error) {
      throw await ledger.fail(input.requestId, error, error.status === 504 ? 'uncertain' : error.status === 429 ? 'retryable' : 'failed');
    }
  };
  const running = run(); execution.waitUntil?.(running.catch(() => {}));
  const data = await running;
  execution.waitUntil?.(ledger.cleanup().catch(() => {}));
  return { status: 200, data };
}
