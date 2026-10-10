import { validateAssessmentDefinition, validateAssessmentSubmission, check } from './assessment-contracts.js';
import { assessmentRubric } from './assessment-rubrics.js';

export const KEYED_SCORER_VERSION = 'keyed-1';
export function normalizeAnswer(answer, policy) {
  let value = String(answer ?? '').normalize('NFC').trim().replace(/\s+/gu, ' ');
  if (policy.case === 'fold') value = value.toLocaleLowerCase('de');
  if (policy.punctuation === 'terminal') value = value.replace(/[.!?]+$/u, '').trimEnd();
  return value;
}
const accepted = (rule, value) => typeof value === 'string' && rule.accepted.some(answer => normalizeAnswer(answer, rule.policy) === normalizeAnswer(value, rule.policy));
export const itemMaximum = item => item.type === 'slots' ? item.parts.reduce((sum, part) => sum + part.points, 0) : item.points;
export function scoreObjective(definition, submission) {
  validateAssessmentDefinition(definition); validateAssessmentSubmission(definition, submission);
  check(definition.kind === 'objective', 'This checker only handles authored answer keys.');
  const items = definition.items.map(item => {
    const answer = submission.answers[item.id];
    let earned = 0;
    if (item.type === 'choice') earned = answer === item.answer ? item.points : 0;
    if (item.type === 'text') earned = accepted(item, answer) ? item.points : 0;
    if (item.type === 'slots') earned = item.parts.reduce((sum, part) => sum + (accepted(part, answer?.[part.id]) ? part.points : 0), 0);
    if (item.type === 'order') earned = Array.isArray(answer) && item.orders.some(order => order.length === answer.length && order.every((key, index) => key === answer[index])) ? item.points : 0;
    return { itemId: item.id, domain: item.domain, earned, maximum: itemMaximum(item) };
  });
  const earned = items.reduce((sum, item) => sum + item.earned, 0);
  const maximum = items.reduce((sum, item) => sum + item.maximum, 0);
  return { type: 'keyed', status: 'graded', items, earned, maximum, percentage: Math.round(100 * earned / maximum) };
}
export function calculateRubricScore(rubricId, raw) {
  const ids = assessmentRubric(rubricId).criteria.map(([id]) => id);
  check(raw.ratings.length === ids.length && ids.every(id => raw.ratings.filter(rating => rating.id === id).length === 1), 'Incorrect rubric criteria.');
  const scores = ids.map(id => raw.ratings.find(rating => rating.id === id).score);
  check(scores.every(score => score === null || Number.isInteger(score) && score >= 0 && score <= 4), 'Invalid criterion score.');
  const observed = scores.filter(score => score !== null);
  const status = observed.length === 5 ? 'graded' : observed.length ? 'partial' : 'insufficient_evidence';
  return { type: 'rubric', status, earned: observed.reduce((sum, score) => sum + score, 0), maximum: 20,
    percentage: status === 'graded' ? observed.reduce((sum, score) => sum + score, 0) * 5 : null, raw };
}
