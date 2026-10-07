import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { deleteDB } from 'idb';
import { newState, validateState, progressStats, mergeProgress, safeSourceURL } from '../app/js/model.js';
import { createStore } from '../app/js/store.js';
import { createSession, tasksFor } from '../app/js/session.js';
import { createResourceSession, resourceAttempt, createPersonalPhrase, filterResources, alternativesFor, chooseResource } from '../app/js/resources.js';
import { RESOURCES, resourceById } from '../app/data/resources.js';
import { PHRASES, allPhrases } from '../app/data/phrases.js';

test('the catalog carries explicit access, level, transcript, and guidance metadata', () => {
  assert.equal(RESOURCES.length, 15);
  assert.equal(new Set(RESOURCES.map(resource => resource.id)).size, RESOURCES.length);
  for (const resource of RESOURCES) {
    assert.ok(safeSourceURL(resource.url));
    assert.ok(resource.taskDe && resource.taskEn && resource.stepsDe.length === resource.stepsEn.length);
    assert.ok(resource.access && resource.verification && resource.checkedOn && resource.transcript);
  }
  assert.equal(resourceById('slow-interview').voice, 'mixed');
  assert.equal(resourceById('goethe-pronunciation').registration, 'required');
  assert.equal(resourceById('easy-routine').captionsFixed, true);
});

test('filters combine language, time, registration, and bookmarks', () => {
  const state = newState();
  state.resourceStates.push({ id: 'dw-phone', bookmarked: true, difficulty: 'right', unavailable: false, updatedAt: 1000 });
  assert.deepEqual(filterResources(state, { bookmarked: true }).map(resource => resource.id), ['dw-phone']);
  assert.ok(filterResources(state, { level: 'A2', maxMinutes: 10, noRegistration: true }).every(resource => resource.band === 'A2' && resource.practiceMinutes <= 10 && resource.registration !== 'required'));
  assert.equal(filterResources(state, { query: 'Tagesablauf' })[0].id, 'easy-routine');
});

test('unavailable or difficult resources are replaced with relevant accessible alternatives', () => {
  const state = newState();
  state.resourceStates.push({ id: 'nicos-interview', bookmarked: false, difficulty: 'hard', unavailable: false, updatedAt: 1000 });
  assert.notEqual(chooseResource(state, 'first-interview')?.id, 'nicos-interview');
  const alternatives = alternativesFor(state, resourceById('nicos-interview'));
  assert.ok(alternatives.length > 0);
  assert.ok(alternatives.every(resource => resource.id !== 'nicos-interview' && resource.band === 'A2'));
});

test('opening a resource cannot complete it; reported minutes stay separate from measured time', () => {
  const state = newState();
  const session = createResourceSession(state, 'dw-phone');
  state.sessions.push(session);
  validateState(state);
  assert.equal(session.completedAt, null);
  assert.throws(() => resourceAttempt(session, { text: '', recordingMs: 0, aloud: true, sourceOpened: true }, 'Europe/Berlin'), /written response or a recording/);
  const attempt = resourceAttempt(session, { text: 'Guten Tag, ich rufe wegen der Stelle an.', recordingMs: 0, externalMinutes: 12 }, 'Europe/Berlin');
  state.attempts.push(attempt);
  const stats = progressStats(state);
  assert.equal(stats.externalMinutes, 12);
  assert.equal(stats.todayMs, 0);
  assert.equal(stats.speaking.length, 0);
  assert.equal(attempt.outcome, 'unscored');
});

test('personal phrase identities are stable and unsafe source URLs are rejected', async () => {
  const first = await createPersonalPhrase({ de: 'Ich würde gern etwas fragen.', en: 'I would like to ask something.', example: 'Ich würde gern etwas zum Projekt fragen.', sourceUrl: 'https://example.org/lesson' });
  const same = await createPersonalPhrase({ de: '  ich würde gern etwas fragen! ', en: 'i would like to ask something' });
  assert.equal(first.id, same.id);
  await assert.rejects(() => createPersonalPhrase({ de: 'Hallo', en: 'Hello', sourceUrl: 'javascript:alert(1)' }), /HTTPS/);
  const state = newState();
  state.personalPhrases.push(first);
  const session = createSession(state, 'first-interview', { phraseIds: [first.id] });
  state.sessions.push(session);
  validateState(state);
  assert.equal(tasksFor(session)[0].phraseId, first.id);
  assert.equal(session.content.phrases[0].de, first.de);
  assert.equal(mergeProgress(state, state).personalPhrases.length, 1);
});

test('resource artifacts, bookmarks and personal phrases survive a duplicate import', async t => {
  const name = `resources-${crypto.randomUUID()}`;
  const store = await createStore({ name });
  t.after(async () => { store.close(); await deleteDB(name); });
  const id = await store.addPersonalPhrase({ de: 'Ich schaue gleich nach.', en: 'I will check shortly.', sourceUrl: 'https://example.org' });
  assert.equal(await store.addPersonalPhrase({ de: 'Ich schaue gleich nach.', en: 'I will check shortly.' }), id);
  await store.setResourceState('dw-phone', { bookmarked: true, difficulty: 'right' });
  const session = createResourceSession(store.state, 'dw-phone');
  await store.addSession(session);
  const attempt = resourceAttempt(session, { text: 'Kann ich eine Nachricht hinterlassen?', recordingMs: 0, externalMinutes: 10 }, 'Europe/Berlin');
  await store.finishResource(session.id, attempt);
  const backup = await store.export();
  await store.import(backup);
  await store.import(backup);
  assert.equal(store.state.attempts.length, 1);
  assert.equal(store.state.personalPhrases.length, 1);
  assert.equal(store.state.resourceStates[0].bookmarked, true);
});

test('saving a core phrase retains the learner’s source and example without duplicating recall', async t => {
  const name = `core-annotation-${crypto.randomUUID()}`;
  const store = await createStore({ name });
  t.after(async () => { store.close(); await deleteDB(name); });
  const core = PHRASES.find(phrase => phrase.id === 'repeat');
  const id = await store.addPersonalPhrase({ de: core.de, en: core.en, example: 'Könnten Sie die Uhrzeit bitte wiederholen?', sourceUrl: 'https://example.org/my-source' });
  assert.equal(id, 'repeat');
  assert.equal(store.state.personalPhrases.length, 1);
  const library = allPhrases(store.state);
  assert.equal(library.length, PHRASES.length);
  const annotated = library.find(phrase => phrase.id === 'repeat');
  assert.ok(annotated.tags.includes('personal'));
  assert.equal(annotated.sourceUrl, 'https://example.org/my-source');
  assert.equal(annotated.example, 'Könnten Sie die Uhrzeit bitte wiederholen?');
});
