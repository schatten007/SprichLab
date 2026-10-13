import test from 'node:test';
import assert from 'node:assert/strict';
import { newState, previousDay, validateState } from '../app/js/model.js';
import { rewards, streakInfo, goalRing, weekStrip, milestones, STREAK_FLOOR_MS, REST_BANK_MAX } from '../app/js/rewards.js';

const TODAY = '2026-10-09';
const NOW = Date.parse('2026-10-09T12:00:00Z');
const MINUTE = 60_000;

/** Build the day map that progressStats produces, without needing stored activity rows. */
function days(entries) {
  return new Map(Object.entries(entries));
}
/** n qualifying days ending on the given day. */
function run(length, endDay = TODAY, ms = 20 * MINUTE) {
  const map = new Map();
  for (let offset = 0; offset < length; offset++) map.set(previousDay(endDay, offset), ms);
  return map;
}

/** A starter session that satisfies validateState, so purity checks stay honest. */
function starterSession(id, lessonId, responses = []) {
  return { id, lessonId, createdAt: NOW, updatedAt: NOW, completedAt: NOW, cursor: 0, variant: 0,
    support: 'guided', content: null, drafts: {}, responses };
}

test('a day needs fifteen measured minutes to count', () => {
  assert.equal(streakInfo(days({ [TODAY]: 14 * MINUTE }), TODAY).streak, 0);
  assert.equal(streakInfo(days({ [TODAY]: STREAK_FLOOR_MS }), TODAY).streak, 1);
});

test('twelve days in a row give a twelve-day streak with both rest days banked', () => {
  const info = streakInfo(run(12), TODAY);
  assert.equal(info.streak, 12);
  assert.equal(info.restLeft, REST_BANK_MAX);
  assert.equal(info.qualifyingToday, true);
});

test('an unfinished today never breaks a standing streak', () => {
  const map = run(5, previousDay(TODAY));
  const info = streakInfo(map, TODAY);
  assert.equal(info.streak, 5);
  assert.equal(info.qualifyingToday, false);
});

test('one missed day spends a banked rest day and keeps the streak', () => {
  const map = run(20, previousDay(TODAY, 2));
  map.set(TODAY, 20 * MINUTE);
  const info = streakInfo(map, TODAY);
  assert.equal(info.streak, 21, 'the twenty earlier days and today still count');
  assert.ok(info.restLeft < REST_BANK_MAX, 'the gap consumed a rest day');
});

test('two missed days in a row end the streak regardless of banked rest days', () => {
  const map = run(30, previousDay(TODAY, 3));
  map.set(TODAY, 20 * MINUTE);
  assert.equal(streakInfo(map, TODAY).streak, 1, 'only today survives');
});

test('alternating practice can never accumulate a long streak', () => {
  const map = new Map();
  for (let offset = 0; offset < 40; offset += 2) map.set(previousDay(TODAY, offset), 30 * MINUTE);
  const info = streakInfo(map, TODAY);
  assert.ok(info.streak <= 2, `alternating days produced a streak of ${info.streak}`);
});

test('a missed day without an earned rest day resets the streak', () => {
  const map = run(3, previousDay(TODAY, 2));
  map.set(TODAY, 20 * MINUTE);
  assert.equal(streakInfo(map, TODAY).streak, 1, 'three days never earned a rest day');
});

test('a rest day is only spendable after it has been earned', () => {
  const map = new Map([[TODAY, 20 * MINUTE]]);
  map.set(previousDay(TODAY, 2), 20 * MINUTE);
  assert.equal(streakInfo(map, TODAY).streak, 1);
});

test('the goal ring reports the learner goal, not the streak floor', () => {
  const ring = goalRing({ todayMs: 18 * MINUTE }, 30);
  assert.deepEqual(ring, { ms: 18 * MINUTE, goalMs: 30 * MINUTE, pct: 60, met: false });
  assert.equal(goalRing({ todayMs: 90 * MINUTE }, 90).met, true);
  assert.equal(goalRing({ todayMs: 400 * MINUTE }, 15).pct, 100, 'the ring never exceeds full');
});

test('the week strip is seven days, oldest first, ending today', () => {
  const strip = weekStrip({ today: TODAY, days: days({ [TODAY]: 20 * MINUTE, [previousDay(TODAY, 6)]: 5 * MINUTE }) });
  assert.equal(strip.length, 7);
  assert.equal(strip.at(-1).day, TODAY);
  assert.equal(strip.at(-1).qualifies, true);
  assert.equal(strip[0].qualifies, false, 'five minutes is below the floor');
});

test('milestones read de-duplicated sources, so repeating a lesson cannot inflate them', () => {
  const state = newState(NOW);
  for (let index = 0; index < 5; index++) state.starter.sessions.push(starterSession(`s${index}`, 'starter-hello'));
  const lessons = milestones(state, { days: new Map(), speaking: [], recordingMs: 0, starterResponses: [] })
    .find(item => item.id === 'lessons');
  assert.equal(lessons.value, 1, 'five sessions of one lesson is one lesson practised');
});

test('a beginner-path learner with no legacy attempts still earns milestones', () => {
  const state = newState(NOW);
  state.starter.sessions.push(starterSession('one', 'starter-hello',
    [{ taskId: 'reply-1', spoken: true, recordingMs: 0 }, { taskId: 'reply-1', spoken: true, recordingMs: 0 }]));
  assert.deepEqual(state.attempts, [], 'the beginner path writes no legacy attempts');
  const result = rewards(state, NOW);
  assert.equal(result.milestones.find(item => item.id === 'lessons').value, 1);
  assert.equal(result.milestones.find(item => item.id === 'spoken').value, 1, 'repeating one lesson task counts once');
});

test('spoken milestones deduplicate repeated legacy tasks as well as starter tasks', () => {
  const state = newState(NOW);
  state.starter.sessions.push(starterSession('one', 'starter-hello', [{ taskId: 'reply-1', spoken: true, recordingMs: 0 }]));
  const result = milestones(state, {
    days: new Map(),
    speaking: [
      { missionId: 'cafe-a', taskId: 'speak-1' },
      { missionId: 'cafe-a', taskId: 'speak-1' },
    ],
    recordingMs: 0,
    starterResponses: [],
  });
  assert.equal(result.find(item => item.id === 'spoken').value, 2);
});

test('no milestone reads an assessment score or a repeat-counting total', () => {
  const source = milestones(newState(NOW), { days: new Map(), speaking: [], recordingMs: 0, starterResponses: [] });
  for (const item of source) {
    assert.ok(['self-rated', 'measured'].includes(item.prov), `${item.id} must be effort evidence, not a grade`);
  }
  assert.deepEqual(source.map(item => item.id).sort(),
    ['lessons', 'practiceHours', 'recalled', 'recognised', 'recordedMinutes', 'spoken']);
});

test('rewards is pure: repeated calls match and the state is untouched', () => {
  const state = newState(NOW);
  state.starter.sessions.push(starterSession('one', 'starter-hello'));
  const before = JSON.stringify(state);
  const first = rewards(state, NOW);
  const second = rewards(state, NOW);
  assert.equal(JSON.stringify(state), before, 'rewards must not mutate progress');
  assert.deepEqual(first.milestones, second.milestones);
  assert.deepEqual(first.streak, second.streak);
});

test('the next milestone is the closest unmet one and every earned one is reported', () => {
  const state = newState(NOW);
  state.starter.sessions.push(starterSession('one', 'starter-hello'));
  const result = rewards(state, NOW);
  assert.equal(result.next.id, 'lessons', 'one of one lesson is the nearest target');
  assert.ok(result.earned.every(item => item.met));
  assert.ok(result.next.value < result.next.target);
});

test('a fresh install reports an empty but valid reward state', () => {
  const state = newState(NOW);
  validateState(state);
  const result = rewards(state, NOW);
  assert.equal(result.streak.streak, 0);
  assert.equal(result.streak.restLeft, 0);
  assert.equal(result.ring.pct, 0);
  assert.equal(result.week.length, 7);
  assert.ok(result.milestones.every(item => item.value === 0),
    `every count starts at zero, got ${result.milestones.map(item => `${item.id}=${item.value}`).join(', ')}`);
});
