import test from 'node:test';
import assert from 'node:assert/strict';
import { newState, migrateLegacy, dateKey, splitActivity, progressStats, parseBackup, mergeActivity, DAY } from '../app/js/model.js';
import { dailyPlan } from '../app/js/adaptive.js';

test('legacy scores are preserved without becoming new learning evidence', () => {
  const raw = JSON.stringify({ profile: { recall: null, streak: 999 }, assess: [{ total: 100 }], planMin: 120 });
  const state = migrateLegacy(raw, 1000);
  assert.equal(state.legacy.raw, raw);
  assert.equal(state.legacy.assessmentCount, 1);
  assert.equal(state.preferences.dailyMinutes, 120);
  assert.deepEqual(state.attempts, []);
  assert.deepEqual(state.activity, []);
  assert.equal(migrateLegacy('{broken').legacy.raw, '{broken');
});

test('local study dates do not roll over at UTC midnight', () => {
  assert.equal(dateKey(Date.parse('2026-10-01T22:30:00Z'), 'Europe/Berlin'), '2026-10-02');
  assert.equal(dateKey(Date.parse('2026-10-01T22:30:00Z'), 'America/New_York'), '2026-10-01');
});

test('activity splits exactly at local midnight and handles the DST change', () => {
  const start = Date.parse('2026-10-24T21:59:55Z');
  const result = splitActivity(start, start + 10_000, 'Europe/Berlin', 'event', 'session');
  assert.deepEqual(result.map(part => [part.day, part.ms]), [['2026-10-24', 5000], ['2026-10-25', 5000]]);
  const dst = splitActivity(Date.parse('2026-10-25T00:59:55Z'), Date.parse('2026-10-25T01:00:05Z'), 'Europe/Berlin', 'dst', 'session');
  assert.equal(dst.length, 1);
  assert.equal(dst[0].ms, 10_000);
});

test('weekly time excludes old work and missed days break a streak', () => {
  const now = Date.parse('2026-10-08T12:00:00Z');
  const state = newState(now);
  state.activity = [
    { day: '2026-09-30', ms: 90 * 60_000 },
    { day: '2026-10-04', ms: 15 * 60_000 },
    { day: '2026-10-07', ms: 16 * 60_000 },
    { day: '2026-10-08', ms: 10 * 60_000 },
  ].map(event => ({ ...event, start: Date.parse(`${event.day}T12:00:00Z`), end: Date.parse(`${event.day}T12:00:00Z`) + event.ms }));
  const stats = progressStats(state, now);
  assert.equal(stats.weekMs, 41 * 60_000);
  assert.equal(stats.streak, 1);
  assert.equal(stats.todayMs, 10 * 60_000);
  assert.equal(progressStats(state, now + 2 * DAY).streak, 0);
});

test('overlapping activity from two windows is counted once', () => {
  const state = newState();
  const start = Date.parse('2026-10-01T12:00:00Z');
  state.activity = [
    { day: '2026-10-01', start, end: start + 30_000, ms: 30_000 },
    { day: '2026-10-01', start: start + 15_000, end: start + 45_000, ms: 30_000 },
  ];
  assert.equal(progressStats(state, start + 60_000).todayMs, 45_000);
});

test('activity checkpoints coalesce and partial backups merge without double counting', () => {
  const first = { id: 'run:minute:0', sessionId: 'session', day: '2026-10-01', start: 1000, end: 6000, ms: 5000 };
  const second = { ...first, start: 6000, end: 11000 };
  const merged = mergeActivity([first], [second]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].ms, 10_000);
  assert.deepEqual(mergeActivity(merged, [first]), merged);
});

test('all daily budgets add up and returning a plan does not share mutable state', () => {
  for (const minutes of [15, 30, 60, 90, 120]) {
    assert.equal(dailyPlan(minutes).reduce((sum, block) => sum + block.minutes, 0), minutes);
  }
  dailyPlan(90)[0].minutes = 1000;
  assert.equal(dailyPlan(90)[0].minutes, 10);
});

test('unknown backup versions and malformed data are rejected', () => {
  assert.throws(() => parseBackup('{oops'), /valid JSON/);
  assert.throws(() => parseBackup(JSON.stringify({ app: 'sprich', format: 1, state: { schemaVersion: 99 } })), /unsupported version/);
  const state = newState();
  state.preferences.dailyMinutes = '90';
  assert.throws(() => parseBackup(JSON.stringify({ app: 'sprich', format: 1, state })), /preferences/);
});
