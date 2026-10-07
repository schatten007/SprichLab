import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { openDB, deleteDB } from 'idb';
import { newState, upgradeState, parseBackup, mergeProgress, DAY, SCHEMA_VERSION } from '../app/js/model.js';
import { createStore } from '../app/js/store.js';
import { createSession, tasksFor } from '../app/js/session.js';
import { recommendation } from '../app/js/adaptive.js';
import { MISSIONS } from '../app/data/missions.js';

function oldProgress() {
  const state = newState(1000);
  state.schemaVersion = 2;
  delete state.preferences.englishSupport;
  delete state.personalPhrases;
  delete state.resourceStates;
  state.sessions.push({ id: 'legacy-session', kind: 'mission', missionId: 'first-interview', createdAt: 1000, updatedAt: 2000,
    completedAt: null, cursor: 9, variant: 0, short: false,
    phraseIds: ['study', 'work-goal', 'hours', 'days', 'repeat', 'motivation'],
    profile: structuredClone(state.profile), drafts: { intro: { text: 'Ich studiere Informatik.' } } });
  return state;
}

test('v2 migration freezes the old ordering and two-question listening task', () => {
  const old = oldProgress();
  const state = upgradeState(old);
  assert.equal(old.schemaVersion, 2);
  assert.equal(state.schemaVersion, SCHEMA_VERSION);
  const session = state.sessions[0];
  assert.equal(session.cursor, 9);
  assert.equal(tasksFor(session)[9].id, 'intro');
  assert.equal(tasksFor(session).find(task => task.kind === 'listen').listening.questions.length, 2);
  assert.equal(session.content.version, 'sprich-2.0');
  assert.equal(session.drafts.intro.text, 'Ich studiere Informatik.');
});

test('IndexedDB upgrades preserve old audio and retain a pre-migration backup', async t => {
  const name = `migration-${crypto.randomUUID()}`;
  const old = await openDB(name, 1, { upgrade(db) { db.createObjectStore('meta'); db.createObjectStore('recordings'); } });
  await old.put('meta', oldProgress(), 'state');
  await old.put('recordings', new Blob(['saved audio']), 'legacy-session:intro');
  old.close();
  const store = await createStore({ name });
  t.after(async () => { store.close(); await deleteDB(name); });
  assert.equal(store.state.schemaVersion, SCHEMA_VERSION);
  assert.equal(await (await store.getRecording('legacy-session:intro')).text(), 'saved audio');
  const inspect = await openDB(name);
  assert.equal((await inspect.get('meta', 'schema-2-backup')).schemaVersion, 2);
  inspect.close();
});

test('importing the same old backup twice preserves session IDs without duplication', () => {
  const incoming = parseBackup(JSON.stringify({ app: 'sprich', format: 1, state: oldProgress() }));
  const merged = mergeProgress(mergeProgress(newState(), incoming), incoming);
  assert.equal(merged.sessions.length, 1);
  assert.equal(merged.sessions[0].id, 'legacy-session');
});

test('later content edits cannot change an existing session', () => {
  const session = createSession(newState(), 'first-interview');
  const before = tasksFor(session);
  const text = MISSIONS[0].turns[0].prompts[0];
  try {
    MISSIONS[0].turns[0].prompts[0] = 'New edition of the question';
    assert.deepEqual(tasksFor(session), before);
    assert.notEqual(tasksFor(createSession(newState(), 'first-interview'))[9]?.prompt, before[9]?.prompt);
  } finally { MISSIONS[0].turns[0].prompts[0] = text; }
});

test('phrase review completion neither completes a mission nor advances its variants', () => {
  const state = newState();
  const review = createSession(state, 'first-interview', { phraseIds: ['study'] });
  review.completedAt = Date.now();
  state.sessions.push(review);
  assert.equal(recommendation(state).mission.id, 'first-interview');
  assert.equal(createSession(state, 'first-interview').variant, 0);
  const mission = createSession(state, 'first-interview');
  mission.completedAt = Date.now() + DAY;
  state.sessions.push(mission);
  assert.equal(createSession(state, 'first-interview').variant, 1);
});
