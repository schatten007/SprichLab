import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { deleteDB } from 'idb';
import { createStore } from '../app/js/store.js';
import { createSession, tasksFor, draftFor, makeAttempt } from '../app/js/session.js';

async function fixture(t) {
  const name = `test-${crypto.randomUUID()}`;
  const store = await createStore({ name });
  t.after(async () => { store.close(); await deleteDB(name); });
  return { store, name };
}

test('responses, recordings, and session position survive reopening IndexedDB', async t => {
  const { store, name } = await fixture(t);
  const session = createSession(store.state, 'first-interview');
  await store.addSession(session);
  await store.updateSession(session.id, saved => { saved.cursor = 3; });
  await store.saveDraft(session.id, 'intro', { text: 'Ich studiere Informatik.' });
  await store.putRecording('clip', new Blob(['audio'], { type: 'audio/webm' }));
  const second = await createStore({ name });
  assert.equal(second.state.sessions[0].cursor, 3);
  assert.equal(second.state.sessions[0].drafts.intro.text, 'Ich studiere Informatik.');
  assert.equal(await (await second.getRecording('clip')).text(), 'audio');
  second.close();
});

test('double submissions award a single immutable attempt', async t => {
  const { store } = await fixture(t);
  const session = createSession(store.state, 'first-interview');
  await store.addSession(session);
  const task = tasksFor(session).find(item => item.kind === 'recall');
  const draft = { ...draftFor(session, task.id), aloud: true, attemptedBeforeReveal: true };
  const attempt = makeAttempt(session, task, draft, 'independent', 'Europe/Berlin');
  await Promise.all([store.addAttempts([attempt]), store.addAttempts([attempt])]);
  assert.equal(store.state.attempts.length, 1);
  assert.equal(store.state.attempts[0].recordingMs, 0);
});

test('two open tabs do not overwrite each other’s progress', async t => {
  const { store, name } = await fixture(t);
  const second = await createStore({ name });
  const one = createSession(store.state, 'first-interview', { id: 'one' });
  const two = createSession(second.state, 'project-story', { id: 'two' });
  await Promise.all([store.addSession(one), second.addSession(two)]);
  await store.refresh();
  assert.deepEqual(new Set(store.state.sessions.map(session => session.id)), new Set(['one', 'two']));
  second.close();
});

test('export/import round trips are idempotent and malformed files change nothing', async t => {
  const { store } = await fixture(t);
  const session = createSession(store.state, 'first-interview');
  await store.addSession(session);
  const task = tasksFor(session).find(item => item.kind === 'recall');
  const draft = { ...draftFor(session, task.id), aloud: true, attemptedBeforeReveal: true };
  await store.addAttempts([makeAttempt(session, task, draft, 'independent', 'Europe/Berlin')]);
  const raw = await store.export();
  await store.import(raw);
  await store.import(raw);
  assert.equal(store.state.attempts.length, 1);
  assert.equal(store.state.sessions.length, 1);
  await assert.rejects(() => store.import('{bad'), /valid JSON/);
  assert.equal(store.state.attempts.length, 1);
});

test('graded audio cannot be replaced by a late recording from another tab', async t => {
  const { store } = await fixture(t);
  const session = createSession(store.state, 'first-interview');
  await store.addSession(session);
  const task = tasksFor(session).find(item => item.kind === 'recall');
  const key = `${session.id}:${task.id}`;
  const draft = { ...draftFor(session, task.id), aloud: true, attemptedBeforeReveal: true, recordingMs: 1000 };
  await store.putRecording(key, new Blob(['first']));
  await store.addAttempts([makeAttempt(session, task, draft, 'independent', 'Europe/Berlin')]);
  await assert.rejects(() => store.putRecording(key, new Blob(['later'])), /already graded/);
  assert.equal(await (await store.getRecording(key)).text(), 'first');
});
