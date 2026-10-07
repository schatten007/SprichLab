import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { deleteDB } from 'idb';
import { newState, upgradeState, validateState, mergeProgress, progressStats, SCHEMA_VERSION } from '../app/js/model.js';
import { createAIConversation, aiPayload, activeAITurns, newAIDraft, mergeAIConversations, validateAIConversation } from '../app/js/ai-state.js';
import { createStore } from '../app/js/store.js';
import { validateReview, validateTurnInput } from '../shared/ai-contracts.js';

function response(session, text = 'Ich kann montags arbeiten.') {
  return { requestId: session.draft.requestId, sessionId: session.id, inputStatus: 'clear', transcript: text,
    reply: { replyDe: 'Wie viele Stunden hätten Sie am Montag Zeit?', meaningEn: 'How many hours would you have on Monday?', action: 'question' },
    model: 'test-model', promptVersion: 'v1', usage: { inputTokens: 100, outputTokens: 30 } };
}

test('schema 3 upgrades without altering recorded lessons or adding secrets to exports', () => {
  const old = newState(1000);
  old.schemaVersion = 3;
  delete old.aiSessions; delete old.companionNotes;
  delete old.preferences.aiVoice; delete old.preferences.aiLevel;
  old.profile.studies = 'Informatik';
  const upgraded = upgradeState(old);
  assert.equal(upgraded.schemaVersion, SCHEMA_VERSION);
  assert.equal(upgraded.profile.studies, 'Informatik');
  assert.deepEqual(upgraded.aiSessions, []);
  assert.equal(old.schemaVersion, 3);
});

test('AI context contains only selected profile facts and bounded conversational history', () => {
  const state = newState();
  state.profile.name = 'Private name'; state.profile.studies = 'Informatik'; state.profile.experience = 'Private experience';
  const session = createAIConversation(state, 'first-interview', { fields: ['studies'] });
  const payload = aiPayload(session);
  assert.deepEqual(payload.profile, { studies: 'Informatik' });
  assert.ok(!JSON.stringify(payload).includes('Private name'));
  assert.ok(!JSON.stringify(payload).includes('Private experience'));
  assert.equal(validateTurnInput({ ...payload, providerUrl: 'https://example.org', model: 'unapproved' }).model, undefined);
});

test('turns persist once, corrected transcripts supersede history without doubling recording time', async t => {
  const name = `ai-${crypto.randomUUID()}`;
  const store = await createStore({ name });
  t.after(async () => { store.close(); await deleteDB(name); });
  const session = createAIConversation(store.state, 'first-interview');
  session.draft.recordingMs = 12_000; session.draft.audioKey = session.draft.requestId;
  await store.addAIConversation(session);
  await store.putRecording(session.draft.audioKey, new Blob(['audio']));
  const result = response(session);
  await store.completeAITurn(session.id, result);
  await store.completeAITurn(session.id, result);
  let saved = store.state.aiSessions[0];
  assert.equal(saved.turns.length, 1);
  const first = saved.turns[0];
  await store.updateAIConversation(session.id, item => { item.draft = { ...newAIDraft(), text: 'Ich kann donnerstags arbeiten.', supersedes: first.id }; });
  saved = store.state.aiSessions[0];
  await store.completeAITurn(saved.id, response(saved, saved.draft.text));
  saved = store.state.aiSessions[0];
  assert.equal(activeAITurns(saved).length, 1);
  assert.equal(activeAITurns(saved)[0].transcript, 'Ich kann donnerstags arbeiten.');
  assert.equal(progressStats(store.state).aiRecordedMs, 12_000);
  await assert.rejects(() => store.putRecording(first.audioKey, new Blob(['overwrite'])), /completed AI turn/);
  validateState(store.state);
  const backup = await store.export();
  await store.import(backup);
  assert.equal(store.state.aiSessions[0].turns.length, 2);
});

test('AI feedback cannot invent a quote that was absent from the learner transcript', () => {
  const review = { strengths: [], corrections: [{ original: 'ich habe gegangen', corrected: 'ich bin gegangen', explanationDe: 'gehen benutzt sein.', explanationEn: 'gehen uses sein.' }], phrases: [], retryDe: 'Antworte noch einmal.', retryEn: 'Answer again.' };
  assert.throws(() => validateReview(review, ['Ich studiere Informatik.']), /not in your responses/);
  assert.equal(validateReview(review, ['Gestern ich habe gegangen.']).corrections.length, 1);
});

test('AI and companion records merge idempotently and do not award normal SRS evidence', () => {
  const state = newState();
  const session = createAIConversation(state, 'first-interview');
  state.aiSessions.push(session);
  state.companionNotes.push({ id: 'note-1', missionId: 'first-interview', text: 'Ich habe eine Rückfrage geübt.', minutes: 10, createdAt: Date.now() });
  const merged = mergeProgress(mergeProgress(newState(), state), state);
  assert.equal(merged.aiSessions.length, 1);
  assert.equal(merged.companionNotes.length, 1);
  assert.equal(merged.attempts.length, 0);
  assert.equal(progressStats(merged).speaking.length, 0);
});

test('an edited turn follows the turn it replaces even when device clocks disagree', () => {
  const base = { id: 'session-1', missionId: 'first-interview', createdAt: 1000, updatedAt: 2000, endedAt: null, level: 'A2',
    context: { title: 'Your first interview', goal: 'Introduce yourself.', register: 'Sie', contentVersion: '2026.10-course-1',
      openingDe: 'Guten Tag, erz�hlen Sie mir von sich.', openingEn: 'Good day, tell me about yourself.', profile: { studies: 'Informatik' } },
    turns: [], draft: newAIDraft(1000), review: null, reviewRequestId: 'review-1', reviewStatus: 'idle', reviewError: '' };
  const turn = (id, supersedes, completedAt) => ({ id, operation: 'reply', supersedes, createdAt: 1000, completedAt,
    transcript: 'Ich kann montags arbeiten.', replyDe: 'Danke.', meaningEn: 'Thanks.', action: 'question',
    recordingMs: 0, audioKey: '', model: 'test-model', promptVersion: 'v1', usage: { inputTokens: 1, outputTokens: 1 } });
  const local = { ...base, turns: [turn('turn-a', '', 50_000)], updatedAt: 1_000 };
  const remote = { ...base, turns: [turn('turn-a', '', 50_000), turn('turn-b', 'turn-a', 500)], updatedAt: 9_000 };

  const merged = mergeAIConversations([local], [remote]);
  assert.deepEqual(merged[0].turns.map(item => item.id), ['turn-a', 'turn-b']);
  validateAIConversation(merged[0]);
  assert.deepEqual(mergeAIConversations(merged, [remote])[0].turns.map(item => item.id), ['turn-a', 'turn-b']);
});
