import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewStates, retained, duePhrases, nextDue } from '../app/js/srs.js';
import { DAY, dateKey } from '../app/js/model.js';

const start = Date.parse('2026-10-01T12:00:00Z');
function evidence(id, completedAt, changes = {}) {
  return { id, completedAt, day: dateKey(completedAt), phraseIds: ['hours'], kind: 'speaking', inputMode: 'aloud', outcome: 'independent', hintUsed: false, ...changes };
}

test('immediate clicks and crossing midnight do not establish spaced production', () => {
  let attempts = [evidence('one', start), evidence('two', start + 1000)];
  assert.equal(retained(reviewStates(attempts).get('hours')), false);
  const midnight = Date.parse('2026-10-01T21:59:00Z');
  attempts = [evidence('one', midnight), evidence('two', midnight + 120_000)];
  assert.equal(retained(reviewStates(attempts).get('hours')), false);
});

test('unassisted spoken use on spaced days establishes self-rated retention', () => {
  const attempts = [evidence('one', start), evidence('two', start + DAY)];
  const state = reviewStates(attempts).get('hours');
  assert.equal(retained(state), true);
  assert.equal(state.production.dueAt, start + 4 * DAY);
  attempts.push(evidence('fail', start + 5 * DAY, { outcome: 'again' }));
  assert.equal(retained(reviewStates(attempts).get('hours')), false);
});

test('typed answers and copied models cannot create production mastery', () => {
  const typed = [evidence('a', start, { inputMode: 'typed' }), evidence('b', start + DAY, { inputMode: 'typed' })];
  assert.equal(retained(reviewStates(typed).get('hours')), false);
  const helped = [evidence('a', start, { hintUsed: true }), evidence('b', start + DAY, { hintUsed: true })];
  assert.equal(retained(reviewStates(helped).get('hours')), false);
});

test('reviews contain due items only and early practice does not postpone them', () => {
  const first = evidence('one', start, { kind: 'recall' });
  const second = evidence('two', start + 1000, { kind: 'recall' });
  const phrases = [{ id: 'hours' }, { id: 'new' }];
  assert.equal(nextDue(reviewStates([first, second]).get('hours')), start + DAY);
  assert.deepEqual(duePhrases(phrases, [first], start + 1000), []);
  assert.deepEqual(duePhrases(phrases, [first], start + DAY), [{ id: 'hours' }]);
});

test('duplicate imported evidence does not change intervals', () => {
  const first = evidence('same', start, { kind: 'recall' });
  assert.deepEqual(reviewStates([first, first]), reviewStates([first]));
});

test('a completed recall clears a due card with older production evidence', () => {
  const attempts = [evidence('spoken', start), evidence('recall', start + DAY, { kind: 'recall' })];
  assert.deepEqual(duePhrases([{ id: 'hours' }], attempts, start + DAY + 1), []);
});

test('an assisted review moves an overdue card into the future', () => {
  const attempts = [evidence('first', start, { kind: 'recall' }), evidence('helped', start + 2 * DAY, { kind: 'recall', outcome: 'helped', hintUsed: true })];
  assert.equal(nextDue(reviewStates(attempts).get('hours')), start + 3 * DAY);
  assert.deepEqual(duePhrases([{ id: 'hours' }], attempts, start + 2 * DAY), []);
});

test('an early assisted review can shorten but cannot postpone an existing future review', () => {
  const attempts = [evidence('first', start, { kind: 'recall' }), evidence('helped', start + DAY / 2, { kind: 'recall', outcome: 'helped', hintUsed: true })];
  assert.equal(nextDue(reviewStates(attempts).get('hours')), start + DAY);
});
