import test from 'node:test';
import assert from 'node:assert/strict';
import { newState } from '../app/js/model.js';
import { createSession, tasksFor, draftFor, makeAttempt, checkListening } from '../app/js/session.js';
import { MISSIONS, PHRASES } from '../app/data/missions.js';

test('all mission variants have valid phrase references and answer keys', () => {
  const ids = new Set(PHRASES.map(phrase => phrase.id));
  assert.equal(ids.size, PHRASES.length);
  for (const mission of MISSIONS) {
    for (const id of [...mission.phraseIds, ...mission.turns.flatMap(turn => turn.phraseIds)]) assert.ok(ids.has(id), `${mission.id}: ${id}`);
    for (const listening of mission.listening) for (const question of listening.questions) {
      assert.ok(question.answer >= 0 && question.answer < question.options.length);
    }
    const session = createSession(newState(), mission.id);
    const tasks = tasksFor(session);
    assert.equal(new Set(tasks.map(task => task.id)).size, tasks.length);
    assert.ok(tasks.some(task => task.kind === 'speak' && task.retry));
  }
});

test('sessions have independent cursors and snapshot the learner profile', () => {
  const state = newState();
  state.profile.studies = 'Informatik';
  const first = createSession(state, 'first-interview', { id: 'one' });
  const second = createSession(state, 'first-interview', { id: 'two' });
  first.cursor = 5;
  first.profile.studies = 'Mathematik';
  assert.equal(second.cursor, 0);
  assert.equal(state.profile.studies, 'Informatik');
  assert.equal(second.profile.studies, 'Informatik');
});

test('the availability response changes the next question coherently', () => {
  const session = createSession(newState(), 'first-interview');
  session.drafts.availability = { intent: 'asked-hours' };
  const follow = tasksFor(session).find(task => task.id === 'availability-followup');
  assert.match(follow.prompt, /zwölf bis sechzehn/);
  session.drafts.availability.intent = 'unsure';
  assert.match(tasksFor(session).find(task => task.id === 'availability-followup').prompt, /Wann können Sie uns sagen/);
});

test('typing nonsense cannot automatically award independent speaking or minutes', () => {
  const session = createSession(newState(), 'first-interview');
  const task = tasksFor(session).find(item => item.id === 'intro');
  const draft = { ...draftFor(session, task.id), text: 'banana' };
  assert.throws(() => makeAttempt(session, task, draft, 'independent', 'Europe/Berlin'), /reflection/);
  draft.criteria = [...task.criteria];
  assert.throws(() => makeAttempt(session, task, draft, 'independent', 'Europe/Berlin'), /spoken practice/);
  const attempt = makeAttempt(session, task, draft, 'helped', 'Europe/Berlin');
  assert.equal(attempt.recordingMs, 0);
  assert.equal(attempt.source, 'self');
  assert.equal(attempt.inputMode, 'typed');
});

test('looking at a hint prevents an independent grade', () => {
  const session = createSession(newState(), 'first-interview');
  const task = tasksFor(session).find(item => item.id === 'intro');
  const draft = { ...draftFor(session, task.id), aloud: true, criteria: task.criteria, hintUsed: true };
  assert.throws(() => makeAttempt(session, task, draft, 'independent', 'Europe/Berlin'), /Needed help/);
});

test('listening requires every answer and keeps fixed question IDs', () => {
  const session = createSession(newState(), 'first-interview', { id: 'listening' });
  const task = tasksFor(session).find(item => item.kind === 'listen');
  const draft = { ...draftFor(session, task.id), listened: true, answers: { hours: 1 } };
  assert.throws(() => checkListening(session, task, draft, 'Europe/Berlin'), /each question/);
  draft.answers.start = 2;
  draft.answers.days = 0;
  const first = checkListening(session, task, draft, 'Europe/Berlin', 1000);
  const second = checkListening(session, task, draft, 'Europe/Berlin', 2000);
  assert.deepEqual(first.map(attempt => attempt.id), second.map(attempt => attempt.id));
  assert.equal(first.filter(attempt => attempt.outcome === 'correct').length, 3);
  draft.readInstead = true;
  assert.ok(checkListening(session, task, draft, 'Europe/Berlin').every(attempt => attempt.hintUsed));
});

test('recall cannot be graded independent when the answer was shown first', () => {
  const session = createSession(newState(), 'first-interview');
  const task = tasksFor(session).find(item => item.kind === 'recall');
  const draft = { ...draftFor(session, task.id), aloud: true, revealed: true };
  assert.throws(() => makeAttempt(session, task, draft, 'independent', 'Europe/Berlin'), /memory/);
});
