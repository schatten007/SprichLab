import test from 'node:test';
import assert from 'node:assert/strict';
import { newState } from '../app/js/model.js';
import { ONBOARDING_KEY, finishOnboarding, shouldOfferOnboarding } from '../app/js/onboarding.js';

function storage() {
  const values = new Map();
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
}

test('a new empty device gets the getting-started guide and can finish it locally', () => {
  const saved = storage();
  assert.equal(shouldOfferOnboarding(newState(1000), saved), true);
  finishOnboarding(saved);
  assert.equal(saved.getItem(ONBOARDING_KEY), 'done');
  assert.equal(shouldOfferOnboarding(newState(1000), saved), false);
});

test('an existing device with practice history is not interrupted by onboarding', () => {
  const saved = storage();
  const state = newState(1000);
  state.activity.push({ id: 'practice:1', sessionId: 'session', start: 1000, end: 2000, ms: 1000, day: '1970-01-01' });
  assert.equal(shouldOfferOnboarding(state, saved), false);
  assert.equal(saved.getItem(ONBOARDING_KEY), 'done');
});
