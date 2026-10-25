import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateAssessmentPack } from '../shared/assessment-contracts.js';
import { scoreObjective } from '../shared/assessment-scoring.js';

const packs = {};
for (const form of ['a', 'b']) {
  packs[form] = JSON.parse(await readFile(new URL(`../app/public/assessments/pilot-cafe-${form}-v1.json`, import.meta.url), 'utf8'));
}
const definition = (form, kind) => packs[form].definitions.find(def => def.kind === kind);
const grade = (form, answers) => scoreObjective(definition(form, 'objective'), { kind: 'objective', answers, events: [] });
const earnedFor = (result, id) => result.items.find(item => item.itemId === id).earned;

// Learner responses and expected scores are authored independently of the JSON answer keys.
// Never construct a submission from item.answer, accepted, options, or orders.
const correctAnswers = {
  a: {
    'cafe.a.vocab.tea': 'tea',
    'cafe.a.vocab.size': 'klein',
    'cafe.a.vocab.cash': 'cash',
    'cafe.a.vocab.number': 'zwei',
    'cafe.a.vocab.thanks': 'thanks',
    'cafe.a.grammar.article': 'einen',
    'cafe.a.grammar.prepositions': { day: 'am', time: 'um' },
    'cafe.a.grammar.modal': 'möchte',
    'cafe.a.grammar.order': ['can', 'i', 'please', 'card', 'pay'],
    'cafe.a.reading.price': '2 Euro',
    'cafe.a.reading.payment': 'cash-card',
    'cafe.a.reading.hours': { open: '08:00', close: '16:00' },
    'cafe.a.reading.cake': 'ten',
    'cafe.a.writing.order': 'Ich möchte einen kleinen Tee, bitte.',
    'cafe.a.writing.payment': 'Ich bezahle bar.',
  },
  b: {
    'cafe.b.vocab.coffee': 'coffee',
    'cafe.b.vocab.size': 'groß',
    'cafe.b.vocab.card': 'card',
    'cafe.b.vocab.number': 'drei',
    'cafe.b.vocab.goodbye': 'goodbye',
    'cafe.b.grammar.article': 'ein',
    'cafe.b.grammar.prepositions': { day: 'am', time: 'um' },
    'cafe.b.grammar.modal': 'möchten',
    'cafe.b.grammar.order': ['can', 'i', 'please', 'here', 'order'],
    'cafe.b.reading.order': { size: 'groß', price: '3 Euro' },
    'cafe.b.reading.cash': 'card-only',
    'cafe.b.reading.visit': 'closed',
    'cafe.b.reading.place': 'window',
    'cafe.b.writing.order': 'Ich möchte einen großen Kaffee, bitte.',
    'cafe.b.writing.payment': 'Ich bezahle mit Karte.',
  },
};

const alternativeAnswers = {
  a: {
    ...correctAnswers.a,
    'cafe.a.vocab.size': ' KLEIN! ',
    'cafe.a.vocab.number': ' ZWEI. ',
    'cafe.a.grammar.prepositions': { day: ' AM ', time: 'UM.' },
    'cafe.a.grammar.modal': 'mo\u0308chte',
    'cafe.a.grammar.order': ['can', 'i', 'card', 'please', 'pay'],
    'cafe.a.reading.price': '2,00 €.',
    'cafe.a.reading.hours': { open: 'um acht Uhr', close: 'um sechzehn Uhr.' },
    'cafe.a.writing.order': ' \nEinen  kleinen Tee! ',
    'cafe.a.writing.payment': 'Bar, bitte',
  },
  b: {
    ...correctAnswers.b,
    'cafe.b.vocab.size': ' GROẞ! ',
    'cafe.b.vocab.number': ' DREI. ',
    'cafe.b.grammar.prepositions': { day: 'Am', time: ' UM. ' },
    'cafe.b.grammar.modal': ' MO\u0308CHTEN ',
    'cafe.b.grammar.order': ['can', 'i', 'here', 'please', 'order'],
    'cafe.b.reading.order': { size: 'GROẞ', price: 'drei Euro.' },
    'cafe.b.writing.order': ' Einen  großen Kaffee ',
    'cafe.b.writing.payment': 'Mit Karte, bitte!',
  },
};

const wrongAnswers = {
  a: {
    'cafe.a.vocab.tea': 'coffee',
    'cafe.a.vocab.size': 'groß',
    'cafe.a.vocab.cash': 'card',
    'cafe.a.vocab.number': 'drei',
    'cafe.a.vocab.thanks': 'price',
    'cafe.a.grammar.article': 'ein',
    'cafe.a.grammar.prepositions': { day: 'um', time: 'am' },
    'cafe.a.grammar.modal': 'möchten',
    'cafe.a.grammar.order': ['can', 'i', 'pay', 'please', 'card'],
    'cafe.a.reading.price': '3 Euro',
    'cafe.a.reading.payment': 'card-only',
    'cafe.a.reading.hours': { open: '09:00', close: '17:00' },
    'cafe.a.reading.cake': 'eight',
    'cafe.a.writing.order': 'Einen großen Kaffee, bitte.',
    'cafe.a.writing.payment': 'Mit Karte, bitte.',
  },
  b: {
    'cafe.b.vocab.coffee': 'tea',
    'cafe.b.vocab.size': 'klein',
    'cafe.b.vocab.card': 'cash',
    'cafe.b.vocab.number': 'zwei',
    'cafe.b.vocab.goodbye': 'greeting',
    'cafe.b.grammar.article': 'einen',
    'cafe.b.grammar.prepositions': { day: 'um', time: 'am' },
    'cafe.b.grammar.modal': 'möchte',
    'cafe.b.grammar.order': ['can', 'i', 'order', 'please', 'here'],
    'cafe.b.reading.order': { size: 'klein', price: '2 Euro' },
    'cafe.b.reading.cash': 'cash-ok',
    'cafe.b.reading.visit': 'open',
    'cafe.b.reading.place': 'table',
    'cafe.b.writing.order': 'Einen kleinen Tee, bitte.',
    'cafe.b.writing.payment': 'Bar, bitte.',
  },
};

const mixedAnswers = {
  a: {
    ...correctAnswers.a,
    'cafe.a.vocab.size': 'groß',
    'cafe.a.grammar.prepositions': { day: 'am', time: 'am' },
    'cafe.a.grammar.order': ['can', 'i', 'pay', 'please', 'card'],
    'cafe.a.reading.hours': { open: '08:00', close: '17:00' },
    'cafe.a.writing.order': 'Einen kleine Tee, bitte.',
  },
  b: {
    ...correctAnswers.b,
    'cafe.b.vocab.size': 'klein',
    'cafe.b.grammar.prepositions': { day: 'um', time: 'um' },
    'cafe.b.grammar.order': ['can', 'i', 'order', 'please', 'here'],
    'cafe.b.reading.order': { size: 'groß', price: '2 Euro' },
    'cafe.b.writing.order': 'Einen große Kaffee, bitte.',
  },
};

const writingPhrases = {
  a: {
    order: ['Einen kleinen Tee', 'Ich möchte einen kleinen Tee'],
    payment: ['Bar', 'Ich zahle bar', 'Ich bezahle bar'],
  },
  b: {
    order: ['Einen großen Kaffee', 'Ich möchte einen großen Kaffee'],
    payment: ['Mit Karte', 'Ich zahle mit Karte', 'Ich bezahle mit Karte'],
  },
};

const partialSlots = {
  a: [
    ['cafe.a.grammar.prepositions', { day: 'am', time: 'am' }],
    ['cafe.a.grammar.prepositions', { day: 'um', time: 'um' }],
    ['cafe.a.grammar.prepositions', { day: 'am' }],
    ['cafe.a.grammar.prepositions', { day: null, time: 'um' }],
    ['cafe.a.reading.hours', { open: '08:00', close: '17:00' }],
    ['cafe.a.reading.hours', { open: '09:00', close: '16:00' }],
    ['cafe.a.reading.hours', { close: '16:00' }],
    ['cafe.a.reading.hours', { open: '08:00', close: null }],
  ],
  b: [
    ['cafe.b.grammar.prepositions', { day: 'am', time: 'am' }],
    ['cafe.b.grammar.prepositions', { day: 'um', time: 'um' }],
    ['cafe.b.grammar.prepositions', { time: 'um' }],
    ['cafe.b.grammar.prepositions', { day: 'am', time: null }],
    ['cafe.b.reading.order', { size: 'groß', price: '2 Euro' }],
    ['cafe.b.reading.order', { size: 'klein', price: '3 Euro' }],
    ['cafe.b.reading.order', { price: '3 Euro' }],
    ['cafe.b.reading.order', { size: 'groß', price: null }],
    ['cafe.b.reading.order', { size: 'groß', price: '3 oder 2 Euro' }],
  ],
};

const textCounterexamples = {
  a: [
    ['cafe.a.grammar.modal', 'mochte', 1],
    ['cafe.a.reading.price', 'nicht 2 Euro', 1],
    ['cafe.a.reading.price', '2 oder 3 Euro', 1],
    ['cafe.a.writing.order', 'Ein kleinen Tee, bitte.', 2],
    ['cafe.a.writing.order', 'Einen kleine Tee, bitte.', 2],
    ['cafe.a.writing.order', 'Einen großen Tee, bitte.', 2],
    ['cafe.a.writing.order', 'Einen kleinen Kaffee, bitte.', 2],
    ['cafe.a.writing.order', 'Ich mochte einen kleinen Tee.', 2],
    ['cafe.a.writing.order', 'Einen kleinen tee, bitte.', 2],
    ['cafe.a.writing.payment', 'Ich bezahle nicht bar.', 2],
    ['cafe.a.writing.payment', 'Bar, bitte. Nein, mit Karte.', 2],
  ],
  b: [
    ['cafe.b.vocab.size', 'gros', 1],
    ['cafe.b.grammar.modal', 'mochten', 1],
    ['cafe.b.writing.order', 'Ein großen Kaffee, bitte.', 2],
    ['cafe.b.writing.order', 'Einen große Kaffee, bitte.', 2],
    ['cafe.b.writing.order', 'Einen kleinen Kaffee, bitte.', 2],
    ['cafe.b.writing.order', 'Einen großen Tee, bitte.', 2],
    ['cafe.b.writing.order', 'Ich mochte einen großen Kaffee.', 2],
    ['cafe.b.writing.order', 'Einen großen kaffee, bitte.', 2],
    ['cafe.b.writing.payment', 'Mit karte.', 2],
    ['cafe.b.writing.payment', 'Ich bezahle nicht mit Karte.', 2],
    ['cafe.b.writing.payment', 'Mit Karte. Nein, bar.', 2],
  ],
};

const facts = {
  a: {
    passages: [
      { id: 'cafe.a.menu', de: ['Kleiner Tee: 2 Euro.', 'bar oder mit Karte'], en: ['Small tea: 2 euros.', 'cash or by card'] },
      { id: 'cafe.a.hours', de: ['Am Montag', '08:00 bis 16:00 Uhr', 'Am Sonntag ist es geschlossen.', 'ab 10:00 Uhr'], en: ['On Monday', '08:00 to 16:00', 'On Sunday it is closed.', 'cake is available from 10:00'] },
    ],
    roleplay: ['Café am Park', 'Monday', '08:00 to 16:00', 'small tea', '€2', 'cash or by card'],
    writing: ['Mia', 'Monday at 10:00', '08:00 to 16:00'],
    drink: 'small tea',
    readingSlots: 'cafe.a.reading.hours',
    emptySlots: { open: null, close: '' },
    incompleteOrder: ['can', 'i', 'please', 'pay'],
  },
  b: {
    passages: [
      { id: 'cafe.b.order', de: ['ein großer Kaffee.', 'Preis: 3 Euro.', 'nur mit Karte', 'kein Bargeld'], en: ['one large coffee.', 'Price: 3 euros.', 'by card only', 'do not accept cash'] },
      { id: 'cafe.b.notice', de: ['Heute ist Dienstag.', '09:00 Uhr', '17:00 Uhr', 'Am Montag ist das Café geschlossen.', 'am Fenster'], en: ['Today is Tuesday.', 'open at 09:00', 'close at 17:00', 'On Monday the café is closed.', 'order at the window'] },
    ],
    roleplay: ['Café am Bahnhof', 'Tuesday', '09:00 to 17:00', 'large coffee', '€3', 'cards only'],
    writing: ['Ben', 'Tuesday at 11:00', '09:00 to 17:00', 'cards only'],
    drink: 'large coffee',
    readingSlots: 'cafe.b.reading.order',
    emptySlots: { size: '', price: null },
    incompleteOrder: ['can', 'i', 'please', 'here'],
  },
};

const unanswered = form => Object.fromEntries(Object.keys(correctAnswers[form]).map(id => [id, null]));
function assertGrade(result, earned, percentage) {
  assert.deepEqual(
    { type: result.type, status: result.status, earned: result.earned, maximum: result.maximum, percentage: result.percentage },
    { type: 'keyed', status: 'graded', earned, maximum: 20, percentage },
  );
  assert.equal(result.items.length, 15);
}

for (const form of ['a', 'b']) {
  test(`cafe ${form}: pack validates with exact identities, exposure groups and 5/4/4/2 domains`, () => {
    const pack = packs[form];
    assert.equal(validateAssessmentPack(pack, { id: `pilot-cafe-${form}`, version: '1' }), pack);
    assert.equal(pack.schemaVersion, 1);
    assert.deepEqual(pack.definitions.map(def => def.kind), ['objective', 'writing', 'roleplay']);
    for (const def of pack.definitions) {
      assert.equal(def.schemaVersion, 1);
      assert.equal(def.id, `pilot.cafe.${form}.${def.kind}`);
      assert.equal(def.version, '1');
      assert.equal(def.level, 'A1');
      assert.equal(def.familyId, 'cafe');
      assert.equal(def.formId, form);
      assert.deepEqual(def.lessonIds, ['starter-coffee', 'starter-prices', 'starter-time']);
      assert.deepEqual(def.exposureGroupIds, [`pilot.cafe.${form}`]);
      assert.ok(def.skillIds.length > 0);
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
    assert.equal(objective.rubricId, null);
    assert.equal(objective.task, null);
    assert.equal(objective.scenario, null);
  });

  test(`cafe ${form}: two original passages have two reading questions each and consistent bilingual facts`, () => {
    const objective = definition(form, 'objective');
    assert.equal(objective.stimuli.length, 2);
    const reading = objective.items.filter(item => item.domain === 'reading');
    const prompts = [objective.instructions, ...objective.items.flatMap(item => [item.promptDe ?? '', item.promptEn])];
    assert.ok(reading.every(item => item.stimulusIds.length === 1));
    for (const expected of facts[form].passages) {
      const stimulus = objective.stimuli.find(item => item.id === expected.id);
      assert.ok(stimulus, expected.id);
      assert.ok(stimulus.de.trim() && stimulus.en.trim());
      assert.notEqual(stimulus.de, stimulus.en);
      assert.equal(reading.filter(item => item.stimulusIds.includes(stimulus.id)).length, 2);
      for (const language of ['de', 'en']) {
        for (const fact of expected[language]) assert.ok(stimulus[language].includes(fact), fact);
      }
      assert.ok(prompts.every(prompt => !prompt.includes(stimulus.en)), 'Keep the full English reading translation out of question prompts.');
    }
  });

  test(`cafe ${form}: free writing has three 20–40-word goals and roleplay has four observable A1 goals`, () => {
    const writing = definition(form, 'writing');
    assert.equal(writing.rubricId, 'writing:1');
    assert.deepEqual(writing.task.words, [20, 40]);
    assert.equal(writing.task.goals.length, 3);
    assert.ok(writing.task.goals.every(goal => typeof goal === 'string' && goal.trim()));
    assert.match(writing.task.goals[0], /Invite .* for coffee/);
    assert.match(writing.task.prompt, /Fictional situation/);
    assert.match(writing.instructions, /natural message fragments can earn full task credit/);
    for (const fact of facts[form].writing) assert.ok(writing.task.prompt.includes(fact), fact);
    assert.equal(writing.scenario, null);

    const roleplay = definition(form, 'roleplay');
    assert.equal(roleplay.rubricId, 'conversation:1');
    assert.equal(roleplay.task, null);
    const scenario = roleplay.scenario;
    assert.equal(scenario.variantId, form);
    assert.equal(scenario.register, 'Sie');
    assert.deepEqual(scenario.goals.map(goal => goal.id), ['order-size', 'ask-price', 'ask-payment', 'close']);
    assert.ok(scenario.goals[0].text.includes(facts[form].drink));
    for (const text of [scenario.learnerTask, scenario.partnerInstructions, scenario.preparation]) {
      for (const fact of facts[form].roleplay) assert.ok(text.includes(fact), fact);
    }
    assert.match(scenario.partnerInstructions, /at least three learner replies/);
    assert.match(scenario.partnerInstructions, /full task credit for clear natural elliptical/);
    assert.match(scenario.partnerInstructions, /native-speaker fluency are not required/);
    for (const def of [writing, roleplay]) {
      assert.deepEqual(def.stimuli, []);
      assert.deepEqual(def.items, []);
    }
  });

  test(`cafe ${form}: independent correct answers earn 20/20 with expected domain point totals`, () => {
    const result = grade(form, correctAnswers[form]);
    assertGrade(result, 20, 100);
    const totals = {};
    for (const item of result.items) {
      assert.equal(item.earned, item.maximum, item.itemId);
      totals[item.domain] = (totals[item.domain] ?? 0) + item.earned;
    }
    assert.deepEqual(totals, { vocabulary: 5, grammar: 6, reading: 5, writing: 4 });
  });

  test(`cafe ${form}: alternate orders, number formats, Unicode and natural short answers earn full credit`, () => {
    assertGrade(grade(form, alternativeAnswers[form]), 20, 100);
  });

  test(`cafe ${form}: every stated constrained-writing frame accepts optional bitte and natural ellipses`, () => {
    for (const [suffix, phrases] of Object.entries(writingPhrases[form])) {
      const id = `cafe.${form}.writing.${suffix}`;
      for (const phrase of phrases) {
        for (const ending of ['', ', bitte', ' bitte']) {
          const response = `${phrase}${ending}.`;
          const result = grade(form, { ...correctAnswers[form], [id]: response });
          assertGrade(result, 20, 100);
          assert.equal(earnedFor(result, id), 2, response);
        }
      }
    }
  });

  test(`cafe ${form}: mixed answers earn 13/20 with partial grammar and reading slot credit`, () => {
    const result = grade(form, mixedAnswers[form]);
    assertGrade(result, 13, 65);
    assert.equal(earnedFor(result, `cafe.${form}.vocab.size`), 0);
    assert.equal(earnedFor(result, `cafe.${form}.grammar.prepositions`), 1);
    assert.equal(earnedFor(result, `cafe.${form}.grammar.order`), 0);
    assert.equal(earnedFor(result, facts[form].readingSlots), 1);
    assert.equal(earnedFor(result, `cafe.${form}.writing.order`), 0);
  });

  test(`cafe ${form}: explicitly wrong answers earn zero in every domain and item type`, () => {
    const result = grade(form, wrongAnswers[form]);
    assertGrade(result, 0, 0);
    assert.ok(result.items.every(item => item.earned === 0));
  });

  test(`cafe ${form}: each slot earns its own point beside a wrong, missing or null part`, () => {
    for (const [id, response] of partialSlots[form]) {
      const result = grade(form, { ...unanswered(form), [id]: response });
      assertGrade(result, 1, 5);
      assert.equal(earnedFor(result, id), 1, `${id}: ${JSON.stringify(response)}`);
    }
  });

  test(`cafe ${form}: wrong case endings, missing umlauts, changed facts and negations do not match keys`, () => {
    for (const [id, response, lost] of textCounterexamples[form]) {
      const result = grade(form, { ...correctAnswers[form], [id]: response });
      assertGrade(result, 20 - lost, 100 - lost * 5);
      assert.equal(earnedFor(result, id), 0, response);
    }
  });

  test(`cafe ${form}: empty answers earn zero and incomplete token orders earn no order credit`, () => {
    assertGrade(grade(form, unanswered(form)), 0, 0);
    assertGrade(grade(form, {
      ...unanswered(form),
      [`cafe.${form}.grammar.prepositions`]: {},
      [facts[form].readingSlots]: facts[form].emptySlots,
      [`cafe.${form}.grammar.order`]: [],
      [`cafe.${form}.writing.order`]: '',
      [`cafe.${form}.writing.payment`]: '   ',
    }), 0, 0);
    const result = grade(form, {
      ...correctAnswers[form],
      [`cafe.${form}.grammar.order`]: facts[form].incompleteOrder,
    });
    assertGrade(result, 18, 90);
    assert.equal(earnedFor(result, `cafe.${form}.grammar.order`), 0);
    const missing = { ...correctAnswers[form] };
    delete missing[`cafe.${form}.writing.payment`];
    assert.throws(() => grade(form, missing), /Submit each item/);
  });
}

test('cafe forms have distinct definitions, items, passages and form-specific exposure groups', () => {
  const definitions = [...packs.a.definitions, ...packs.b.definitions];
  assert.equal(new Set(definitions.map(def => def.id)).size, 6);
  assert.equal(new Set(definitions.flatMap(def => def.items.map(item => item.id))).size, 30);
  assert.equal(new Set(definitions.flatMap(def => def.stimuli.map(stimulus => stimulus.id))).size, 4);
  assert.equal(new Set(definitions.flatMap(def => def.stimuli.map(stimulus => stimulus.de))).size, 4);
  const aGroups = new Set(packs.a.definitions.flatMap(def => def.exposureGroupIds));
  assert.ok(packs.b.definitions.every(def => def.exposureGroupIds.every(id => !aGroups.has(id))));
});
