import { assessmentRubric } from './assessment-rubrics.js';

export const ASSESSMENT_VERSION = 1;
export const ASSESSMENT_LEVELS = ['starter', 'A1', 'A2', 'B1'];
export const ASSESSMENT_MODES = ['practice', 'checkpoint'];
export const SUPPORT_KINDS = ['question_repeat', 'question_rephrase', 'question_translation', 'word_lookup', 'answer_hint', 'model_answer', 'answer_reveal'];
export const ASSESSMENT_LIMITS = { items: 30, writingChars: 3000, evidenceChars: 8000, evidenceUnits: 64, requestBytes: 32768, reportChars: 32768, packBytes: 300000, minReplies: 3 };
export const check = (condition, message) => { if (!condition) throw new Error(message); };
export const record = value => value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
export const id = value => typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,160}$/.test(value) && !['__proto__', 'constructor', 'prototype'].includes(value);
export const text = (value, max = 2000) => typeof value === 'string' && value.length <= max;
export const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
export const time = value => Number.isFinite(value) && value >= 0 && value <= 8.64e15;
const filled = (value, max) => text(value, max) && value.trim();
const list = (value, max = 30) => Array.isArray(value) && value.length <= max;
const ids = (value, max = 30) => list(value, max) && value.every(id) && new Set(value).size === value.length;
const unique = values => new Set(values.map(value => value.id)).size === values.length;
function keys(value, allowed) { check(record(value) && Object.keys(value).every(key => allowed.includes(key)), 'Unexpected assessment fields.'); }
function feedback(value) { check(record(value) && text(value.de, 1000) && filled(value.en, 1000), 'Provide German/English assessment feedback.'); }
function answerRule(value) {
  check(record(value) && Number.isInteger(value.points) && value.points > 0 && value.points <= 10, 'Invalid item points.');
  check(list(value.accepted, 30) && value.accepted.length && value.accepted.every(answer => filled(answer, 500)), 'Provide accepted answers.');
  check(record(value.policy) && ['exact', 'fold'].includes(value.policy.case) && ['keep', 'terminal'].includes(value.policy.punctuation), 'Specify answer normalization.');
}

/** Validate authored content without depending on the live course catalog or mutable learner state. */
export function validateAssessmentDefinition(def) {
  keys(def, ['schemaVersion', 'id', 'version', 'kind', 'title', 'level', 'lessonIds', 'skillIds', 'familyId', 'formId', 'exposureGroupIds', 'instructions', 'stimuli', 'items', 'rubricId', 'task', 'scenario']);
  check(def.schemaVersion === 1 && id(def.id) && filled(def.version, 100) && ['objective', 'writing', 'roleplay'].includes(def.kind), 'Invalid assessment identity or kind.');
  check(filled(def.title, 200) && ASSESSMENT_LEVELS.includes(def.level) && ids(def.lessonIds) && ids(def.skillIds), 'Invalid assessment classification.');
  check(id(def.familyId) && id(def.formId) && filled(def.instructions, 3000), 'Missing assessment instructions.');
  check(ids(def.exposureGroupIds), 'Identify assessment exposure groups.');
  check(list(def.stimuli, 10) && unique(def.stimuli), 'Invalid assessment stimuli.');
  def.stimuli.forEach(stimulus => check(record(stimulus) && id(stimulus.id) && filled(stimulus.de, 6000) && text(stimulus.en, 6000), 'Invalid reading stimulus.'));
  check(list(def.items, ASSESSMENT_LIMITS.items) && unique(def.items), 'Invalid assessment item list.');
  for (const item of def.items) {
    keys(item, ['id', 'type', 'domain', 'promptDe', 'promptEn', 'stimulusIds', 'skillIds', 'feedback', 'points', 'options', 'answer', 'accepted', 'policy', 'parts', 'tokens', 'orders']);
    check(id(item.id) && ['choice', 'text', 'slots', 'order'].includes(item.type) && ['vocabulary', 'grammar', 'reading', 'writing'].includes(item.domain), 'Invalid assessment item.');
    check((item.promptDe === null || text(item.promptDe, 1500)) && filled(item.promptEn, 1500) && ids(item.skillIds), 'Invalid item prompt.');
    check(ids(item.stimulusIds) && item.stimulusIds.every(ref => def.stimuli.some(stimulus => stimulus.id === ref)), 'An item references an unknown stimulus.');
    feedback(item.feedback);
    if (item.type === 'text') answerRule(item);
    if (item.type === 'slots') {
      check(list(item.parts, 8) && item.parts.length && unique(item.parts), 'Invalid item slots.');
      item.parts.forEach(part => { check(id(part.id) && filled(part.label, 200), 'Invalid slot label.'); answerRule(part); });
    }
    if (['choice', 'order'].includes(item.type)) check(Number.isInteger(item.points) && item.points > 0 && item.points <= 10, 'Invalid item points.');
    if (item.type === 'choice') {
      check(list(item.options, 8) && item.options.length >= 2 && unique(item.options), 'Invalid answer choices.');
      item.options.forEach(option => check(id(option.id) && filled(option.text, 500), 'Invalid answer option.'));
      check(item.options.some(option => option.id === item.answer), 'Missing correct option.');
    }
    if (item.type === 'order') {
      check(list(item.tokens, 16) && item.tokens.length >= 2 && unique(item.tokens), 'Invalid word-order tokens.');
      item.tokens.forEach(token => check(id(token.id) && filled(token.text, 100), 'Invalid word-order token.'));
      check(list(item.orders, 8) && item.orders.length && item.orders.every(order => ids(order, 16) && order.length === item.tokens.length && order.every(ref => item.tokens.some(token => token.id === ref))), 'Invalid accepted word order.');
    }
  }
  if (def.kind === 'objective') check(def.items.length > 0 && def.rubricId === null && def.task === null && def.scenario === null, 'Objective checks require items only.');
  else {
    check(!def.items.length && def.rubricId === (def.kind === 'writing' ? 'writing:1' : 'conversation:1'), 'Incorrect rubric for assessment kind.');
    assessmentRubric(def.rubricId);
    if (def.kind === 'writing') {
      check(def.scenario === null && record(def.task) && filled(def.task.prompt, 3000) && list(def.task.goals, 6) && def.task.goals.length && def.task.goals.every(goal => filled(goal, 500)), 'Invalid writing task.');
      check(Array.isArray(def.task.words) && def.task.words.length === 2 && def.task.words.every(Number.isInteger) && def.task.words[0] > 0 && def.task.words[1] >= def.task.words[0], 'Invalid suggested writing range.');
    } else {
      const s = def.scenario;
      check(def.task === null && record(s) && id(s.id) && id(s.variantId) && ['du', 'Sie'].includes(s.register), 'Invalid roleplay scenario.');
      for (const key of ['learnerRole', 'partnerRole', 'learnerTask', 'partnerInstructions', 'openingDe', 'openingEn']) check(filled(s[key], 2500), 'Incomplete roleplay scenario.');
      check(text(s.preparation, 4500) && list(s.goals, 6) && s.goals.length >= 2 && unique(s.goals), 'Provide observable roleplay goals.');
      s.goals.forEach(goal => check(record(goal) && id(goal.id) && filled(goal.text, 1000), 'Invalid roleplay goal.'));
    }
  }
  return def;
}

export function validateAssessmentPack(pack, expected = null) {
  keys(pack, ['schemaVersion', 'id', 'version', 'definitions']);
  check(pack.schemaVersion === 1 && id(pack.id) && filled(pack.version, 100) && list(pack.definitions, 30) && pack.definitions.length && unique(pack.definitions), 'Invalid assessment pack.');
  if (expected) check(pack.id === expected.id && pack.version === expected.version, 'Assessment pack version mismatch.');
  pack.definitions.forEach(validateAssessmentDefinition);
  return pack;
}

export function validateSupportEvents(events) {
  check(list(events, 100) && unique(events), 'Invalid assessment support history.');
  events.forEach(event => check(record(event) && id(event.id) && SUPPORT_KINDS.includes(event.kind) && ['preparation', 'assessment'].includes(event.phase)
    && (event.refId === null || id(event.refId)) && time(event.at), 'Invalid support event.'));
  return events;
}
export function validateAssessmentSubmission(def, submission, { external = false } = {}) {
  check(record(submission), 'Missing assessment submission.');
  if (submission.kind === 'external') {
    check(external && def.kind === 'roleplay' && hash(submission.exportContextHash) && hash(submission.reportHash), 'Invalid external submission.');
    return submission;
  }
  check(submission.kind === def.kind, 'The submission does not match the assessment.');
  validateSupportEvents(submission.events);
  if (def.kind === 'objective') {
    check(record(submission.answers) && Object.keys(submission.answers).length === def.items.length && def.items.every(item => Object.hasOwn(submission.answers, item.id)), 'Submit each item, or leave it explicitly unanswered.');
    for (const item of def.items) {
      const value = submission.answers[item.id];
      if (value === null) continue;
      if (item.type === 'text') check(text(value, 500), 'Invalid written answer.');
      if (item.type === 'choice') check(item.options.some(option => option.id === value), 'Unknown answer choice.');
      if (item.type === 'slots') check(record(value) && Object.keys(value).every(key => item.parts.some(part => part.id === key)) && Object.values(value).every(answer => answer === null || text(answer, 500)), 'Invalid slot answers.');
      if (item.type === 'order') check(ids(value, 16) && value.every(key => item.tokens.some(token => token.id === key)), 'Invalid word-order answer.');
    }
  } else if (def.kind === 'writing') {
    check(filled(submission.text, ASSESSMENT_LIMITS.writingChars) && ['typed', 'dictated', 'unknown'].includes(submission.inputMode), 'Write a response before submitting (up to 3,000 characters).');
  } else {
    check(submission.complete === true && list(submission.turns, ASSESSMENT_LIMITS.evidenceUnits) && unique(submission.turns), 'Provide the complete assessed segment.');
    for (const turn of submission.turns) {
      check(record(turn) && id(turn.id) && ['learner', 'partner', 'control'].includes(turn.role) && ['preparation', 'assessment'].includes(turn.phase), 'Invalid evidence turn.');
      check(['typed', 'transcribed', 'generated', 'control', 'unknown'].includes(turn.inputMode) && text(turn.text, 3000) && text(turn.audioKey, 200) && typeof turn.edited === 'boolean', 'Invalid evidence provenance.');
      check(turn.role !== 'learner' || ['typed', 'transcribed', 'unknown'].includes(turn.inputMode), 'Interface controls are not learner utterances.');
    }
    check(submission.turns.reduce((size, turn) => size + turn.text.length, 0) <= ASSESSMENT_LIMITS.evidenceChars, 'This conversation is too long for one grade. Start a shorter assessed roleplay; no turns were silently dropped.');
  }
  return submission;
}
export function assessmentEvidence(submission) {
  if (submission.kind === 'writing') return [{ id: 'writing', text: submission.text }];
  if (submission.kind === 'roleplay') return submission.turns.filter(turn => turn.role === 'learner' && turn.phase === 'assessment' && turn.text.trim());
  return [];
}
export function supportSummary(submission) {
  if (submission.kind === 'external') return 'external-claim';
  return submission.events.some(event => event.phase === 'assessment' && ['answer_hint', 'model_answer', 'answer_reveal', 'word_lookup', 'question_translation'].includes(event.kind))
    ? 'answer-help-recorded' : 'no-answer-help-recorded';
}

export function validateRubricResult(raw, rubricId, submission = null, { external = false } = {}) {
  keys(raw, ['ratings', 'strengths', 'corrections', 'retryDe', 'retryEn']);
  const expected = assessmentRubric(rubricId).criteria.map(([key]) => key);
  check(list(raw.ratings, 5) && raw.ratings.length === 5 && new Set(raw.ratings.map(rating => rating.id)).size === 5, 'The report needs each of the five rubric criteria once.');
  const evidence = submission ? assessmentEvidence(submission) : [];
  const norm = value => value.normalize('NFC').replace(/\s+/gu, ' ').trim();
  const verifyQuote = quote => {
    keys(quote, ['refId', 'quote']);
    check((quote.refId === null || id(quote.refId)) && filled(quote.quote, 500), 'Invalid grading quotation.');
    if (!external) check(evidence.some(unit => unit.id === quote.refId && norm(unit.text).includes(norm(quote.quote))), 'The grader quoted text absent from the learner evidence.');
  };
  for (const rating of raw.ratings) {
    keys(rating, ['id', 'score', 'reasonEn', 'evidence']);
    check(expected.includes(rating.id) && (rating.score === null || (Number.isInteger(rating.score) && rating.score >= 0 && rating.score <= 4)), 'Criterion scores must be integers 0–4 or null.');
    check(filled(rating.reasonEn, 600) && list(rating.evidence, 2), 'Explain each rating briefly.');
    check(rating.score === null || rating.evidence.length > 0, 'A numerical rating requires learner evidence.');
    rating.evidence.forEach(verifyQuote);
  }
  check(list(raw.strengths, 2) && raw.strengths.every(value => filled(value, 500)) && list(raw.corrections, 2), 'Keep feedback to two strengths and two corrections.');
  raw.corrections.forEach(item => {
    keys(item, ['refId', 'original', 'corrected', 'explanationDe', 'explanationEn']);
    verifyQuote({ refId: item.refId, quote: item.original });
    check(filled(item.corrected, 500) && filled(item.explanationDe, 600) && filled(item.explanationEn, 600), 'Explain each correction in German and English.');
  });
  check(filled(raw.retryDe, 800) && filled(raw.retryEn, 800), 'Provide a short retry task.');
  return raw;
}
export function validateAssessmentRef(ref) {
  keys(ref, ['attemptId', 'definitionId', 'definitionVersion', 'definitionHash', 'mode']);
  check(id(ref.attemptId) && id(ref.definitionId) && filled(ref.definitionVersion, 100) && hash(ref.definitionHash) && ASSESSMENT_MODES.includes(ref.mode), 'Invalid assessed conversation reference.');
  return ref;
}

/** Stable JSON for identity, not for linguistic normalization. Array order and raw text are preserved. */
export function canonicalJSON(value) {
  const canonical = item => {
    if (item === null || typeof item === 'string' || typeof item === 'boolean') return item;
    if (typeof item === 'number') { check(Number.isFinite(item), 'Cannot hash a non-finite number.'); return item; }
    if (Array.isArray(item)) {
      check(Object.getOwnPropertySymbols(item).length === 0 && Object.getOwnPropertyNames(item).length === item.length + 1
        && Array.from({ length: item.length }, (_, index) => Object.hasOwn(item, index) && Object.hasOwn(Object.getOwnPropertyDescriptor(item, index), 'value')).every(Boolean), 'Only dense JSON arrays can be hashed.');
      return item.map(canonical);
    }
    check(record(item), 'Only plain JSON values can be hashed.');
    check(Object.getOwnPropertySymbols(item).length === 0 && Object.getOwnPropertyNames(item).length === Object.keys(item).length
      && Object.values(Object.getOwnPropertyDescriptors(item)).every(property => Object.hasOwn(property, 'value')), 'Only JSON data properties can be hashed.');
    return Object.fromEntries(Object.keys(item).sort().map(key => { check(!['__proto__', 'constructor', 'prototype'].includes(key), 'Unsafe assessment key.'); return [key, canonical(item[key])]; }));
  };
  return JSON.stringify(canonical(value));
}
export async function hashJSON(value) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalJSON(value)));
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
export const submissionDigest = (definitionHash, mode, submission) => hashJSON({ definitionHash, mode, submission });
