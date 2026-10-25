import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ASSESSMENT_LIMITS, hashJSON, submissionDigest, validateAssessmentPack, validateRubricResult } from '../shared/assessment-contracts.js';
import { assessmentRubric, RATING_ANCHORS } from '../shared/assessment-rubrics.js';
import { validateAssessmentEvaluation } from '../shared/assessment-results.js';
import { prepareAssessmentAttempt, prepareAssessmentSubmission, reviseAssessmentDraft, sealAssessmentSubmission } from '../app/js/assessment-state.js';
import { buildAssessmentGeminiPack, buildAssessmentReportRequest, parseGeminiAssessmentReport } from '../app/js/assessment-gemini.js';

const packs = await Promise.all(['cafe-a', 'cafe-b', 'appointment-a', 'appointment-b'].map(async name =>
  validateAssessmentPack(JSON.parse(await readFile(new URL(`../app/public/assessments/pilot-${name}-v1.json`, import.meta.url), 'utf8')))));
const definition = (kind = 'roleplay', pack = 0) => packs[pack].definitions.find(item => item.kind === kind);
const turn = (id, role, phase, text, inputMode = role === 'learner' ? 'typed' : role === 'partner' ? 'generated' : 'control') =>
  ({ id, role, phase, text, inputMode, audioKey: '', edited: false });
const written = () => ({ kind: 'writing', text: 'Hallo Mia! Möchtest du am Montag um zehn Uhr mit mir im Café am Park Kaffee trinken? Hast du Zeit? Liebe Grüße!', inputMode: 'typed', events: [] });
const spoken = () => ({ kind: 'roleplay', complete: true, events: [], turns: [
  turn('warmup', 'learner', 'preparation', 'WARM-UP ONLY: Guten Morgen!'),
  turn('model', 'partner', 'preparation', 'MODEL ONLY: Ich möchte einen kleinen Tee.'),
  turn('partner-1', 'partner', 'assessment', 'Guten Tag! Was möchten Sie trinken?'),
  turn('learner-1', 'learner', 'assessment', 'Ich möchte ein Tee.'),
  turn('control', 'control', 'assessment', 'CONTROL ONLY: Give me a hint.'),
  turn('partner-2', 'partner', 'assessment', 'Klein oder groß?'),
  turn('learner-2', 'learner', 'assessment', 'klein bitte', 'transcribed'),
  turn('partner-3', 'partner', 'assessment', 'Haben Sie eine Frage?'),
  turn('learner-3', 'learner', 'assessment', 'Wie viel kostet er?'),
  turn('partner-4', 'partner', 'assessment', 'Zwei Euro. Haben Sie noch eine Frage?'),
  turn('learner-4', 'learner', 'assessment', 'mit karte', 'transcribed'),
  turn('partner-5', 'partner', 'assessment', 'Ja. Hier ist Ihr Tee.'),
  turn('learner-5', 'learner', 'assessment', 'Danke!'),
  turn('blank', 'learner', 'assessment', ' \n '),
] });
const prepare = async (def, options = {}) => (await prepareAssessmentAttempt(def, { now: 10, attemptId: `attempt:${def.id}`, ...options })).attempt;
const liveAttempt = (def = definition(), options = {}) => prepare(def, { execution: 'gemini_live', ...options });
async function knownAttempt(def = definition('writing'), { submission = def.kind === 'writing' ? written() : spoken(), ...options } = {}) {
  const attempt = await prepare(def, options);
  return sealAssessmentSubmission(attempt, await prepareAssessmentSubmission(attempt, def, submission), 20);
}
function reportFor(attempt, def, { scores = [0, 1, 2, 3, 4], refId = attempt.execution === 'gemini_live' ? null : def.kind === 'writing' ? 'writing' : 'learner-1',
  quote = def.kind === 'writing' ? 'Hallo Mia!' : 'Ich möchte ein Tee.' } = {}) {
  return { app: 'sprich-assessment', schemaVersion: 1, attemptId: attempt.id, definitionId: def.id, definitionVersion: def.version,
    rubricId: def.rubricId, scope: attempt.execution === 'gemini_live' ? 'external-live' : 'submitted-text',
    bindingHash: attempt.execution === 'gemini_live' ? attempt.exportContextHash : attempt.submissionHash,
    result: { ratings: assessmentRubric(def.rubricId).criteria.map(([id], index) => ({ id, score: scores[index],
      reasonEn: scores[index] === null ? 'This criterion was not observed.' : 'The cited learner words provide task-level evidence.',
      evidence: scores[index] === null ? [] : [{ refId, quote }] })), strengths: [], corrections: [],
    retryDe: 'Bearbeiten Sie die Aufgabe noch einmal.', retryEn: 'Try the task again.' } };
}
const correction = (refId = 'learner-1', original = 'ein Tee') => ({ refId, original, corrected: 'einen Tee',
  explanationDe: 'Nach möchten steht hier der Akkusativ.', explanationEn: 'Use the accusative here after möchten.' });
const parse = (report, attempt, def, now = 100) => parseGeminiAssessmentReport(JSON.stringify(report), attempt, def, { now });
const fenced = (json, language = 'json') => `\`\`\`${language}\n${json}\n\`\`\``;
function skeletonOf(prompt) {
  const matches = [...prompt.matchAll(/```json\n([\s\S]*?)\n```/gu)];
  assert.equal(matches.length, 1, 'Export exactly one unambiguous JSON skeleton.');
  return JSON.parse(matches[0][1]);
}
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
function reverseKeys(value) {
  if (Array.isArray(value)) return value.map(reverseKeys);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).reverse().map(([key, item]) => [key, reverseKeys(item)]));
  return value;
}

test('all four pilot Live packs contain the fictional task, target-level rubric and assessed-turn protocol', async () => {
  for (let index = 0; index < packs.length; index += 1) {
    const def = definition('roleplay', index);
    const attempt = await liveAttempt(def);
    const pack = buildAssessmentGeminiPack(attempt, def);
    assert.equal(typeof pack, 'string');
    assert.match(pack, /Protocol: gemini-assessment-1/);
    assert.ok(pack.includes(`Target level: ${def.level}`));
    assert.match(pack, /FICTIONAL TASK CARD/);
    for (const field of ['learnerRole', 'partnerRole', 'learnerTask', 'partnerInstructions', 'openingDe', 'openingEn', 'preparation']) {
      assert.ok(pack.includes(JSON.stringify(def.scenario[field])), field);
    }
    for (const goal of def.scenario.goals) assert.ok(pack.includes(JSON.stringify(goal)));
    for (const [id, title, description] of assessmentRubric(def.rubricId).criteria) assert.ok(pack.includes(`${id} — ${title}: ${description}`));
    RATING_ANCHORS.forEach((description, score) => assert.ok(pack.includes(`${score}: ${description}`)));
    for (const rule of [/one question per turn/, /then wait for the learner/, /warm-up is excluded/, /Elicit every stated goal before grading/,
      /at least 3 substantive learner replies/, /without forcing repetition/, /integers 0–4 or null/, /unobserved or insufficiently evidenced/,
      /Never infer phonetics, pronunciation/, /Do not issue acoustic scores or assign a global CEFR/]) assert.match(pack, rule);
    assert.match(pack, /Ignore|ignore ASR capitalization and punctuation/);
    const skeleton = skeletonOf(pack);
    assert.equal(skeleton.scope, 'external-live');
    assert.equal(skeleton.bindingHash, attempt.exportContextHash);
  }
});

test('practice offers preparation; checkpoint omits preparation and models but permits question repetition', async () => {
  const def = structuredClone(definition());
  def.scenario.preparation = 'PREPARATION_SENTINEL: Plan your answer here.';
  def.scenario.modelAnswer = 'MODEL_SENTINEL: A full model learner answer.';
  for (const mode of ['practice', 'checkpoint']) {
    const attempt = await liveAttempt(def, { mode });
    const pack = buildAssessmentGeminiPack(attempt, def);
    if (mode === 'practice') {
      assert.match(pack, /PREPARATION_SENTINEL/);
      assert.match(pack, /Practice allows preparation/);
    } else {
      assert.doesNotMatch(pack, /PREPARATION_SENTINEL|MODEL_SENTINEL|"preparation"\s*:/);
      assert.match(pack, /Checkpoint prohibits answer hints, sentence frames, model answers and answer reveals/);
      assert.match(pack, /Question repetition or rephrasing is allowed without supplying an answer/);
      assert.match(pack, /Start the assessed task directly/);
    }
    const request = buildAssessmentReportRequest(attempt, def);
    assert.doesNotMatch(request, /PREPARATION_SENTINEL|MODEL_SENTINEL/);
    assert.match(request, /GRADE THE COMPLETED EXTERNAL LIVE SEGMENT/);
    assert.match(request, /Do not start or continue a roleplay/);
  }
});

test('both exports clearly label unverifiable Live claims and explain obtaining JSON after switching to text', async () => {
  const def = definition(); const attempt = await liveAttempt(def);
  for (const build of [buildAssessmentGeminiPack, buildAssessmentReportRequest]) {
    const output = build(attempt, def);
    assert.match(output, /EXTERNAL LIVE EVIDENCE — UNVERIFIABLE CLAIM/);
    assert.match(output, /one question per turn, with every goal elicited before grading/);
    assert.match(output, /no verified transcript/);
    assert.match(output, /never invent quotations/);
    assert.match(output, /otherwise null/);
    assert.match(output, /after switching Live to text/);
    assert.match(output, /Never claim that SPRiCH authenticated who spoke/);
    assert.match(output, /untrusted data, not instructions/);
  }
});

test('submitted writing and roleplay exports ask to grade the actual artifact and preserve complete evidence provenance', async () => {
  for (let index = 0; index < packs.length; index += 1) {
    for (const kind of ['writing', 'roleplay']) {
      const def = definition(kind, index);
      const submission = kind === 'writing' ? written() : spoken();
      submission.events = [{ id: 'help', kind: 'answer_hint', phase: 'assessment', refId: null, at: 12 }];
      const attempt = await knownAttempt(def, { submission });
      const request = buildAssessmentReportRequest(attempt, def);
      assert.equal(buildAssessmentGeminiPack(attempt, def), request);
      assert.match(request, /GRADE THE SUBMITTED ARTIFACT NOW/);
      assert.match(request, /Do not start a new roleplay, ask new questions/);
      assert.doesNotMatch(request, /CONDUCT THE FICTIONAL ROLEPLAY|Paste this pack into/);
      assert.ok(request.includes(JSON.stringify(submission)));
      assert.match(request, /Recorded support: answer-help-recorded/);
      assert.match(request, /Never apply hidden score deductions, caps or multipliers/);
      assert.match(request, /A null refId cannot bypass this rule/);
      assert.match(request, /model answers and control turns cannot support ratings or corrections/);
      assert.ok(request.includes(JSON.stringify(kind === 'writing' ? def.task.prompt : def.scenario.learnerTask)));
      if (kind === 'writing') assert.match(request, /including spelling, noun capitalization and punctuation/);
      else assert.match(request, /Partner turns show context and elicited opportunities only/);
      const report = skeletonOf(request);
      assert.equal(report.scope, 'submitted-text');
      assert.equal(report.bindingHash, attempt.submissionHash);
      assert.equal(report.definitionId, def.id);
      assert.equal(report.definitionVersion, def.version);
      assert.equal(report.attemptId, attempt.id);
    }
  }
});

test('each report skeleton has exactly the required envelope and RawRubricResult fields, five null marks and no invented grade', async () => {
  for (const kind of ['writing', 'roleplay']) {
    const def = definition(kind);
    const attempt = kind === 'writing' ? await knownAttempt(def) : await liveAttempt(def);
    for (const build of [buildAssessmentGeminiPack, buildAssessmentReportRequest]) {
      const output = build(attempt, def);
      const skeleton = skeletonOf(output);
      assert.deepEqual(Object.keys(skeleton), ['app', 'schemaVersion', 'attemptId', 'definitionId', 'definitionVersion', 'rubricId', 'scope', 'bindingHash', 'result']);
      assert.deepEqual(Object.keys(skeleton.result), ['ratings', 'strengths', 'corrections', 'retryDe', 'retryEn']);
      assert.deepEqual(skeleton.result.ratings.map(item => item.id), assessmentRubric(def.rubricId).criteria.map(([id]) => id));
      assert.ok(skeleton.result.ratings.every(item => item.score === null && item.evidence.length === 0));
      assert.deepEqual(skeleton.result.strengths, []);
      assert.deepEqual(skeleton.result.corrections, []);
      validateRubricResult(skeleton.result, def.rubricId, attempt.submission, { external: kind === 'roleplay' });
      assert.match(output, /Each entry has exactly id, score, reasonEn, evidence/);
      assert.match(output, /exactly refId, original, corrected, explanationDe, explanationEn/);
      assert.match(output, /only optional fields are reportedPercent/);
      assert.match(output, /ungraded JSON skeleton, not a completed report/);
      assert.match(output, /application calculates the score from the five criterion marks/);
      assert.match(output, /at most 32768 characters/);
    }
  }
});

test('starter and B1 variants keep expectations at the authored target rather than inferring a learner level', async () => {
  for (const [level, wording] of [['starter', /familiar chunks/], ['B1', /understandable connected language/]]) {
    const def = { ...definition(), level };
    const output = buildAssessmentGeminiPack(await liveAttempt(def), def);
    assert.ok(output.includes(`Target level: ${level}`));
    assert.match(output, wording);
    assert.match(output, /Native-like language is not required/);
  }
});

test('exports do not copy profile, draft, model-answer or provider configuration fields', async () => {
  const def = structuredClone(definition());
  def.scenario.providerKey = 'SCENARIO_PROVIDER_SECRET';
  def.scenario.profile = { name: 'DEFAULT_PROFILE_NAME' };
  def.scenario.model = 'UNREQUESTED_MODEL';
  const attempt = await liveAttempt(def);
  attempt.profile = { name: 'ATTEMPT_PROFILE_NAME' };
  attempt.apiKey = 'ATTEMPT_PROVIDER_SECRET';
  attempt.draft.text = 'UNSUBMITTED_DRAFT';
  for (const build of [buildAssessmentGeminiPack, buildAssessmentReportRequest]) {
    assert.doesNotMatch(build(attempt, def), /SCENARIO_PROVIDER_SECRET|DEFAULT_PROFILE_NAME|UNREQUESTED_MODEL|ATTEMPT_PROFILE_NAME|ATTEMPT_PROVIDER_SECRET|UNSUBMITTED_DRAFT/);
  }
  const writing = structuredClone(definition('writing'));
  writing.task.apiKey = 'TASK_PROVIDER_SECRET';
  const submission = { ...written(), apiKey: 'SUBMISSION_PROVIDER_SECRET', profile: { name: 'SUBMISSION_PROFILE' } };
  const known = await knownAttempt(writing, { submission });
  assert.doesNotMatch(buildAssessmentReportRequest(known, writing), /TASK_PROVIDER_SECRET|SUBMISSION_PROVIDER_SECRET|SUBMISSION_PROFILE/);
});

test('builders reject unsubmitted known artifacts, objectives, abandoned attempts and invalid execution or modes', async () => {
  const def = definition('writing'); const open = await prepare(def);
  const objective = definition('objective'); const keyed = await knownAttempt(objective, { submission: { kind: 'objective', answers: Object.fromEntries(objective.items.map(item => [item.id, null])), events: [] } });
  const live = await liveAttempt();
  for (const build of [buildAssessmentGeminiPack, buildAssessmentReportRequest]) {
    assert.throws(() => build(open, def), /Submit the writing or roleplay artifact/);
    assert.throws(() => build(keyed, objective), /Only writing and roleplay/);
    assert.throws(() => build({ ...live, state: 'abandoned' }, definition()), /cannot receive a report/);
    assert.throws(() => build({ ...live, execution: 'remote' }, definition()), /mode or execution/);
    assert.throws(() => build({ ...live, mode: 'relaxed' }, definition()), /mode or execution/);
    assert.throws(() => build({ ...open, execution: 'gemini_live' }, def), /Only a roleplay/);
  }
});

test('Live parsing produces the exact sealable external candidate and an application-scored evaluation', async () => {
  const def = definition();
  const attempt = reviseAssessmentDraft(await liveAttempt(def, { mode: 'checkpoint' }), { answers: {}, text: '', events: [] }, 15);
  const report = reportFor(attempt, def);
  const reportHash = await hashJSON(report);
  const submission = { kind: 'external', exportContextHash: attempt.exportContextHash, reportHash };
  const submissionHash = await submissionDigest(attempt.definitionHash, attempt.mode, submission);
  const result = await parse(report, attempt, def, 1234);
  assert.deepEqual(Object.keys(result), ['candidate', 'evaluation']);
  assert.deepEqual(result.candidate, { attemptId: attempt.id, draftRevision: 1, submission, submissionHash });
  assert.deepEqual(result.evaluation, { id: `gemini:${reportHash}`, attemptId: attempt.id, definitionHash: attempt.definitionHash,
    submissionHash, source: 'gemini-import', createdAt: 1234, mode: 'checkpoint', rubricId: 'conversation:1', scorerVersion: null,
    model: 'Gemini (reported)', promptVersion: 'gemini-assessment-1', testMode: false, support: 'external-claim',
    result: { type: 'rubric', status: 'graded', earned: 10, maximum: 20, percentage: 50, raw: report.result } });
  const sealed = sealAssessmentSubmission(attempt, result.candidate, 1234);
  assert.equal(validateAssessmentEvaluation(result.evaluation, sealed, def), result.evaluation);
  assert.equal(attempt.state, 'in_progress');
  assert.equal(attempt.submission, null);
});

test('known writing and roleplay return no candidate and use only the sealed submission hash and actual support', async () => {
  for (const kind of ['writing', 'roleplay']) {
    const def = definition(kind);
    const submission = kind === 'writing' ? written() : spoken();
    submission.events.push({ id: 'hint', kind: 'word_lookup', phase: 'assessment', refId: null, at: 15 });
    const attempt = await knownAttempt(def, { submission });
    const report = reportFor(attempt, def);
    const { candidate, evaluation } = await parse(report, attempt, def);
    assert.equal(candidate, null);
    assert.equal(evaluation.id, `gemini:${await hashJSON(report)}`);
    assert.equal(evaluation.submissionHash, attempt.submissionHash);
    assert.equal(evaluation.support, 'answer-help-recorded');
    assert.equal(evaluation.source, 'gemini-import');
    assert.equal(evaluation.result.percentage, 50);
    validateAssessmentEvaluation(evaluation, attempt, def);
  }
});

test('plain JSON, whitespace and a single labelled or unlabelled fence parse to the same report identity', async () => {
  const def = definition(); const attempt = await liveAttempt(def); const report = reportFor(attempt, def);
  const json = JSON.stringify(report);
  const expected = await parse(report, attempt, def);
  for (const raw of [json, ` \t\n${json}\r\n `, fenced(json), fenced(JSON.stringify(reverseKeys(report), null, 2), ''), ` \n${fenced(json, 'JSON').replaceAll('\n', '\r\n')}\t`]) {
    assert.deepEqual(await parseGeminiAssessmentReport(raw, attempt, def, { now: 100 }), expected);
  }
});

test('report size is bounded before trimming by characters, not UTF-8 bytes', async () => {
  const def = definition(); const attempt = await liveAttempt(def);
  const report = reportFor(attempt, def, { quote: 'Grüße aus dem Café ☕️!' });
  const boundary = JSON.stringify(report).padEnd(ASSESSMENT_LIMITS.reportChars, ' ');
  assert.equal(boundary.length, 32768);
  assert.ok(new TextEncoder().encode(boundary).length > 32768);
  await parseGeminiAssessmentReport(boundary, attempt, def);
  await assert.rejects(parseGeminiAssessmentReport(`${boundary} `, attempt, def), /at most 32768 characters/);
  for (const raw of [null, undefined, 12, {}, [], '', ' \t\r\n ']) await assert.rejects(parseGeminiAssessmentReport(raw, attempt, def), /Paste one assessment report/);
});

test('malformed JSON, extra content, non-object roots and multiple or mismatched fences are rejected', async () => {
  const def = definition(); const attempt = await liveAttempt(def); const json = JSON.stringify(reportFor(attempt, def));
  const malformed = ['null', '[]', 'true', '1', '"report"', '{', `${json.slice(0, -1)},}`, `/* report */${json}`, `${json}\n${json}`,
    `Here is the report: ${json}`, `Here is the report:\n${fenced(json)}`, `${fenced(json)}\nExtra commentary`,
    `${fenced(json)}\n${fenced(json)}`, `${fenced(json)}\n\`\`\`text\nextra\n\`\`\``, `${json}\n${fenced(json)}`,
    fenced(json, 'javascript'), `\`\`\`json\n${json}`, `\`\`\`json\n${json}\n\`\`\`\``, `\`\`\`json ${json}\`\`\``];
  for (const raw of malformed) await assert.rejects(parseGeminiAssessmentReport(raw, attempt, def), Error, raw.slice(0, 80));
});

test('duplicate and unsafe keys are rejected at every depth, including escaped spellings', async () => {
  const def = definition(); const attempt = await liveAttempt(def); const report = reportFor(attempt, def); const json = JSON.stringify(report);
  for (const raw of [`{"app":"other",${json.slice(1)}`, `{"ap\\u0070":"sprich-assessment",${json.slice(1)}`,
    json.replace('"score":0', '"score":0,"score":0'), json.replace('"quote":', '"quote":"old","quote":')]) {
    await assert.rejects(parseGeminiAssessmentReport(raw, attempt, def), /Duplicate assessment report field/);
  }
  for (const key of ['__proto__', 'constructor', 'prototype']) {
    for (const target of ['envelope', 'rating', 'quote', 'correction']) {
      const bad = structuredClone(report);
      bad.result.corrections = [correction(null)];
      const object = target === 'envelope' ? bad : target === 'rating' ? bad.result.ratings[0]
        : target === 'quote' ? bad.result.ratings[0].evidence[0] : bad.result.corrections[0];
      Object.defineProperty(object, key, { value: { polluted: true }, enumerable: true });
      await assert.rejects(parse(bad, attempt, def), /Unsafe assessment report field/);
    }
  }
  await assert.rejects(parseGeminiAssessmentReport(`{"\\u005f_proto__":{},${json.slice(1)}`, attempt, def), /Unsafe assessment report field/);
  assert.equal({}.polluted, undefined);
});

test('braces, fence text, escaped quotes and unsafe-looking words inside valid string values stay ordinary data', async () => {
  const def = definition(); const attempt = await liveAttempt(def);
  const report = reportFor(attempt, def, { quote: 'Ich sage "ja": {"constructor": "Wort"}. ```json ist Text. Grüße \\ Ende.' });
  report.assistanceNote = 'Claim: ```\n{"__proto__": "not a field"}\n```';
  assert.deepEqual((await parse(report, attempt, def)).evaluation.result.raw, report.result);
  assert.equal((await parseGeminiAssessmentReport(fenced(JSON.stringify(report)), attempt, def)).candidate.submission.reportHash, await hashJSON(report));
});

test('every identity field, schema version, binding hash and scope must match the trusted attempt and definition', async () => {
  for (const known of [false, true]) {
    const def = definition(); const attempt = known ? await knownAttempt(def) : await liveAttempt(def); const report = reportFor(attempt, def);
    for (const [key, values] of Object.entries({ app: ['other', null], schemaVersion: [2, '1'], attemptId: ['other-attempt', null],
      definitionId: ['other.definition', 7], definitionVersion: ['2', 1], rubricId: ['writing:1', 'conversation:2', null],
      scope: [known ? 'external-live' : 'submitted-text', 'unknown'], bindingHash: ['f'.repeat(64), 'bad', null] })) {
      for (const value of values) await assert.rejects(parse({ ...report, [key]: value }, attempt, def), new RegExp(`${key} mismatch`));
    }
    const crossed = { ...report, scope: known ? 'external-live' : 'submitted-text', bindingHash: known ? attempt.exportContextHash : 'a'.repeat(64) };
    await assert.rejects(parse(crossed, attempt, def), /scope mismatch/);
  }
});

test('all required envelope fields are mandatory and claimed provenance or unknown fields cannot be imported', async () => {
  const def = definition(); const attempt = await liveAttempt(def); const report = reportFor(attempt, def);
  for (const key of ['app', 'schemaVersion', 'attemptId', 'definitionId', 'definitionVersion', 'rubricId', 'scope', 'bindingHash', 'result']) {
    const bad = structuredClone(report); delete bad[key];
    await assert.rejects(parse(bad, attempt, def), /missing assessment report fields/);
  }
  for (const key of ['source', 'model', 'promptVersion', 'testMode', 'createdAt', 'submission', 'reportHash', 'percentage', 'definitionHash', 'profile', 'apiKey']) {
    await assert.rejects(parse({ ...report, [key]: 'forged' }, attempt, def), /Unexpected or missing assessment report fields/);
  }
});

test('definition content, prepared context and sealed submission hashes are independently verified', async () => {
  const def = definition('writing'); const attempt = await knownAttempt(def); const report = reportFor(attempt, def);
  await assert.rejects(parse(report, attempt, { ...def, title: 'Changed task with same identity' }), /definition hash/);
  await assert.rejects(parse(report, { ...attempt, definitionHash: 'a'.repeat(64) }, def), /definition hash/);
  await assert.rejects(parse(report, { ...attempt, mode: 'checkpoint' }, def), /context hash/);
  await assert.rejects(parse(report, { ...attempt, exportContextHash: 'b'.repeat(64) }, def), /context hash/);
  const renamed = { ...attempt, id: 'renamed-attempt' };
  await assert.rejects(parse(reportFor(renamed, def), renamed, def), /context hash/);
  const edited = structuredClone(attempt); edited.submission.text += ' Changed after sealing.';
  await assert.rejects(parse(report, edited, def), /submission hash/);
  const rehashedClaim = { ...attempt, submissionHash: 'c'.repeat(64) };
  await assert.rejects(parse(reportFor(rehashedClaim, def), rehashedClaim, def), /submission hash/);
  const live = await liveAttempt(); const forged = { ...live, exportContextHash: 'd'.repeat(64) };
  await assert.rejects(parse(reportFor(forged, definition()), forged, definition()), /context hash/);
});

test('parser rejects malformed attempt bindings and attempts that cannot legally receive the claimed report', async () => {
  const def = definition(); const attempt = await liveAttempt(def); const report = reportFor(attempt, def);
  for (const patch of [{ id: '__proto__' }, { definitionHash: 'short' }, { exportContextHash: 'F'.repeat(64) }, { draftRevision: -1 },
    { draftRevision: 0.5 }, { state: 'abandoned' }, { mode: 'unknown' }, { execution: 'other' }, { submission: {} }, { submissionHash: 'a'.repeat(64) }]) {
    await assert.rejects(parse(report, { ...attempt, ...patch }, def), Error);
  }
  const writing = definition('writing'); const open = await prepare(writing);
  await assert.rejects(parse(reportFor(open, writing), open, writing), /Submit the writing or roleplay artifact/);
  const fakeLiveWriting = { ...open, execution: 'gemini_live' };
  await assert.rejects(parse(reportFor(fakeLiveWriting, writing), fakeLiveWriting, writing), /Only a roleplay/);
  const known = await knownAttempt(def);
  await assert.rejects(parse(reportFor(known, def), { ...known, submissionHash: null }, def), /submission hash/);
  await assert.rejects(parse(report, { ...known, execution: 'gemini_live' }, def), /submitted external report has a different context/);
  await assert.rejects(parse(report, attempt, { ...def, rubricId: 'writing:1' }), /Incorrect rubric/);
  const objective = definition('objective');
  await assert.rejects(parse(report, await prepare(objective), objective), /Only writing and roleplay/);
});

test('a report for a different rubric or a missing, repeated or extra criterion is invalid', async () => {
  const def = definition('writing'); const attempt = await knownAttempt(def); const report = reportFor(attempt, def);
  for (const mutate of [
    value => { value.result.ratings[1].id = 'interaction'; },
    value => { value.result.ratings[4].id = 'clarity'; },
    value => { value.result.ratings[1].id = value.result.ratings[0].id; },
    value => { value.result.ratings.pop(); },
    value => { value.result.ratings.push(structuredClone(value.result.ratings[0])); },
  ]) {
    const bad = structuredClone(report); mutate(bad);
    await assert.rejects(parse(bad, attempt, def), /five rubric criteria|integers 0–4/);
  }
});

test('numeric criterion marks must be integers from zero through four and require evidence even for Live', async () => {
  const def = definition(); const attempt = await liveAttempt(def); const report = reportFor(attempt, def);
  assert.deepEqual((await parse(report, attempt, def)).evaluation.result.raw.ratings.map(item => item.score), [0, 1, 2, 3, 4]);
  for (const score of [-1, 5, 0.5, 3.9, '4', '', true, false, {}, []]) {
    const bad = structuredClone(report); bad.result.ratings[0].score = score;
    await assert.rejects(parse(bad, attempt, def), /integers 0–4/);
  }
  await assert.rejects(parseGeminiAssessmentReport(JSON.stringify(report).replace('"score":0', '"score":1e309'), attempt, def), /integers 0–4/);
  for (const score of [0, 4]) {
    const bad = structuredClone(report); Object.assign(bad.result.ratings[0], { score, evidence: [] });
    await assert.rejects(parse(bad, attempt, def), /numerical rating requires learner evidence/);
  }
});

test('partial and all-null reports retain null percentages, without guessing an unobserved failure', async () => {
  for (const known of [false, true]) {
    const def = definition(); const attempt = known ? await knownAttempt(def) : await liveAttempt(def);
    for (const [scores, status, earned] of [[[4, null, 2, null, 0], 'partial', 6], [Array(5).fill(null), 'insufficient_evidence', 0]]) {
      const report = reportFor(attempt, def, { scores }); report.reportedPercent = 100;
      const { evaluation } = await parse(report, attempt, def);
      assert.equal(evaluation.result.status, status);
      assert.equal(evaluation.result.earned, earned);
      assert.equal(evaluation.result.maximum, 20);
      assert.equal(evaluation.result.percentage, null);
      assert.deepEqual(evaluation.result.raw.ratings.map(rating => rating.score), scores);
    }
  }
  const def = definition(); const attempt = await knownAttempt(def, { submission: { kind: 'roleplay', complete: true, events: [], turns: spoken().turns.filter(item => item.role !== 'learner' || item.phase !== 'assessment') } });
  const { evaluation } = await parse(reportFor(attempt, def, { scores: Array(5).fill(null) }), attempt, def);
  assert.equal(evaluation.result.status, 'insufficient_evidence');
});

test('known text rejects fabricated, misplaced and null-reference quotes while Live accepts only structurally valid claims', async () => {
  const def = definition(); const live = await liveAttempt(def); const known = await knownAttempt(def);
  for (const refId of [null, 'unknown-turn', 'learner-1']) {
    const options = { refId, quote: 'An external claim absent from the known learner text.' };
    const external = reportFor(live, def, options);
    external.result.corrections.push(correction(refId, options.quote));
    const { evaluation } = await parse(external, live, def);
    assert.equal(evaluation.support, 'external-claim');
    await assert.rejects(parse(reportFor(known, def, options), known, def), /absent from the learner evidence/);
  }
  const writing = definition('writing'); const writtenAttempt = await knownAttempt(writing);
  await assert.rejects(parse(reportFor(writtenAttempt, writing, { refId: null }), writtenAttempt, writing), /absent from the learner evidence/);
  await assert.rejects(parse(reportFor(writtenAttempt, writing, { refId: 'learner-1' }), writtenAttempt, writing), /absent from the learner evidence/);
});

test('known model, partner, warm-up and control text cannot be cited as either rating evidence or correction originals', async () => {
  const def = definition(); const attempt = await knownAttempt(def);
  for (const excludedId of ['warmup', 'model', 'control', 'partner-1', 'partner-2', 'blank']) {
    const excluded = attempt.submission.turns.find(item => item.id === excludedId);
    const quote = excluded.text.trim() || 'unobserved';
    for (const refId of [excludedId, 'learner-1', null]) {
      await assert.rejects(parse(reportFor(attempt, def, { refId, quote }), attempt, def), /absent from the learner evidence/);
      const corrected = reportFor(attempt, def, { scores: Array(5).fill(null) });
      corrected.result.corrections = [correction(refId, quote)];
      await assert.rejects(parse(corrected, attempt, def), /absent from the learner evidence/);
    }
  }
  const hiddenQuote = reportFor(attempt, def, { scores: Array(5).fill(null) });
  hiddenQuote.result.ratings[0].evidence = [{ refId: 'model', quote: 'MODEL ONLY' }];
  await assert.rejects(parse(hiddenQuote, attempt, def), /absent from the learner evidence/);
});

test('valid corrections remain grounded in the known learner unit rather than in the corrected sentence', async () => {
  const def = definition(); const attempt = await knownAttempt(def); const report = reportFor(attempt, def);
  report.result.corrections = [correction()];
  const { evaluation } = await parse(report, attempt, def);
  assert.deepEqual(evaluation.result.raw.corrections, [correction()]);
  report.result.corrections[0].original = 'einen Tee';
  await assert.rejects(parse(report, attempt, def), /absent from the learner evidence/);
});

test('Unicode NFC and whitespace-equivalent quotes match known evidence without changing raw text or identity', async () => {
  const def = definition('writing');
  const submission = { ...written(), text: 'Hallo Mia! Im Cafe\u0301\t am\nPark gibt es große Tassen. Grüße ☕️ 👩🏽‍💻!' };
  const attempt = await knownAttempt(def, { submission });
  const report = reportFor(attempt, def, { quote: 'Café am Park' });
  report.result.strengths = ['Grüße und Café ☕️ bleiben erhalten.'];
  const { evaluation } = await parse(report, attempt, def);
  assert.deepEqual(evaluation.result.raw, report.result);
  assert.equal(evaluation.id, `gemini:${await hashJSON(report)}`);
  assert.equal(attempt.submission.text, submission.text);
  assert.ok(buildAssessmentReportRequest(attempt, def).includes(JSON.stringify(submission.text)));
  for (const quote of ['café am Park', 'Cafe am Park', 'Café am Bahnhof']) {
    await assert.rejects(parse(reportFor(attempt, def, { quote }), attempt, def), /absent from the learner evidence/);
  }
  const decomposed = structuredClone(report);
  decomposed.result.ratings[0].evidence[0].quote = 'Cafe\u0301 am Park';
  const second = await parse(decomposed, attempt, def);
  assert.notEqual(second.evaluation.id, evaluation.id, 'Hashing preserves raw report text, even when quotes are linguistically equivalent.');
});

test('nested result objects reject unknown fields and every required field must be present', async () => {
  const def = definition(); const attempt = await liveAttempt(def); const report = reportFor(attempt, def);
  report.result.corrections = [correction(null)];
  const targets = [
    [value => value.result, ['ratings', 'strengths', 'corrections', 'retryDe', 'retryEn']],
    [value => value.result.ratings[0], ['id', 'score', 'reasonEn', 'evidence']],
    [value => value.result.ratings[0].evidence[0], ['refId', 'quote']],
    [value => value.result.corrections[0], ['refId', 'original', 'corrected', 'explanationDe', 'explanationEn']],
  ];
  for (const [target, required] of targets) {
    const extra = structuredClone(report); target(extra).extra = 'not allowed';
    await assert.rejects(parse(extra, attempt, def), /Unexpected assessment fields/);
    for (const key of required) {
      const missing = structuredClone(report); delete target(missing)[key];
      await assert.rejects(parse(missing, attempt, def), Error, `Missing ${key}`);
    }
  }
});

test('feedback, evidence and correction shapes obey the shared bounded RawRubricResult contract', async () => {
  const def = definition(); const attempt = await liveAttempt(def); const report = reportFor(attempt, def);
  report.result.corrections = [correction(null)];
  const mutations = [
    value => { value.result = null; },
    value => { value.result.ratings = null; },
    value => { value.result.ratings[0] = null; },
    value => { value.result.ratings[0].reasonEn = ' '; },
    value => { value.result.ratings[0].reasonEn = 'a'.repeat(601); },
    value => { value.result.ratings[0].evidence = {}; },
    value => { value.result.ratings[0].evidence = Array(3).fill({ refId: null, quote: 'yes' }); },
    value => { value.result.ratings[0].evidence[0] = null; },
    value => { value.result.ratings[0].evidence[0].quote = '\n '; },
    value => { value.result.ratings[0].evidence[0].quote = 'a'.repeat(501); },
    value => { value.result.ratings[0].evidence[0].refId = 'bad id'; },
    value => { value.result.ratings[0].evidence[0].refId = '__proto__'; },
    value => { value.result.ratings[0].evidence[0].refId = 1; },
    value => { value.result.strengths = ['a', 'b', 'c']; },
    value => { value.result.strengths = [{ text: 'not a string' }]; },
    value => { value.result.strengths = [' ']; },
    value => { value.result.strengths = ['a'.repeat(501)]; },
    value => { value.result.corrections = [correction(null), correction(null), correction(null)]; },
    value => { value.result.corrections = {}; },
    value => { value.result.corrections[0].original = ''; },
    value => { value.result.corrections[0].corrected = ''; },
    value => { value.result.corrections[0].corrected = 'a'.repeat(501); },
    value => { value.result.corrections[0].explanationDe = ' '; },
    value => { value.result.corrections[0].explanationEn = 'a'.repeat(601); },
    value => { value.result.retryDe = ''; },
    value => { value.result.retryEn = 'a'.repeat(801); },
  ];
  for (const mutate of mutations) {
    const bad = structuredClone(report); mutate(bad);
    await assert.rejects(parse(bad, attempt, def), Error);
  }
});

test('claimed totals are validated but ignored in scoring, evaluation content and report identity', async () => {
  const def = definition(); const attempt = await liveAttempt(def); const report = reportFor(attempt, def);
  const expected = await parse(report, attempt, def);
  for (const reportedPercent of [0, 42.25, 50, 100]) {
    assert.deepEqual(await parse({ ...report, reportedPercent }, attempt, def), expected);
  }
  for (const reportedPercent of [-0.1, 100.1, '50', null, true, {}, []]) {
    await assert.rejects(parse({ ...report, reportedPercent }, attempt, def), /reportedPercent must be a number from 0 to 100/);
  }
  await assert.rejects(parseGeminiAssessmentReport(`{"reportedPercent":1e309,${JSON.stringify(report).slice(1)}`, attempt, def), /reportedPercent/);
});

test('optional delivery and assistance notes are bounded strings included in normalized report identity', async () => {
  const def = definition(); const attempt = await liveAttempt(def); const report = reportFor(attempt, def);
  const baseline = await parse(report, attempt, def);
  for (const key of ['deliveryNote', 'assistanceNote']) {
    for (const value of ['', 'Claim: the question was repeated.', 'ö'.repeat(1000)]) {
      const withNote = { ...report, [key]: value };
      const { candidate, evaluation } = await parse({ ...withNote, reportedPercent: 100 }, attempt, def);
      assert.equal(candidate.submission.reportHash, await hashJSON(withNote));
      assert.notEqual(evaluation.id, baseline.evaluation.id);
      assert.deepEqual(evaluation.result, baseline.evaluation.result);
    }
    for (const value of [null, 1, true, {}, [], 'a'.repeat(1001)]) {
      await assert.rejects(parse({ ...report, [key]: value }, attempt, def), new RegExp(`${key} must be a string`));
    }
  }
});

test('report hashes include the full identity as well as ratings and feedback', async () => {
  const def = definition('writing'); const first = await knownAttempt(def, { attemptId: 'first-attempt' });
  const second = await knownAttempt(def, { attemptId: 'second-attempt' });
  assert.equal(first.submissionHash, second.submissionHash, 'Same artifact and mode deliberately share a submission digest.');
  const report = reportFor(first, def);
  const firstResult = await parse(report, first, def);
  const secondReport = reportFor(second, def);
  assert.deepEqual(report.result, secondReport.result);
  assert.notEqual((await parse(secondReport, second, def)).evaluation.id, firstResult.evaluation.id);
  for (const mutate of [
    value => { value.result.ratings[0].score = 1; },
    value => { value.result.ratings[0].reasonEn = 'A changed explanation.'; },
    value => { value.result.strengths = ['The greeting addresses Mia.']; },
    value => { value.result.retryEn = 'Try a new invitation.'; },
  ]) {
    const changed = structuredClone(report); mutate(changed);
    const result = await parse(changed, first, def);
    assert.equal(result.candidate, null);
    assert.notEqual(result.evaluation.id, firstResult.evaluation.id);
    assert.equal(result.evaluation.id, `gemini:${await hashJSON(changed)}`);
  }
});

test('duplicate external parsing keeps hashes and candidate stable while using the supplied receipt time', async () => {
  const def = definition(); const attempt = await liveAttempt(def); const report = reportFor(attempt, def);
  report.deliveryNote = 'Claim: Live segment ended.';
  const first = await parse(report, attempt, def, 100);
  const sealed = sealAssessmentSubmission(attempt, first.candidate, 100);
  const duplicate = await parseGeminiAssessmentReport(fenced(JSON.stringify(reverseKeys({ ...report, reportedPercent: 99 }), null, 2)), sealed, def, { now: 200 });
  assert.deepEqual(duplicate.candidate, first.candidate);
  assert.deepEqual({ ...duplicate.evaluation, createdAt: 100 }, first.evaluation);
  assert.equal(duplicate.evaluation.createdAt, 200);
  assert.equal(sealAssessmentSubmission(sealed, duplicate.candidate, 200), sealed);
  validateAssessmentEvaluation(duplicate.evaluation, sealed, def);
  assert.match(buildAssessmentGeminiPack(sealed, def), /GRADE THE COMPLETED EXTERNAL LIVE SEGMENT/);
  assert.doesNotMatch(buildAssessmentGeminiPack(sealed, def), /CONDUCT THE FICTIONAL ROLEPLAY/);
});

test('an already submitted external report cannot be replaced, even when only feedback or a claim note changes', async () => {
  const def = definition(); const attempt = await liveAttempt(def); const report = reportFor(attempt, def);
  const first = await parse(report, attempt, def); const sealed = sealAssessmentSubmission(attempt, first.candidate, 100);
  for (const mutate of [
    value => { value.result.ratings[0].score = 1; },
    value => { value.result.retryEn = 'Changed retry.'; },
    value => { value.assistanceNote = 'Different claim.'; },
  ]) {
    const changed = structuredClone(report); mutate(changed);
    await assert.rejects(parse(changed, sealed, def), /already submitted with a different report/);
  }
  const wrongContext = structuredClone(sealed); wrongContext.submission.exportContextHash = 'a'.repeat(64);
  await assert.rejects(parse(report, wrongContext, def), /different context/);
  const extraSubmission = structuredClone(sealed); extraSubmission.submission.extra = 'sealed field';
  extraSubmission.submissionHash = await submissionDigest(extraSubmission.definitionHash, extraSubmission.mode, extraSubmission.submission);
  await assert.rejects(parse(report, extraSubmission, def), /Submitted external reports cannot be replaced/);
});

test('receipt times accept zero and the default clock but reject malformed timestamps', async () => {
  const def = definition(); const attempt = await liveAttempt(def); const report = reportFor(attempt, def);
  assert.equal((await parse(report, attempt, def, 0)).evaluation.createdAt, 0);
  const before = Date.now();
  const { evaluation } = await parseGeminiAssessmentReport(JSON.stringify(report), attempt, def);
  assert.ok(evaluation.createdAt >= before && evaluation.createdAt <= Date.now());
  for (const now of [-1, Infinity, NaN, '100', null, 8.64e15 + 1]) await assert.rejects(parse(report, attempt, def, now), /Invalid report receipt time/);
});

test('builders and parser are pure with frozen inputs and never call the network', async t => {
  const network = t.mock.method(globalThis, 'fetch', () => { assert.fail('The pure Gemini protocol must not make live requests.'); });
  for (const known of [false, true]) {
    const def = freeze(structuredClone(definition()));
    const attempt = freeze(known ? await knownAttempt(def) : await liveAttempt(def));
    const report = freeze(reportFor(attempt, def));
    const before = JSON.stringify({ def, attempt, report });
    assert.equal(buildAssessmentGeminiPack(attempt, def), buildAssessmentGeminiPack(attempt, def));
    assert.equal(buildAssessmentReportRequest(attempt, def), buildAssessmentReportRequest(attempt, def));
    assert.deepEqual(await parse(report, attempt, def), await parse(report, attempt, def));
    assert.equal(JSON.stringify({ def, attempt, report }), before);
  }
  assert.equal(network.mock.callCount(), 0);
});

test('async parsing snapshots the draft revision and definition before hashing yields', async () => {
  const def = structuredClone(definition()); const attempt = await liveAttempt(def); const report = reportFor(attempt, def);
  const pending = parse(report, attempt, def);
  attempt.draftRevision += 1;
  def.title = 'Concurrent caller edit';
  const result = await pending;
  assert.equal(result.candidate.draftRevision, 0);
  assert.equal(result.evaluation.id, `gemini:${await hashJSON(report)}`);
  assert.throws(() => sealAssessmentSubmission(attempt, result.candidate), /draft changed/);
});
