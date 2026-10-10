import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { canonicalJSON, hashJSON, submissionDigest, validateAssessmentDefinition, validateAssessmentPack,
  validateAssessmentSubmission, validateRubricResult, assessmentEvidence, supportSummary } from '../shared/assessment-contracts.js';
import { assessmentRubric, RATING_ANCHORS } from '../shared/assessment-rubrics.js';
import { normalizeAnswer, scoreObjective, calculateRubricScore } from '../shared/assessment-scoring.js';
import { keyedEvaluation, rubricEvaluation, validateAssessmentEvaluation } from '../shared/assessment-results.js';

const NOW = Date.parse('2026-10-09T10:00:00Z');
const packs = await Promise.all(['cafe-a', 'cafe-b', 'appointment-a', 'appointment-b'].map(async name =>
  JSON.parse(await readFile(new URL(`../app/public/assessments/pilot-${name}-v1.json`, import.meta.url), 'utf8'))));
const definition = (kind, index = 0) => structuredClone(packs[index].definitions.find(item => item.kind === kind));
const CRITERIA = {
  'writing:1': ['task', 'organisation', 'vocabulary', 'grammar', 'mechanics'],
  'conversation:1': ['task', 'interaction', 'clarity', 'vocabulary', 'grammar'],
};
const writing = () => ({ kind: 'writing', text: 'Hallo Mia!\nAm Montag um zehn Uhr im Café? Hast du Zeit?', inputMode: 'typed', events: [] });
function minimalValidRawResult(rubricId = 'writing:1', { scores = [0, 1, 2, 3, 4], refId = 'writing', quote = 'Hallo Mia!' } = {}) {
  return { ratings: CRITERIA[rubricId].map((id, index) => ({ id, score: scores[index],
    reasonEn: scores[index] === null ? 'There was no opportunity to observe this criterion.' : 'The quoted words provide evidence for this criterion.',
    evidence: scores[index] === null ? [] : [{ refId, quote }] })),
  strengths: [], corrections: [], retryDe: 'Versuche es mit einem anderen Tag.', retryEn: 'Try again with a different day.' };
}
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
const unit = (id, role, phase, text, inputMode = role === 'learner' ? 'typed' : role === 'partner' ? 'generated' : 'control') =>
  ({ id, role, phase, text, inputMode, audioKey: '', edited: false });
const roleplay = () => ({ kind: 'roleplay', complete: true, events: [], turns: [
  unit('warmup', 'learner', 'preparation', 'Ich bestelle einen Kaffee.'),
  unit('model', 'partner', 'preparation', 'Ich möchte einen kleinen Tee.'),
  unit('opening', 'partner', 'assessment', 'Was möchten Sie trinken?'),
  unit('order', 'learner', 'assessment', 'Ich möchte ein Tee.'),
  unit('hint', 'control', 'assessment', 'Bitte gib mir eine kleine Hilfe für meine Antwort.'),
  unit('price', 'learner', 'assessment', 'wie viel kostet er', 'transcribed'),
  unit('payment', 'learner', 'assessment', 'Kann ich mit Karte bezahlen?'),
  unit('blank', 'learner', 'assessment', ' \t\n '),
] });

// These answers and totals are independent of the authored answer keys.
function smallObjective() {
  const def = definition('objective');
  def.items = def.items.filter(item => ['cafe.a.vocab.tea', 'cafe.a.grammar.modal', 'cafe.a.grammar.prepositions', 'cafe.a.grammar.order'].includes(item.id));
  return def;
}
const partialAnswers = () => ({ kind: 'objective', events: [], answers: {
  'cafe.a.vocab.tea': 'tea',
  'cafe.a.grammar.modal': 'mochte',
  'cafe.a.grammar.prepositions': { day: 'am' },
  'cafe.a.grammar.order': ['can', 'i', 'please', 'card', 'pay'],
} });
async function sealedAttempt(def, submission) {
  const definitionHash = await hashJSON(def);
  return { id: 'contract-attempt', state: 'submitted', mode: 'checkpoint', definitionHash,
    submissionHash: await submissionDigest(definitionHash, 'checkpoint', submission), submission };
}

test('canonical identity sorts nested object keys without mutating values or invoking text normalization', async () => {
  const first = freeze({ z: 'scho\u0308n\nMaße', a: [{ z: false, a: null }, 2, '  schon  '] });
  const reordered = freeze({ a: [{ a: null, z: false }, 2, '  schon  '], z: 'scho\u0308n\nMaße' });
  const expected = '{"a":[{"a":null,"z":false},2,"  schon  "],"z":"scho\u0308n\\nMaße"}';
  const before = structuredClone(first);
  assert.equal(canonicalJSON(first), expected);
  assert.equal(canonicalJSON(reordered), expected);
  const digest = createHash('sha256').update(expected, 'utf8').digest('hex');
  assert.equal(await hashJSON(first), digest);
  assert.equal(await hashJSON(reordered), digest);
  assert.match(digest, /^[a-f0-9]{64}$/u);
  assert.deepEqual(first, before);
  assert.equal(canonicalJSON(Object.assign(Object.create(null), { b: 2, a: 1 })), '{"a":1,"b":2}');
  assert.equal(await hashJSON(null), createHash('sha256').update('null').digest('hex'));
});

test('array order, every raw character and Unicode representation contribute to the hash', async () => {
  const original = { turns: ['schön', 'Maße'], text: 'Hallo\nMia!' };
  const digest = await hashJSON(original);
  for (const changed of [
    { ...original, turns: ['Maße', 'schön'] },
    { ...original, turns: ['scho\u0308n', 'Maße'] },
    { ...original, turns: ['schon', 'Maße'] },
    { ...original, turns: ['schön', 'Masse'] },
    { ...original, text: 'Hallo Mia!' }, { ...original, text: 'Hallo\r\nMia!' },
    { ...original, text: 'Hallo\nMia! ' }, { ...original, text: 'hallo\nMia!' },
  ]) assert.notEqual(await hashJSON(changed), digest, JSON.stringify(changed));
});

test('canonical hashing rejects unsafe keys at any object depth', async t => {
  for (const key of ['__proto__', 'constructor', 'prototype']) await t.test(key, async () => {
    const unsafe = Object.fromEntries([[key, { polluted: true }]]);
    for (const value of [unsafe, { turns: [unsafe] }]) {
      assert.throws(() => canonicalJSON(value), /Unsafe assessment key/);
      await assert.rejects(hashJSON(value), /Unsafe assessment key/);
    }
    assert.equal({}.polluted, undefined);
  });
  assert.equal(canonicalJSON({ text: '__proto__ constructor prototype' }), '{"text":"__proto__ constructor prototype"}');
});

test('non-JSON values are rejected rather than silently dropped or converted to null', async t => {
  class CustomValue { constructor() { this.value = 1; } }
  const cases = [
    ['undefined', undefined], ['NaN', NaN], ['infinity', Infinity], ['negative infinity', -Infinity],
    ['bigint', 1n], ['symbol', Symbol('evidence')], ['function', () => 'answer'], ['date', new Date(NOW)],
    ['map', new Map([['answer', 'ja']])], ['set', new Set(['ja'])], ['regexp', /ja/u],
    ['typed array', new Uint8Array([1])], ['class instance', new CustomValue()],
  ];
  for (const [name, value] of cases) await t.test(name, async () => {
    for (const input of [value, { evidence: value }, [value]]) {
      assert.throws(() => canonicalJSON(input), /plain JSON|non-finite/);
      await assert.rejects(hashJSON(input), /plain JSON|non-finite/);
    }
  });
  const cyclic = {}; cyclic.self = cyclic;
  assert.throws(() => canonicalJSON(cyclic), Error);
  await assert.rejects(hashJSON(cyclic), Error);
});

test('sparse arrays cannot acquire the same identity as explicit null evidence', async () => {
  const sparse = ['first', , 'last'];
  assert.throws(() => canonicalJSON(sparse), Error);
  await assert.rejects(hashJSON({ turns: sparse }), Error);
});

test('symbol-keyed non-JSON content cannot disappear from canonical identity', async () => {
  const value = { text: 'ja', [Symbol('hidden evidence')]: 'nein' };
  assert.throws(() => canonicalJSON(value), Error);
  await assert.rejects(hashJSON(value), Error);
});

test('submission identity binds the definition, mode, complete text and support history', async () => {
  const definitionHash = 'a'.repeat(64);
  const submission = freeze({ kind: 'writing', text: 'Hallo Mia!', inputMode: 'typed', events: [] });
  const serialized = `{"definitionHash":"${definitionHash}","mode":"practice","submission":{"events":[],"inputMode":"typed","kind":"writing","text":"Hallo Mia!"}}`;
  const digest = await submissionDigest(definitionHash, 'practice', submission);
  assert.equal(digest, createHash('sha256').update(serialized).digest('hex'));
  assert.notEqual(await submissionDigest('b'.repeat(64), 'practice', submission), digest);
  assert.notEqual(await submissionDigest(definitionHash, 'checkpoint', submission), digest);
  for (const patch of [{ text: 'Hallo Mia! ' }, { inputMode: 'dictated' },
    { events: [{ id: 'help', kind: 'word_lookup', phase: 'assessment', refId: null, at: NOW }] }]) {
    assert.notEqual(await submissionDigest(definitionHash, 'practice', { ...submission, ...patch }), digest);
  }
});

test('each pilot pack validates and uses the five task-level criteria of its own rubric', () => {
  for (const pack of packs) {
    assert.equal(validateAssessmentPack(freeze(pack)), pack);
    for (const def of pack.definitions) {
      assert.equal(validateAssessmentDefinition(def), def);
      if (def.kind !== 'objective') assert.deepEqual(assessmentRubric(def.rubricId).criteria.map(([id]) => id), CRITERIA[def.rubricId]);
    }
  }
  assert.equal(RATING_ANCHORS.length, 5);
  assert.throws(() => assessmentRubric('conversation:2'), /Unsupported/);
});

test('normalization preserves German meaning, internal punctuation and authored case policy', () => {
  const fold = { case: 'fold', punctuation: 'terminal' };
  const exact = { case: 'exact', punctuation: 'keep' };
  for (const [input, expected] of [
    [' \nSCHO\u0308N\t! ', 'schön'], ['schon', 'schon'], ['MASSE.', 'masse'], ['MAẞE?', 'maße'],
    [' \tKann  ich\nmit Karte bezahlen?! ', 'kann ich mit karte bezahlen'],
    ['Nein, danke!', 'nein, danke'], ['2,50 €.', '2,50 €'], ['schön; ', 'schön;'],
  ]) assert.equal(normalizeAnswer(input, fold), expected);
  assert.notEqual(normalizeAnswer('schon', fold), normalizeAnswer('schön', fold));
  assert.notEqual(normalizeAnswer('Masse', fold), normalizeAnswer('Maße', fold));
  assert.equal(normalizeAnswer(' \tSchön! \n', exact), 'Schön!');
  assert.equal(normalizeAnswer('Mit\nKarte.', exact), 'Mit Karte.');
});

test('only explicitly authored variants broaden literal answer acceptance', () => {
  const def = definition('objective');
  const template = def.items.find(item => item.id === 'cafe.a.vocab.size');
  def.items = [
    { ...template, id: 'beautiful', accepted: ['schön'] },
    { ...template, id: 'measurements', accepted: ['Maße'] },
    { ...template, id: 'large', accepted: ['groß'] },
  ];
  const grade = (content, answers) => scoreObjective(content, { kind: 'objective', answers, events: [] });
  assert.equal(grade(def, { beautiful: ' SCHO\u0308N! ', measurements: 'MAẞE', large: 'GROẞ' }).earned, 3);
  assert.equal(grade(def, { beautiful: 'schon', measurements: 'Masse', large: 'gross' }).earned, 0);
  assert.equal(grade(def, { beautiful: 'schoen', measurements: 'Maße', large: 'gross' }).earned, 1);
  const variants = structuredClone(def); variants.items[0].accepted.push('schoen');
  assert.equal(grade(variants, { beautiful: 'schoen', measurements: 'Maße', large: 'gross' }).earned, 2);
  assert.equal(grade(variants, { beautiful: 'schon', measurements: 'Masse', large: 'gross' }).earned, 0);
  assert.equal(grade(def, { beautiful: 'nicht schön', measurements: 'Maße oder Masse', large: 'sehr groß' }).earned, 0);
});

test('objective scoring awards slots independently and rounds against the unchanged full denominator', () => {
  const def = freeze(smallObjective()); const submission = freeze(partialAnswers());
  const before = structuredClone({ def, submission });
  assert.deepEqual(scoreObjective(def, submission), { type: 'keyed', status: 'graded', earned: 4, maximum: 6, percentage: 67,
    items: [
      { itemId: 'cafe.a.vocab.tea', domain: 'vocabulary', earned: 1, maximum: 1 },
      { itemId: 'cafe.a.grammar.prepositions', domain: 'grammar', earned: 1, maximum: 2 },
      { itemId: 'cafe.a.grammar.modal', domain: 'grammar', earned: 0, maximum: 1 },
      { itemId: 'cafe.a.grammar.order', domain: 'grammar', earned: 2, maximum: 2 },
    ] });
  assert.deepEqual({ def, submission }, before);
  for (const slots of [{ day: 'am', time: 'am' }, { day: null, time: 'um' }, { time: 'um' }]) {
    const changed = partialAnswers(); changed.answers['cafe.a.grammar.prepositions'] = slots;
    assert.equal(scoreObjective(def, changed).earned, 4);
  }
  const blank = partialAnswers();
  for (const id of Object.keys(blank.answers)) blank.answers[id] = null;
  const result = scoreObjective(def, blank);
  assert.equal(result.earned, 0); assert.equal(result.maximum, 6); assert.equal(result.percentage, 0);
});

test('objective submissions distinguish unanswered items from missing, unknown or malformed responses', () => {
  const def = smallObjective();
  const changes = [
    value => { delete value.answers['cafe.a.grammar.modal']; },
    value => { value.answers.unknown = null; },
    value => { value.answers['cafe.a.vocab.tea'] = 'not-an-option'; },
    value => { value.answers['cafe.a.grammar.modal'] = 4; },
    value => { value.answers['cafe.a.grammar.prepositions'] = { when: 'am' }; },
    value => { value.answers['cafe.a.grammar.order'] = ['can', 'i', 'i', 'card', 'pay']; },
    value => { value.answers['cafe.a.grammar.order'] = ['can', 'i', 'foreign-token']; },
  ];
  for (const change of changes) {
    const bad = partialAnswers(); change(bad);
    assert.throws(() => validateAssessmentSubmission(def, bad), Error);
    assert.throws(() => scoreObjective(def, bad), Error);
  }
  const incomplete = partialAnswers(); incomplete.answers['cafe.a.grammar.order'] = ['can', 'i'];
  assert.equal(scoreObjective(def, incomplete).earned, 2, 'A partial word order earns no order points.');
});

test('writing submission limits reject oversized or empty artifacts without trimming the accepted whole text', () => {
  const def = definition('writing');
  const text = `  Hallo Mia!\n${'a'.repeat(2976)}\nTschüss!  `;
  assert.equal(text.length, 3000);
  for (const inputMode of ['typed', 'dictated', 'unknown']) {
    const submission = freeze({ kind: 'writing', text, inputMode, events: [] });
    assert.equal(validateAssessmentSubmission(def, submission), submission);
    assert.deepEqual(assessmentEvidence(submission), [{ id: 'writing', text }]);
  }
  for (const text of ['', ' \n\t ', 'a'.repeat(3001)]) {
    assert.throws(() => validateAssessmentSubmission(def, { kind: 'writing', text, inputMode: 'typed', events: [] }), /Write a response/);
  }
});

test('roleplay submissions retain all 64 evidence units and reject incomplete, duplicate or false-provenance turns', () => {
  const def = definition('roleplay');
  const submission = { kind: 'roleplay', complete: true, events: [], turns: Array.from({ length: 64 }, (_, index) =>
    unit(`turn-${index}`, 'learner', 'assessment', index === 63 ? ' Letzte\nAntwort. ' : `Antwort ${index}.`, index % 2 ? 'transcribed' : 'typed')) };
  const before = structuredClone(submission);
  validateAssessmentSubmission(def, freeze(submission));
  assert.equal(assessmentEvidence(submission).length, 64);
  assert.equal(assessmentEvidence(submission).at(-1).text, ' Letzte\nAntwort. ');
  assert.deepEqual(submission, before);
  for (const change of [
    value => { value.turns.push(unit('extra', 'partner', 'assessment', 'Noch eine Frage?')); },
    value => { value.complete = false; }, value => { value.turns[1].id = value.turns[0].id; },
    value => { value.turns[0].inputMode = 'generated'; }, value => { value.turns[0].inputMode = 'control'; },
    value => { value.turns[0].phase = 'unknown'; },
  ]) {
    const bad = structuredClone(submission); change(bad);
    assert.throws(() => validateAssessmentSubmission(def, bad), Error);
  }
});

for (const rubricId of Object.keys(CRITERIA)) {
  const submission = rubricId === 'writing:1' ? writing() : roleplay();
  const options = rubricId === 'writing:1' ? {} : { refId: 'order', quote: 'Ich möchte ein Tee.' };
  test(`${rubricId}: every criterion accepts only integer marks 0–4 or an explicitly unobserved null`, () => {
    for (const score of [0, 1, 2, 3, 4, null]) {
      const raw = freeze(minimalValidRawResult(rubricId, { ...options, scores: Array(5).fill(score) }));
      const before = structuredClone(raw);
      assert.equal(validateRubricResult(raw, rubricId, submission), raw);
      assert.deepEqual(raw, before);
    }
    for (const score of [-1, 5, 0.5, 3.9, NaN, Infinity, '4', true, undefined]) {
      const raw = minimalValidRawResult(rubricId, options); raw.ratings[0].score = score;
      assert.throws(() => validateRubricResult(raw, rubricId, submission), /integers 0–4/);
      assert.throws(() => calculateRubricScore(rubricId, raw), /Invalid criterion score/);
    }
  });

  test(`${rubricId}: missing, duplicate, unknown and extra criteria cannot masquerade as five ratings`, () => {
    for (const change of [
      raw => { raw.ratings.pop(); },
      raw => { raw.ratings[1].id = raw.ratings[0].id; },
      raw => { raw.ratings[1].id = 'pronunciation'; },
      raw => { raw.ratings.push({ ...raw.ratings[0], id: 'extra' }); },
    ]) {
      const raw = minimalValidRawResult(rubricId, options); change(raw);
      assert.throws(() => validateRubricResult(raw, rubricId, submission), /five rubric criteria|integers 0–4/);
      assert.throws(() => calculateRubricScore(rubricId, raw), /Incorrect rubric criteria/);
    }
    const reordered = minimalValidRawResult(rubricId, options); reordered.ratings.reverse();
    validateRubricResult(reordered, rubricId, submission);
    assert.equal(calculateRubricScore(rubricId, reordered).percentage, 50);
  });

  test(`${rubricId}: numerical marks, including zero, always need actual evidence`, () => {
    for (let index = 0; index < 5; index += 1) for (const score of [0, 4]) {
      const raw = minimalValidRawResult(rubricId, options);
      Object.assign(raw.ratings[index], { score, evidence: [] });
      assert.throws(() => validateRubricResult(raw, rubricId, submission), /requires learner evidence/);
      assert.throws(() => validateRubricResult(raw, rubricId, null, { external: true }), /requires learner evidence/);
    }
    const missing = minimalValidRawResult(rubricId, options); delete missing.ratings[0].evidence;
    assert.throws(() => validateRubricResult(missing, rubricId, submission), /Explain each rating/);
  });

  test(`${rubricId}: unobserved criteria leave a null percentage rather than becoming zero or a renormalized grade`, () => {
    for (const [scores, status, earned, percentage] of [
      [[0, 1, 2, 3, 4], 'graded', 10, 50], [[4, 4, 4, 4, 4], 'graded', 20, 100],
      [[0, 0, 0, 0, 0], 'graded', 0, 0], [[4, null, 2, null, 0], 'partial', 6, null],
      [[null, null, null, null, null], 'insufficient_evidence', 0, null],
    ]) {
      const raw = freeze(minimalValidRawResult(rubricId, { ...options, scores }));
      validateRubricResult(raw, rubricId, submission);
      assert.deepEqual(calculateRubricScore(rubricId, raw), { type: 'rubric', status, earned, maximum: 20, percentage, raw });
    }
  });
}

test('only nonempty assessed learner utterances support ratings and corrections', () => {
  const submission = freeze(roleplay());
  assert.deepEqual(assessmentEvidence(submission).map(({ id, text, inputMode }) => ({ id, text, inputMode })), [
    { id: 'order', text: 'Ich möchte ein Tee.', inputMode: 'typed' },
    { id: 'price', text: 'wie viel kostet er', inputMode: 'transcribed' },
    { id: 'payment', text: 'Kann ich mit Karte bezahlen?', inputMode: 'typed' },
  ]);
  for (const [refId, quote] of [
    ['warmup', 'Ich bestelle einen Kaffee.'], ['model', 'Ich möchte einen kleinen Tee.'],
    ['opening', 'Was möchten Sie trinken?'], ['hint', 'Bitte gib mir eine kleine Hilfe'],
    ['blank', 'answer'], ['missing', 'Ich möchte ein Tee.'], [null, 'Ich möchte ein Tee.'],
    ['order', 'Kann ich mit Karte bezahlen?'], ['order', 'Ich möchte einen Tee.'],
  ]) {
    const raw = minimalValidRawResult('conversation:1', { refId, quote });
    assert.throws(() => validateRubricResult(raw, 'conversation:1', submission), /absent from the learner evidence/);
    const corrected = minimalValidRawResult('conversation:1', { scores: Array(5).fill(null) });
    corrected.corrections = [{ refId, original: quote, corrected: 'Einen Tee, bitte.', explanationDe: 'Benutze den Akkusativ.', explanationEn: 'Use the accusative.' }];
    assert.throws(() => validateRubricResult(corrected, 'conversation:1', submission), /absent from the learner evidence/);
  }
});

test('quotation matching tolerates NFC and whitespace only, preserving whole typed and transcribed units', () => {
  const submission = writing(); submission.text = '  Hallo Mia!\nIm Cafe\u0301\t am Park ist es schön. Die Maße stimmen.  ';
  const before = structuredClone(submission);
  const valid = minimalValidRawResult('writing:1', { quote: 'Café am Park' });
  validateRubricResult(valid, 'writing:1', submission);
  assert.deepEqual(assessmentEvidence(submission), [{ id: 'writing', text: before.text }]);
  for (const quote of ['café am Park', 'Cafe am Park', 'schon', 'Masse']) {
    assert.throws(() => validateRubricResult(minimalValidRawResult('writing:1', { quote }), 'writing:1', submission), /absent/);
  }
  assert.deepEqual(submission, before);
  const transcribed = roleplay(); transcribed.turns[5].text = 'wie\n  viel kostet er';
  validateRubricResult(minimalValidRawResult('conversation:1', { refId: 'price', quote: 'wie viel kostet er' }), 'conversation:1', transcribed);
  assert.equal(assessmentEvidence(transcribed)[1].text, 'wie\n  viel kostet er');
});

test('unknown rubric fields and missing explanations cannot bypass the raw-result contract', () => {
  for (const change of [
    raw => { raw.percentage = 100; }, raw => { raw.ratings[0].acousticScore = 4; },
    raw => { raw.ratings[0].evidence[0].trusted = true; }, raw => { delete raw.ratings[0].reasonEn; },
    raw => { raw.ratings[0].reasonEn = ' '; }, raw => { delete raw.retryEn; },
  ]) {
    const raw = minimalValidRawResult(); change(raw);
    assert.throws(() => validateRubricResult(raw, 'writing:1', writing()), Error);
  }
});

test('preparation and question repetition are distinct from recorded assessment answer help', () => {
  const submission = writing();
  submission.events = [{ id: 'prep', kind: 'model_answer', phase: 'preparation', refId: null, at: NOW },
    { id: 'repeat', kind: 'question_repeat', phase: 'assessment', refId: null, at: NOW }];
  assert.equal(supportSummary(submission), 'no-answer-help-recorded');
  for (const kind of ['word_lookup', 'question_translation', 'answer_hint', 'model_answer', 'answer_reveal']) {
    const helped = { ...submission, events: [...submission.events, { id: 'help', kind, phase: 'assessment', refId: null, at: NOW }] };
    assert.equal(supportSummary(helped), 'answer-help-recorded');
  }
  assert.equal(supportSummary({ kind: 'external' }), 'external-claim');
});

test('local evaluations retain authored partial credit and reject forged totals or provenance', async () => {
  const def = smallObjective(); const attempt = await sealedAttempt(def, partialAnswers());
  const evaluation = keyedEvaluation(attempt, def, NOW);
  assert.equal(evaluation.id, 'local:contract-attempt');
  assert.equal(evaluation.result.earned, 4); assert.equal(evaluation.result.maximum, 6); assert.equal(evaluation.result.percentage, 67);
  assert.equal(evaluation.source, 'local-key'); assert.equal(evaluation.createdAt, NOW);
  assert.equal(validateAssessmentEvaluation(evaluation, attempt, def), evaluation);
  for (const change of [
    value => { value.result.percentage = 100; }, value => { value.result.items[0].earned = 0; },
    value => { value.scorerVersion = 'other-key'; }, value => { value.model = 'claimed-model'; },
    value => { value.testMode = true; }, value => { value.rubricId = 'writing:1'; },
  ]) {
    const bad = structuredClone(evaluation); change(bad);
    assert.throws(() => validateAssessmentEvaluation(bad, attempt, def), /scoring rules|provenance/);
  }
});

test('rubric evaluations bind sealed evidence and recompute scores without a support penalty', async () => {
  const def = definition('writing'); const submission = writing();
  submission.events = [{ id: 'hint', kind: 'answer_hint', phase: 'assessment', refId: null, at: NOW }];
  const attempt = await sealedAttempt(def, submission);
  const evaluation = rubricEvaluation({ requestId: 'grade:writing', attemptId: attempt.id, definitionHash: attempt.definitionHash,
    submissionHash: attempt.submissionHash, mode: attempt.mode, definition: def, submission, raw: minimalValidRawResult(),
    model: 'fixture-grader', promptVersion: 'fixture-1', now: NOW });
  assert.equal(evaluation.result.percentage, 50); assert.equal(evaluation.result.earned, 10);
  assert.equal(evaluation.support, 'answer-help-recorded');
  assert.equal(validateAssessmentEvaluation(evaluation, attempt, def), evaluation);
  for (const change of [
    value => { value.attemptId = 'another-attempt'; }, value => { value.definitionHash = 'f'.repeat(64); },
    value => { value.submissionHash = 'f'.repeat(64); }, value => { value.mode = 'practice'; },
    value => { value.support = 'no-answer-help-recorded'; }, value => { value.source = 'self'; },
    value => { value.result.percentage = 100; }, value => { value.result.raw.ratings[0].score = 4; },
    value => { value.result.raw.ratings[0].evidence[0].quote = 'Invented words'; },
    value => { value.promoteSRS = true; }, value => { value.model = ''; },
  ]) {
    const bad = structuredClone(evaluation); change(bad);
    assert.throws(() => validateAssessmentEvaluation(bad, attempt, def), Error);
  }
  assert.throws(() => validateAssessmentEvaluation(evaluation, { ...attempt, state: 'in_progress' }, def), /sealed submission/);
});
