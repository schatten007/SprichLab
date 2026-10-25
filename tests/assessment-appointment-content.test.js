import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateAssessmentPack } from '../shared/assessment-contracts.js';
import { scoreObjective } from '../shared/assessment-scoring.js';

const packs = {};
for (const form of ['a', 'b']) {
  packs[form] = JSON.parse(await readFile(new URL(`../app/public/assessments/pilot-appointment-${form}-v1.json`, import.meta.url), 'utf8'));
}
const definition = (form, kind) => packs[form].definitions.find(def => def.kind === kind);
const grade = (form, answers) => scoreObjective(definition(form, 'objective'), { kind: 'objective', answers, events: [] });
const earnedFor = (result, id) => result.items.find(item => item.itemId === id).earned;

// Hand-authored learner responses and expected grades are independent of the pack's answer keys.
const answers = {
  a: {
    'appointment.a.vocab.termin': 'appointment',
    'appointment.a.vocab.change': 'cancel',
    'appointment.a.vocab.time': 'später',
    'appointment.a.vocab.repeat': 'noch einmal',
    'appointment.a.vocab.confirm': 'confirm',
    'appointment.a.grammar.prepositions': { day: 'am', time: 'um' },
    'appointment.a.grammar.modal': 'Können',
    'appointment.a.grammar.order': ['can', 'you', 'please', 'tomorrow', 'come'],
    'appointment.a.grammar.sie': 'formal',
    'appointment.a.reading.original': 'tuesday-10',
    'appointment.a.reading.unavailable': 'thursday-09',
    'appointment.a.reading.final': { day: 'Freitag', time: '08:00' },
    'appointment.a.reading.correction': 'correct-final',
    'appointment.a.writing.decline': 'Am Donnerstag kann ich leider nicht kommen.',
    'appointment.a.writing.confirm': 'Ich bestätige den Termin am Freitag um 8 Uhr.',
  },
  b: {
    'appointment.b.vocab.termin': 'appointment',
    'appointment.b.vocab.change': 'postpone',
    'appointment.b.vocab.time': 'früher',
    'appointment.b.vocab.repeat': 'noch einmal',
    'appointment.b.vocab.confirm': 'confirm',
    'appointment.b.grammar.prepositions': { day: 'am', time: 'um' },
    'appointment.b.grammar.modal': 'möchte',
    'appointment.b.grammar.order': ['can', 'you', 'please', 'monday', 'call'],
    'appointment.b.grammar.sie': 'formal',
    'appointment.b.reading.original': 'friday-10',
    'appointment.b.reading.unavailable': 'tuesday-08',
    'appointment.b.reading.final': { day: 'Donnerstag', time: '09:00' },
    'appointment.b.reading.correction': 'correct-final',
    'appointment.b.writing.decline': 'Am Dienstag kann ich nicht kommen.',
    'appointment.b.writing.confirm': 'Ich bestätige den Termin am Donnerstag um 9 Uhr.',
  },
};

const alternatives = {
  a: {
    'appointment.a.vocab.termin': 'appointment',
    'appointment.a.vocab.change': 'cancel',
    'appointment.a.vocab.time': '  SPA\u0308TER!  ',
    'appointment.a.vocab.repeat': 'noch mal',
    'appointment.a.vocab.confirm': 'confirm',
    'appointment.a.grammar.prepositions': { day: 'am', time: 'um' },
    'appointment.a.grammar.modal': 'ko\u0308nnen',
    'appointment.a.grammar.order': ['can', 'you', 'tomorrow', 'please', 'come'],
    'appointment.a.grammar.sie': 'formal',
    'appointment.a.reading.original': 'tuesday-10',
    'appointment.a.reading.unavailable': 'thursday-09',
    'appointment.a.reading.final': { day: 'am Freitag', time: 'um acht Uhr' },
    'appointment.a.reading.correction': 'correct-final',
    'appointment.a.writing.decline': '  Am Donnerstag  habe ich leider keine Zeit! ',
    'appointment.a.writing.confirm': 'Der neue Termin ist am Freitag um acht Uhr',
  },
  b: {
    'appointment.b.vocab.termin': 'appointment',
    'appointment.b.vocab.change': 'postpone',
    'appointment.b.vocab.time': ' FRU\u0308HER. ',
    'appointment.b.vocab.repeat': 'nochmals',
    'appointment.b.vocab.confirm': 'confirm',
    'appointment.b.grammar.prepositions': { day: 'Am', time: ' UM. ' },
    'appointment.b.grammar.modal': 'mo\u0308chte',
    'appointment.b.grammar.order': ['can', 'you', 'monday', 'please', 'call'],
    'appointment.b.grammar.sie': 'formal',
    'appointment.b.reading.original': 'friday-10',
    'appointment.b.reading.unavailable': 'tuesday-08',
    'appointment.b.reading.final': { day: 'am Donnerstag', time: 'um neun Uhr.' },
    'appointment.b.reading.correction': 'correct-final',
    'appointment.b.writing.decline': 'Am Dienstag habe ich keine Zeit.',
    'appointment.b.writing.confirm': 'Der neue Termin ist am Donnerstag um neun Uhr.',
  },
};

const mixedAnswers = {
  a: {
    ...answers.a,
    'appointment.a.vocab.time': 'spater',
    'appointment.a.grammar.prepositions': { day: 'am', time: 'am' },
    'appointment.a.grammar.order': ['can', 'you', 'please', 'come', 'tomorrow'],
    'appointment.a.reading.final': { day: 'Freitag', time: '9 Uhr' },
    'appointment.a.writing.decline': 'Am Donnerstag kann ich kommen.',
  },
  b: {
    ...answers.b,
    'appointment.b.vocab.time': 'fruher',
    'appointment.b.grammar.prepositions': { day: 'um', time: 'um' },
    'appointment.b.grammar.order': ['can', 'you', 'call', 'please', 'monday'],
    'appointment.b.reading.final': { day: 'Donnerstag', time: '8 Uhr' },
    'appointment.b.writing.decline': 'Am Dienstag habe ich Zeit.',
  },
};

const incorrectBookings = {
  a: [
    { day: 'Dienstag', time: '10:00', confirmation: 'Ich bestätige den Termin am Dienstag um 10 Uhr.' },
    { day: 'Donnerstag', time: '09:00', confirmation: 'Ich bestätige den Termin am Donnerstag um 9 Uhr.' },
    { day: 'nicht Freitag', time: 'nicht 8 Uhr', confirmation: 'Ich bestätige den Termin am Freitag um 8 Uhr nicht.' },
    { day: 'Freitag oder Donnerstag', time: '8 Uhr oder 9 Uhr', confirmation: 'Der neue Termin ist am Freitag um 8 Uhr. Nein, am Donnerstag um 9 Uhr.' },
  ],
  b: [
    { day: 'Freitag', time: '10:00', confirmation: 'Ich bestätige den Termin am Freitag um 10 Uhr.' },
    { day: 'Dienstag', time: '08:00', confirmation: 'Ich bestätige den Termin am Dienstag um 8 Uhr.' },
    { day: 'nicht Donnerstag', time: 'nicht 9 Uhr', confirmation: 'Ich bestätige den Termin am Donnerstag um 9 Uhr nicht.' },
    { day: 'Donnerstag oder Dienstag', time: '9 Uhr oder 8 Uhr', confirmation: 'Der neue Termin ist am Donnerstag um 9 Uhr. Nein, am Dienstag um 8 Uhr.' },
  ],
};

const confusedReadings = {
  a: {
    'appointment.a.reading.original': 'friday-08',
    'appointment.a.reading.unavailable': 'tuesday-10',
    'appointment.a.reading.correction': 'accept-unavailable',
  },
  b: {
    'appointment.b.reading.original': 'thursday-09',
    'appointment.b.reading.unavailable': 'friday-10',
    'appointment.b.reading.correction': 'accept-unavailable',
  },
};

const spellingErrors = {
  a: {
    'appointment.a.vocab.time': 'spater',
    'appointment.a.grammar.modal': 'Konnen',
    'appointment.a.writing.decline': 'Am donnerstag habe ich keine zeit.',
    'appointment.a.writing.confirm': 'Ich bestatige den Termin am Freitag um 8 Uhr.',
  },
  b: {
    'appointment.b.vocab.time': 'fruher',
    'appointment.b.grammar.modal': 'mochte',
    'appointment.b.writing.decline': 'Am dienstag habe ich keine zeit.',
    'appointment.b.writing.confirm': 'Ich bestatige den Termin am Donnerstag um 9 Uhr.',
  },
};

const facts = {
  a: {
    english: ['Tuesday at 10:00', 'Thursday at 09:00', 'Friday at 08:00'],
    messageDe: ['Dienstag um 10 Uhr', 'Donnerstag um 9 Uhr', 'Freitag um 8 Uhr'],
    calendarDe: ['Dienstag, 10:00 Uhr: abgesagt.', 'Donnerstag, 09:00 Uhr: nur angeboten; Sie haben keine Zeit.', 'Freitag, 08:00 Uhr: für Sie bestätigt.'],
    calendarEn: ['Tuesday, 10:00: cancelled.', 'Thursday, 09:00: only offered; you are unavailable.', 'Friday, 08:00: confirmed for you.'],
    unavailable: 'Thursday at 09:00',
    final: 'Friday at 08:00',
    finalDay: 'Freitag',
  },
  b: {
    english: ['Friday at 10:00', 'Tuesday at 08:00', 'Thursday at 09:00'],
    messageDe: ['Freitag um 10 Uhr', 'Dienstag um 8 Uhr', 'Donnerstag um 9 Uhr'],
    calendarDe: ['Freitag, 10:00 Uhr: gestrichen; der alte Termin gilt nicht mehr.', 'Dienstag, 08:00 Uhr: angeboten, aber wegen Ihres Kurses nicht möglich.', 'Donnerstag, 09:00 Uhr: verbindlich für Sie gebucht.'],
    calendarEn: ['Friday, 10:00: removed; the old appointment is no longer valid.', 'Tuesday, 08:00: offered, but not possible because of your class.', 'Thursday, 09:00: firmly booked for you.'],
    unavailable: 'Tuesday at 08:00',
    final: 'Thursday at 09:00',
    finalDay: 'Donnerstag',
  },
};

const unanswered = form => Object.fromEntries(Object.keys(answers[form]).map(id => [id, null]));
function assertGrade(result, earned, percentage) {
  assert.deepEqual(
    { type: result.type, status: result.status, earned: result.earned, maximum: result.maximum, percentage: result.percentage },
    { type: 'keyed', status: 'graded', earned, maximum: 20, percentage },
  );
  assert.equal(result.items.length, 15);
}

for (const form of ['a', 'b']) {
  test(`appointment ${form}: the pack validates and has the required definitions and 5/4/4/2 domains`, () => {
    const pack = packs[form];
    assert.equal(validateAssessmentPack(pack, { id: `pilot-appointment-${form}`, version: '1' }), pack);
    assert.equal(pack.schemaVersion, 1);
    assert.deepEqual(pack.definitions.map(def => def.kind), ['objective', 'writing', 'roleplay']);
    for (const def of pack.definitions) {
      assert.equal(def.schemaVersion, 1);
      assert.equal(def.id, `pilot.appointment.${form}.${def.kind}`);
      assert.equal(def.version, '1');
      assert.equal(def.level, 'A2');
      assert.equal(def.familyId, 'appointment');
      assert.equal(def.formId, form);
      assert.deepEqual(def.lessonIds, ['starter-meeting-time', 'starter-change-time', 'starter-repeat']);
      assert.ok(def.skillIds.length > 0);
      assert.deepEqual(def.exposureGroupIds, [`pilot.appointment.${form}`]);
    }
    const objective = definition(form, 'objective');
    const counts = {};
    for (const item of objective.items) {
      counts[item.domain] = (counts[item.domain] ?? 0) + 1;
      assert.ok(item.skillIds.length > 0 && item.skillIds.every(id => objective.skillIds.includes(id)));
      assert.ok(item.feedback.de.trim() && item.feedback.en.trim());
    }
    assert.equal(objective.items.length, 15);
    assert.deepEqual(counts, { vocabulary: 5, grammar: 4, reading: 4, writing: 2 });
    assert.deepEqual([...new Set(objective.items.map(item => item.type))].sort(), ['choice', 'order', 'slots', 'text']);

    const writing = definition(form, 'writing');
    assert.equal(writing.rubricId, 'writing:1');
    assert.deepEqual(writing.task.words, [40, 80]);
    assert.equal(writing.task.goals.length, 3);
    assert.ok(writing.task.goals.every(goal => typeof goal === 'string' && goal.trim()));
    const roleplay = definition(form, 'roleplay');
    assert.equal(roleplay.rubricId, 'conversation:1');
    assert.equal(roleplay.scenario.variantId, form);
    assert.equal(roleplay.scenario.register, 'Sie');
    assert.deepEqual(roleplay.scenario.goals.map(goal => goal.id), ['repeat-options', 'reject-unavailable', 'propose-suitable', 'confirm-final']);
    for (const def of [writing, roleplay]) {
      assert.deepEqual(def.stimuli, []);
      assert.deepEqual(def.items, []);
    }
  });

  test(`appointment ${form}: two original German texts carry feedback translations outside item prompts`, () => {
    const objective = definition(form, 'objective');
    assert.equal(objective.stimuli.length, 2);
    const prompts = [objective.instructions, ...objective.items.flatMap(item => [item.promptDe, item.promptEn])];
    const reading = objective.items.filter(item => item.domain === 'reading');
    for (const stimulus of objective.stimuli) {
      assert.ok(stimulus.de.trim() && stimulus.en.trim());
      assert.notEqual(stimulus.de, stimulus.en);
      assert.equal(reading.filter(item => item.stimulusIds.includes(stimulus.id)).length, 2);
      assert.ok(prompts.every(prompt => !prompt.includes(stimulus.en)), 'Full feedback translations must not be embedded in prompts.');
    }
    const message = objective.stimuli.find(stimulus => stimulus.id === `appointment.${form}.message`);
    const calendar = objective.stimuli.find(stimulus => stimulus.id === `appointment.${form}.calendar`);
    for (const fact of facts[form].messageDe) assert.ok(message.de.includes(fact), fact);
    for (const fact of facts[form].calendarDe) assert.ok(calendar.de.includes(fact), fact);
    for (const fact of facts[form].calendarEn) assert.ok(calendar.en.includes(fact), fact);
    const writing = definition(form, 'writing');
    const scenario = definition(form, 'roleplay').scenario;
    for (const text of [message.en, writing.task.prompt, scenario.learnerTask, scenario.partnerInstructions, scenario.openingEn, scenario.preparation]) {
      for (const fact of facts[form].english) assert.ok(text.includes(fact), fact);
    }
    const rejection = scenario.goals.find(goal => goal.id === 'reject-unavailable').text;
    assert.match(rejection, /cannot attend/);
    assert.ok(rejection.includes(facts[form].unavailable));
    for (const id of ['propose-suitable', 'confirm-final']) {
      assert.ok(scenario.goals.find(goal => goal.id === id).text.includes(facts[form].final));
    }
  });

  test(`appointment ${form}: independently authored correct answers earn 20/20 and 100 percent`, () => {
    const result = grade(form, answers[form]);
    assertGrade(result, 20, 100);
    const totals = {};
    for (const item of result.items) totals[item.domain] = (totals[item.domain] ?? 0) + item.earned;
    assert.deepEqual(totals, { vocabulary: 5, grammar: 6, reading: 5, writing: 4 });
  });

  test(`appointment ${form}: alternate German phrases, word orders, number words and Unicode earn full credit`, () => {
    assertGrade(grade(form, alternatives[form]), 20, 100);
  });

  test(`appointment ${form}: mixed answers earn 13/20 with independent credit for day and time slots`, () => {
    const result = grade(form, mixedAnswers[form]);
    assertGrade(result, 13, 65);
    assert.equal(earnedFor(result, `appointment.${form}.vocab.time`), 0);
    assert.equal(earnedFor(result, `appointment.${form}.grammar.prepositions`), 1);
    assert.equal(earnedFor(result, `appointment.${form}.grammar.order`), 0);
    assert.equal(earnedFor(result, `appointment.${form}.reading.final`), 1);
    assert.equal(earnedFor(result, `appointment.${form}.writing.decline`), 0);
  });

  test(`appointment ${form}: cancelled, unavailable, negated and contradictory bookings earn no confirmation credit`, () => {
    for (const { day, time, confirmation } of incorrectBookings[form]) {
      const result = grade(form, {
        ...answers[form],
        [`appointment.${form}.reading.final`]: { day, time },
        [`appointment.${form}.writing.confirm`]: confirmation,
      });
      assertGrade(result, 16, 80);
      assert.equal(earnedFor(result, `appointment.${form}.reading.final`), 0, `${day} ${time}`);
      assert.equal(earnedFor(result, `appointment.${form}.writing.confirm`), 0, confirmation);
    }
  });

  test(`appointment ${form}: confusing the original, rejected and confirmed slots loses all three choice points`, () => {
    const result = grade(form, { ...answers[form], ...confusedReadings[form] });
    assertGrade(result, 17, 85);
    for (const id of Object.keys(confusedReadings[form])) assert.equal(earnedFor(result, id), 0);
  });

  test(`appointment ${form}: umlauts and German noun capitalization remain significant`, () => {
    const result = grade(form, { ...answers[form], ...spellingErrors[form] });
    assertGrade(result, 14, 70);
    for (const id of Object.keys(spellingErrors[form])) assert.equal(earnedFor(result, id), 0);
  });

  test(`appointment ${form}: unanswered items and empty slots earn zero rather than guessing a default`, () => {
    assertGrade(grade(form, unanswered(form)), 0, 0);
    assertGrade(grade(form, {
      ...unanswered(form),
      [`appointment.${form}.grammar.prepositions`]: {},
      [`appointment.${form}.reading.final`]: { day: null, time: '' },
      [`appointment.${form}.grammar.order`]: [],
      [`appointment.${form}.writing.confirm`]: '',
    }), 0, 0);
    assert.throws(() => grade(form, {}), /Submit each item/);
  });

  test(`appointment ${form}: a missing or explicitly unanswered slot preserves only the completed part's point`, () => {
    const result = grade(form, {
      ...unanswered(form),
      [`appointment.${form}.grammar.prepositions`]: { day: 'am' },
      [`appointment.${form}.reading.final`]: { day: facts[form].finalDay, time: null },
    });
    assertGrade(result, 2, 10);
    assert.equal(earnedFor(result, `appointment.${form}.grammar.prepositions`), 1);
    assert.equal(earnedFor(result, `appointment.${form}.reading.final`), 1);
  });
}

test('appointment forms have distinct definitions, items, reading passages and exposure groups', () => {
  const definitions = [...packs.a.definitions, ...packs.b.definitions];
  assert.equal(new Set(definitions.map(def => def.id)).size, 6);
  assert.equal(new Set(definitions.flatMap(def => def.items.map(item => item.id))).size, 30);
  assert.equal(new Set(definitions.flatMap(def => def.stimuli.map(stimulus => stimulus.de))).size, 4);
  const aGroups = new Set(packs.a.definitions.flatMap(def => def.exposureGroupIds));
  assert.ok(packs.b.definitions.every(def => def.exposureGroupIds.every(id => !aGroups.has(id))));
});
