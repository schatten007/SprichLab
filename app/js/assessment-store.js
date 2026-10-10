import { check, canonicalJSON, hashJSON, submissionDigest, validateAssessmentPack } from '../../shared/assessment-contracts.js';
import { prepareAssessmentAttempt, addPreparedAssessment, reviseAssessmentDraft, prepareAssessmentSubmission, saveSealedAssessment,
  assessmentDefinition, validateAssessmentState, ensureAssessmentJob, addAssessmentEvaluation } from './assessment-state.js';
import { buildRoleplaySubmission } from './assessment-evidence.js';

/** Compose with createStore; every asynchronous hash completes before its synchronous transaction mutator. */
export function assessmentStore({ update, database, state, now }) {
  const change = edit => update(root => { root.assessments = edit(root.assessments, root) ?? root.assessments; validateAssessmentState(root.assessments); });
  const find = (progress, id) => { const attempt = progress.attempts.find(item => item.id === id); check(attempt, 'This assessment is not on this device.'); return attempt; };
  return {
    getAssessmentPack(id, version) { return database.get('assessmentPacks', `${id}:${version}`); },
    async putAssessmentPack(pack) { validateAssessmentPack(pack); await database.put('assessmentPacks', pack, `${pack.id}:${pack.version}`); },
    async createAssessmentAttempt(definition, options = {}) {
      const prepared = await prepareAssessmentAttempt(definition, { ...options, now: now() });
      await change(progress => addPreparedAssessment(progress, prepared));
      return prepared.attempt.id;
    },
    async saveAssessmentDraft(id, draft) {
      return change(progress => { const index = progress.attempts.findIndex(item => item.id === id); check(index >= 0, 'Unknown assessment.');
        progress.attempts[index] = reviseAssessmentDraft(progress.attempts[index], draft, now()); });
    },
    async submitAssessment(id) {
      const progress = state().assessments;
      const attempt = find(progress, id);
      if (attempt.state === 'submitted') return attempt;
      const definition = assessmentDefinition(progress, attempt);
      const evidence = definition.kind === 'roleplay' ? buildRoleplaySubmission(state().aiSessions.find(session => session.id === attempt.aiSessionId)) : null;
      const candidate = await prepareAssessmentSubmission(attempt, definition, evidence);
      await change((current, root) => {
        const saved = find(current, id);
        if (evidence && saved.state !== 'submitted') {
          const conversation = root.aiSessions.find(session => session.id === saved.aiSessionId);
          check(conversation && canonicalJSON(buildRoleplaySubmission(conversation)) === canonicalJSON(candidate.submission), 'The conversation changed while saving. Try grading again.');
          conversation.endedAt ??= now(); conversation.updatedAt = now();
        }
        return saveSealedAssessment(current, candidate, now());
      });
      return find(state().assessments, id);
    },
    async abandonAssessment(id) {
      return change(progress => { const attempt = find(progress, id); check(attempt.state !== 'submitted', 'A submitted assessment is immutable.'); attempt.state = 'abandoned'; attempt.updatedAt = now(); });
    },
    async ensureAssessmentJob(attemptId, options = {}) {
      let job;
      await change(progress => { const result = ensureAssessmentJob(progress, attemptId, { ...options, now: now() }); job = result.job; return result.state; });
      return job;
    },
    async updateAssessmentJob(id, patch) {
      return change(progress => { const job = progress.jobs.find(item => item.id === id); check(job, 'Unknown grading request.');
        if (job.state === 'complete') return;
        check(Object.keys(patch).every(key => ['state', 'lastError'].includes(key)), 'Invalid grading job update.');
        Object.assign(job, patch, { updatedAt: now() }); });
    },
    async acceptAssessmentEvaluation(jobId, evaluation) {
      return change(progress => {
        const job = progress.jobs.find(item => item.id === jobId);
        check(job && evaluation.id === job.id && evaluation.attemptId === job.attemptId && evaluation.submissionHash === job.submissionHash && evaluation.source === 'gateway-ai', 'This grading receipt belongs to a different request.');
        const next = addAssessmentEvaluation(progress, evaluation, now());
        Object.assign(next.jobs.find(item => item.id === jobId), { state: 'complete', evaluationId: evaluation.id, lastError: null, updatedAt: now() });
        return next;
      });
    },
    async acceptGeminiEvaluation(attemptId, prepared) {
      const progress = state().assessments; const attempt = find(progress, attemptId);
      check(prepared.evaluation.source === 'gemini-import' && prepared.evaluation.attemptId === attemptId, 'Invalid external grade identity.');
      if (prepared.candidate) {
        check(prepared.candidate.submission.exportContextHash === attempt.exportContextHash, 'The report belongs to a different practice pack.');
        check(await submissionDigest(attempt.definitionHash, attempt.mode, prepared.candidate.submission) === prepared.candidate.submissionHash, 'Invalid external submission hash.');
      }
      await change(current => {
        const withSubmission = prepared.candidate ? saveSealedAssessment(current, prepared.candidate, now()) : current;
        const existing = withSubmission.evaluations.find(item => item.id === prepared.evaluation.id);
        const evaluation = existing ? { ...prepared.evaluation, createdAt: existing.createdAt } : prepared.evaluation;
        return addAssessmentEvaluation(withSubmission, evaluation, now());
      });
    },
    async verifyAssessmentDefinition(definition, expectedHash) { check(await hashJSON(definition) === expectedHash, 'Assessment content changed.'); },
  };
}
