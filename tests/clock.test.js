import test from 'node:test';
import assert from 'node:assert/strict';
import { createPracticeClock } from '../app/js/clock.js';
import { mergeActivity } from '../app/js/model.js';

test('the clock excludes idle, hidden, and paused time and compacts checkpoints', async t => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const document = new EventTarget();
  document.hidden = false;
  Object.defineProperty(globalThis, 'document', { value: document, configurable: true });
  t.mock.timers.enable({ apis: ['Date', 'setInterval'], now: Date.parse('2026-10-01T12:00:00Z') });
  let activity = [];
  const clock = createPracticeClock({
    sessionId: 'clock-test', timeZone: 'Europe/Berlin',
    onSegments: async segments => { activity = mergeActivity(activity, segments); },
  });
  t.after(async () => {
    await clock.stop();
    t.mock.timers.reset();
    if (original) Object.defineProperty(globalThis, 'document', original);
    else delete globalThis.document;
  });
  clock.start();
  for (let index = 0; index < 13; index++) { t.mock.timers.tick(5000); await clock.flush(); }
  assert.equal(activity.reduce((sum, item) => sum + item.ms, 0), 60_000);
  assert.equal(activity.length, 1, 'twelve checkpoints should form one continuous minute');
  document.hidden = true;
  document.dispatchEvent(new Event('visibilitychange'));
  t.mock.timers.tick(120_000);
  await clock.flush();
  assert.equal(activity.reduce((sum, item) => sum + item.ms, 0), 60_000);
  document.hidden = false;
  clock.interact();
  t.mock.timers.tick(5000);
  await clock.flush();
  clock.setPaused(true);
  t.mock.timers.tick(30_000);
  await clock.flush();
  assert.equal(activity.reduce((sum, item) => sum + item.ms, 0), 65_000);
  clock.setPaused(false);
  t.mock.timers.tick(5000);
  await clock.flush();
  assert.equal(activity.reduce((sum, item) => sum + item.ms, 0), 70_000);
});
