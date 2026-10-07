import test from 'node:test';
import assert from 'node:assert/strict';
import { newState, progressStats, validateState, mergeProgress } from '../app/js/model.js';
import { createDailyPlan, refreshDailyPlan, dailyQueue, curriculumStage } from '../app/js/daily.js';
import { createSession } from '../app/js/session.js';
import { createResourceSession, resourceAttempt } from '../app/js/resources.js';

const now = Date.parse('2026-10-02T12:00:00Z');

test('Today assigns a real mission and source while respecting every time budget', () => {
  for (const minutes of [15, 30, 60, 90, 120]) {
    const state = newState(now);
    state.preferences.dailyMinutes = minutes;
    const plan = createDailyPlan(state, now);
    state.dailyPlans.push(plan);
    validateState(state);
    const queue = dailyQueue(state, plan);
    assert.equal(queue.reduce((sum, item) => sum + item.minutes, 0), minutes);
    assert.equal(plan.missionId, 'first-interview');
    if (minutes === 15) assert.equal(plan.resourceId, '');
    if (minutes >= 60) assert.ok(plan.resourceId);
  }
});

test('completed source work stays in the current plan rather than rerolling immediately', () => {
  const state = newState(now);
  const plan = createDailyPlan(state, now);
  const session = createResourceSession(state, plan.resourceId, { now, missionId: plan.missionId });
  state.sessions.push(session);
  state.attempts.push(resourceAttempt(session, { text: 'Ich stelle mich vor und frage nach der Stelle.', recordingMs: 0, externalMinutes: 15 }, state.preferences.timeZone, now + 1000));
  session.completedAt = now + 1000;
  const refreshed = refreshDailyPlan(state, plan, now + 2000);
  assert.equal(refreshed.resourceId, plan.resourceId);
  assert.equal(dailyQueue(state, refreshed).find(item => item.id === 'resource').done, true);
  assert.equal(progressStats(state, now + 2000).todayMs, 0);
});

test('a resource marked too difficult is replaced by an accessible alternative', () => {
  const state = newState(now);
  const plan = createDailyPlan(state, now);
  state.resourceStates.push({ id: plan.resourceId, difficulty: 'hard', bookmarked: false, unavailable: false, updatedAt: now });
  const refreshed = refreshDailyPlan(state, plan, now + 1000);
  assert.notEqual(refreshed.resourceId, plan.resourceId);
  assert.ok(refreshed.resourceId);
});

test('resource and review completions do not advance the six-stage course', () => {
  const state = newState(now);
  const review = createSession(state, 'first-interview', { phraseIds: ['study'], now });
  review.completedAt = now;
  const resource = createResourceSession(state, 'nicos-vacancy', { now });
  resource.completedAt = now;
  state.sessions.push(review, resource);
  assert.equal(curriculumStage(state).number, 1);
});

test('reflections and day assignments survive duplicate backup merges', () => {
  const state = newState(now);
  const plan = createDailyPlan(state, now);
  plan.reflection = 'Ich kann am Telefon eine Nachricht hinterlassen.';
  plan.reflectionAt = now;
  state.dailyPlans.push(plan);
  const combined = mergeProgress(mergeProgress(newState(now), state), state);
  assert.equal(combined.dailyPlans.length, 1);
  assert.equal(combined.dailyPlans[0].reflection, plan.reflection);
  assert.equal(progressStats(combined, now).todayMs, 0);
});
