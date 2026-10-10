import { GatewayError } from './ai-gateway.js';
import { evaluationRequest, validateAssessmentState } from './assessment-state.js';
import { check } from '../../shared/assessment-contracts.js';

const savedDraft = 'Your draft is saved on this device as a sealed submission.';
const newRequest = 'Choose a new grading request explicitly to grade the same saved submission.';
const savedEvaluation = (progress, job) => progress.evaluations.find(item => item.id === job.evaluationId);

function failedJob(job) {
  return new GatewayError(job.lastError?.message ?? `This grading request failed. ${savedDraft} ${newRequest}`,
    { code: job.lastError?.code ?? 'failed', requestId: job.id });
}

function checkCancellation(signal, requestId) {
  if (signal?.aborted) throw new GatewayError(`Grading was interrupted. ${savedDraft}`, { code: 'cancelled', requestId });
}

async function claimSending(store, job) {
  let claimed = false;
  // A conditional claim must share the store transaction across tabs. A plain
  // updateAssessmentJob patch would let two queued readers both decide to POST.
  await store.update(root => {
    const saved = root.assessments.jobs.find(item => item.id === job.id);
    check(saved && saved.attemptId === job.attemptId && saved.submissionHash === job.submissionHash, 'This grading request no longer matches its saved submission.');
    if (!['queued', 'retryable'].includes(saved.state)) return;
    Object.assign(saved, { state: 'sending', lastError: null, updatedAt: Date.now() });
    validateAssessmentState(root.assessments);
    claimed = true;
  });
  return claimed;
}

function errorUpdate(error, job, accepting, recovering) {
  const code = accepting ? 'invalid_response' : error?.name === 'AbortError' ? 'cancelled'
    : error?.name === 'TimeoutError' ? 'timeout'
      : typeof error?.code === 'string' && error.code.length > 0 && error.code.length <= 100 ? error.code : 'network';
  let state = 'failed';
  let message;
  if (!accepting && (error?.status === 429 || ['provider_quota', 'app_quota', 'cooldown'].includes(code))) {
    state = 'retryable';
    message = 'Grading is paused by a quota or cooldown. Wait, then explicitly retry this same grading request.';
  } else if (!accepting && (code === 'request_missing' || error?.status === 404)) {
    message = `No saved grading receipt was found; it may have expired. ${newRequest}`;
  } else if (!accepting && (code === 'locked' || error?.status === 401)) {
    state = recovering ? 'pending' : 'failed';
    message = recovering ? 'Unlock the private AI connection, then check this existing request for its saved grade. No new generation is needed.' : `Unlock the private AI connection first. ${newRequest}`;
  } else if (code === 'pending') {
    state = 'pending';
    message = 'The grade is still being prepared. Check this request again for its receipt.';
  } else if (['uncertain', 'provider_timeout', 'body_timeout'].includes(code) || !accepting && error?.status === 504) {
    state = 'uncertain';
    message = 'This request may have reached the grader, but no grade is confirmed. Check its receipt before explicitly requesting a new grade.';
  } else if (['cancelled', 'network', 'timeout'].includes(code)) {
    state = job.state === 'uncertain' ? 'uncertain' : 'pending';
    message = 'Grading was interrupted before its receipt was confirmed. Check this request for a saved grade.';
  } else if (['setup', 'provider_setup'].includes(code)) {
    message = `Assessment grading is unavailable. Complete the gateway setup first. ${newRequest}`;
  } else if (code === 'invalid_response') {
    message = `The grading response could not be verified against this saved submission. ${newRequest}`;
  } else if (code === 'retry_exhausted') {
    message = `The request reached its retry limit. Once the quota is available, ${newRequest}`;
  } else {
    message = `This grading request failed. Resolve the grading error first. ${newRequest}`;
  }
  return { state, lastError: { code, message: `${message} ${savedDraft}` } };
}

/**
 * Run one saved grading job. Only an explicit queued/retryable run may POST;
 * all recovery uses the original receipt ID. The client owns bounded polling.
 * Errors are rethrown after saving an assessment-specific recovery message.
 */
export async function runAssessmentJob(store, client, jobId, { signal, recoverOnly = false } = {}) {
  const progress = (await store.refresh()).assessments;
  const current = progress.jobs.find(item => item.id === jobId);
  if (!current) throw new GatewayError('This grading request is not on this device.', { code: 'request_missing', requestId: jobId });
  const job = structuredClone(current);
  if (job.state === 'complete') return savedEvaluation(progress, job);
  if (job.state === 'failed' && !(recoverOnly && job.lastError?.code === 'locked')) throw failedJob(job);

  let accepting = false;
  let failedElsewhere = false;
  let recovering = false;
  try {
    checkCancellation(signal, job.id);
    let post = !recoverOnly && ['queued', 'retryable'].includes(job.state);
    const payload = post ? evaluationRequest(progress, job) : null;
    if (post) {
      post = await claimSending(store, job);
      const latest = store.state.assessments;
      const saved = latest.jobs.find(item => item.id === job.id);
      if (saved.state === 'complete') return savedEvaluation(latest, saved);
      if (saved.state === 'failed') { failedElsewhere = true; throw failedJob(saved); }
      job.state = saved.state;
    }
    checkCancellation(signal, job.id);
    if (typeof client?.[post ? 'evaluateAssessment' : 'receipt'] !== 'function') {
      throw new GatewayError(`The assessment grading connection is not available in this app. ${savedDraft}`, { code: 'setup', requestId: job.id });
    }
    recovering = !post;
    const result = post ? await client.evaluateAssessment(payload, { signal }) : await client.receipt(job.id, { signal });
    accepting = true;
    await store.acceptAssessmentEvaluation(job.id, result);
    const latest = store.state.assessments;
    return savedEvaluation(latest, latest.jobs.find(item => item.id === job.id));
  } catch (error) {
    // Do not pass the view signal: cancellation must still persist. The store's
    // transaction guard preserves any grade already completed in another tab.
    if (!failedElsewhere) await store.updateAssessmentJob(job.id, errorUpdate(error, job, accepting, recovering));
    throw error;
  }
}
