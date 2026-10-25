import { openDB } from 'idb';
import { migrateLegacy, upgradeState, validateState, validateAttempt, mergeProgress, mergeActivity, parseBackup, assert, SCHEMA_VERSION } from './model.js';
import { createPersonalPhrase, resourceState } from './resources.js';
import { refreshDailyPlan } from './daily.js';
import { dateKey } from './model.js';
import { missionById } from '../data/missions.js';
import { corePhrase } from '../data/phrases.js';
import { newAIDraft, completedAITurn, validateAIConversation, activeAITurns } from './ai-state.js';
import { AI_LIMITS, validateReview } from '../../shared/ai-contracts.js';
import { starterLessonById } from '../data/starter-catalog.js';
import { validatePack } from './starter-content.js';
import { validateStarter, validateStarterSession, starterSteps, starterResponse, starterCanFinish, wordReview } from './starter-state.js';
import { newStarterPlan } from './starter-progress.js';
import { assessmentStore } from './assessment-store.js';
import { verifyAssessmentHashes } from './assessment-state.js';
import { createAssessedAIConversation } from './ai-state.js';
import { assessmentDefinition } from './assessment-state.js';
import { canonicalJSON } from '../../shared/assessment-contracts.js';

export const DATABASE_NAME = 'sprich-german-v2';
export const LEGACY_KEY = 'deutsch-trainer-v1';

/** All read-modify-write operations share one IndexedDB transaction, including across tabs. */
export async function createStore({ name = DATABASE_NAME, legacyRaw = null, now = Date.now } = {}) {
  const database = await openDB(name, 5, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
      if (!db.objectStoreNames.contains('recordings')) db.createObjectStore('recordings');
      if (!db.objectStoreNames.contains('ttsCache')) db.createObjectStore('ttsCache');
      if (!db.objectStoreNames.contains('coursePacks')) db.createObjectStore('coursePacks');
      if (!db.objectStoreNames.contains('assessmentPacks')) db.createObjectStore('assessmentPacks');
    },
    blocking() { database.close(); },
  });
  const init = database.transaction('meta', 'readwrite');
  let snapshot = await init.store.get('state');
  if (!snapshot) {
    snapshot = migrateLegacy(legacyRaw, now());
    await init.store.put(snapshot, 'state');
  } else if (snapshot.schemaVersion !== SCHEMA_VERSION) {
    try {
      const upgraded = upgradeState(snapshot);
      const backupKey = `schema-${snapshot.schemaVersion}-backup`;
      if (!await init.store.get(backupKey)) await init.store.put(snapshot, backupKey);
      snapshot = upgraded;
      await init.store.put(snapshot, 'state');
    } catch (error) {
      init.abort();
      await init.done.catch(() => {});
      database.close();
      throw error;
    }
  }
  await init.done;
  validateState(snapshot);
  await verifyAssessmentHashes(snapshot.assessments);

  async function update(mutator) {
    const transaction = database.transaction('meta', 'readwrite');
    try {
      const state = await transaction.store.get('state');
      assert(state.schemaVersion === SCHEMA_VERSION, 'Reload Sprich to update this version of progress.');
      const result = mutator(state) ?? state;
      result.updatedAt = now();
      await transaction.store.put(result, 'state');
      await transaction.done;
      snapshot = result;
      return snapshot;
    } catch (error) {
      try { transaction.abort(); } catch { /* Transaction may already have aborted. */ }
      await transaction.done.catch(() => {});
      throw new Error(`Progress could not be saved. ${error.message}`, { cause: error });
    }
  }

  const updateStarter = edit => update(state => { edit(state.starter, state); validateStarter(state.starter); });

  return {
    persistent: true,
    get state() { return snapshot; },
    async refresh() { snapshot = validateState(await database.get('meta', 'state')); return snapshot; },
    update,
    ...assessmentStore({ update, database, state: () => snapshot, now }),
    async startAssessmentConversation(attemptId) {
      let conversationId;
      await update(state => {
        const attempt = state.assessments.attempts.find(item => item.id === attemptId);
        assert(attempt && ['prepared', 'in_progress'].includes(attempt.state), 'Start a new assessment attempt.');
        if (attempt.aiSessionId) { conversationId = attempt.aiSessionId; return; }
        const conversation = createAssessedAIConversation(attempt, assessmentDefinition(state.assessments, attempt), { now: now() });
        validateAIConversation(conversation);
        state.aiSessions.push(conversation); attempt.aiSessionId = conversation.id; attempt.state = 'in_progress';
        attempt.startedAt ??= now(); attempt.updatedAt = now(); conversationId = conversation.id;
      });
      return conversationId;
    },
    getCoursePack(id) { return database.get('coursePacks', id); },
    async putCoursePack(pack) {
      validatePack(pack);
      await database.put('coursePacks', pack, pack.id);
    },
    async pruneCoursePacks(keep) {
      const stale = (await database.getAllKeys('coursePacks')).filter(key => !keep.includes(key));
      if (!stale.length) return;
      const tx = database.transaction('coursePacks', 'readwrite');
      stale.forEach(key => tx.store.delete(key));
      await tx.done;
    },
    async addStarterSession(session) {
      validateStarterSession(session);
      return updateStarter(starter => { if (!starter.sessions.some(item => item.id === session.id)) starter.sessions.push(structuredClone(session)); });
    },
    async updateStarterSession(id, edit) {
      return updateStarter(starter => { const session = starter.sessions.find(item => item.id === id); assert(session, 'This beginner lesson could not be found.'); edit(session); session.updatedAt = now(); });
    },
    async saveStarterDraft(id, taskId, draft) {
      return this.updateStarterSession(id, session => {
        if (!session.completedAt && !session.responses.some(response => response.taskId === taskId)) session.drafts[taskId] = structuredClone(draft);
      });
    },
    async saveStarterResponse(id, taskId, draft, outcome) {
      return this.updateStarterSession(id, session => {
        if (session.responses.some(response => response.taskId === taskId)) return;
        assert(!session.completedAt, 'This lesson is already complete. Start a new variation to practise again.');
        const task = starterSteps(session).find(step => step.id === taskId);
        assert(task, 'Unknown lesson step.');
        session.responses.push(starterResponse(session, task, draft, outcome, now()));
      });
    },
    async finishStarterSession(id) {
      return this.updateStarterSession(id, session => { assert(starterCanFinish(session), 'Try each spoken task before finishing.'); session.completedAt ??= now(); });
    },
    async addWordSession(session) {
      return updateStarter(starter => { if (!starter.wordSessions.some(item => item.id === session.id)) starter.wordSessions.push(structuredClone(session)); });
    },
    async saveWordDraft(id, wordId, draft) {
      return updateStarter(starter => {
        const session = starter.wordSessions.find(item => item.id === id);
        assert(session, 'This word practice could not be found.');
        if (!starter.reviews.some(review => review.id === `${id}:${wordId}`)) session.drafts[wordId] = structuredClone(draft);
        session.updatedAt = now();
      });
    },
    async saveWordReview(id, wordId, draft, outcome) {
      return updateStarter((starter, state) => {
        const session = starter.wordSessions.find(item => item.id === id);
        assert(session, 'This word practice could not be found.');
        const word = session.words.find(item => item.id === wordId);
        assert(word, 'This word is not in the saved practice.');
        if (!starter.reviews.some(review => review.id === `${id}:${wordId}`)) starter.reviews.push(wordReview(session, word, draft, outcome, dateKey(now(), state.preferences.timeZone), now()));
        session.cursor = Math.max(session.cursor, session.words.indexOf(word) + 1);
        session.updatedAt = now();
        if (session.cursor === session.words.length) session.completedAt ??= now();
      });
    },
    async saveWord(id, saved) {
      return updateStarter(starter => { const index = starter.wordMarks.findIndex(item => item.id === id); const mark = { id, saved, updatedAt: now() };
        if (index < 0) starter.wordMarks.push(mark); else starter.wordMarks[index] = mark; });
    },
    async ensureStarterPlan(course) {
      const day = dateKey(now(), snapshot.preferences.timeZone);
      const existing = snapshot.starter.plans.find(plan => plan.id === day);
      if (existing) return existing;
      await updateStarter((starter, state) => { if (!starter.plans.some(plan => plan.id === day)) starter.plans.push(newStarterPlan(state, course, day, now())); });
      return snapshot.starter.plans.find(plan => plan.id === day);
    },
    async setStarterFocus(day, lessonId, wordIds) {
      return updateStarter(starter => { const plan = starter.plans.find(item => item.id === day); assert(plan, 'Open Today first.'); Object.assign(plan, { lessonId, wordIds: wordIds.slice(0, 5), updatedAt: now() }); });
    },
    async saveStarterReflection(day, text) {
      assert(typeof text === 'string' && text.trim() && text.length <= 2000, 'Write a short takeaway first.');
      return updateStarter(starter => { const plan = starter.plans.find(item => item.id === day); assert(plan, 'Open Today first.'); plan.reflection = text.trim(); plan.updatedAt = now(); });
    },
    async addSession(session) {
      return update(state => { if (!state.sessions.some(item => item.id === session.id)) state.sessions.push(session); });
    },
    async updateSession(id, edit) {
      return update(state => {
        const session = state.sessions.find(item => item.id === id);
        assert(session, 'This session could not be found.');
        edit(session);
        session.updatedAt = now();
      });
    },
    async saveDraft(sessionId, taskId, draft) {
      return update(state => {
        const session = state.sessions.find(item => item.id === sessionId);
        assert(session, 'This session could not be found.');
        if (!stateHasAttempt(state, sessionId, taskId)) {
          session.drafts[taskId] = structuredClone(draft);
          session.updatedAt = now();
        }
      });
    },
    async addAttempts(attempts) {
      attempts.forEach(validateAttempt);
      return update(state => {
        for (const attempt of attempts) {
          assert(state.sessions.some(session => session.id === attempt.sessionId), 'The response is missing its session.');
          if (!state.attempts.some(item => item.id === attempt.id)) state.attempts.push(structuredClone(attempt));
        }
      });
    },
    async addActivity(segments) {
      if (!segments.length) return snapshot;
      return update(state => {
        state.activity = mergeActivity(state.activity, segments);
      });
    },
    async setResourceState(id, patch) {
      return update(state => {
        const current = resourceState(state, id);
        const next = { ...current, ...patch, id, updatedAt: now() };
        assert(typeof next.bookmarked === 'boolean' && typeof next.unavailable === 'boolean' && ['unrated', 'easy', 'right', 'hard'].includes(next.difficulty), 'Invalid resource preference.');
        const index = state.resourceStates.findIndex(item => item.id === id);
        if (index < 0) state.resourceStates.push(next);
        else state.resourceStates[index] = next;
      });
    },
    async ensureDailyPlan() {
      const timestamp = now();
      const id = dateKey(timestamp, snapshot.preferences.timeZone);
      const existing = snapshot.dailyPlans?.find(plan => plan.id === id);
      const desired = refreshDailyPlan(snapshot, existing, timestamp);
      if (existing && JSON.stringify(existing) === JSON.stringify(desired)) return existing;
      await update(state => {
        state.dailyPlans ??= [];
        const index = state.dailyPlans.findIndex(plan => plan.id === id);
        const next = refreshDailyPlan(state, state.dailyPlans[index], timestamp);
        if (index < 0) state.dailyPlans.push(next);
        else state.dailyPlans[index] = next;
      });
      return snapshot.dailyPlans.find(plan => plan.id === id);
    },
    async saveReflection(day, text) {
      assert(typeof text === 'string' && text.trim() && text.length <= 2000, 'Write a short takeaway first (up to 2,000 characters).');
      return update(state => {
        const plan = state.dailyPlans?.find(item => item.id === day);
        assert(plan, 'Open Today to create this day’s plan first.');
        plan.reflection = text.trim();
        plan.reflectionAt = now();
        plan.updatedAt = now();
      });
    },
    async useDailyResource(resourceId) {
      return update(state => {
        const day = dateKey(now(), state.preferences.timeZone);
        const plan = state.dailyPlans?.find(item => item.id === day);
        if (plan) { plan.resourceId = resourceId; plan.updatedAt = now(); }
      });
    },
    async setDailyFocus(missionId) {
      assert(missionById(missionId), 'Choose an available mission for today.');
      return update(state => {
        const id = dateKey(now(), state.preferences.timeZone);
        const index = state.dailyPlans?.findIndex(plan => plan.id === id) ?? -1;
        assert(index >= 0, 'Open Today before changing its focus.');
        const old = state.dailyPlans[index];
        state.dailyPlans[index] = refreshDailyPlan(state, { ...old, missionId, resourceId: '', updatedAt: now() }, now());
      });
    },
    async addPersonalPhrase(values) {
      const phrase = await createPersonalPhrase(values, now());
      await update(state => { if (!state.personalPhrases.some(item => item.id === phrase.id)) state.personalPhrases.push(phrase); });
      return corePhrase(phrase.de, phrase.en)?.id ?? phrase.id;
    },
    async finishResource(sessionId, attempt) {
      validateAttempt(attempt);
      return update(state => {
        const session = state.sessions.find(item => item.id === sessionId);
        assert(session?.kind === 'resource' && attempt.sessionId === sessionId && attempt.resourceId === session.resourceId, 'This response belongs to a different resource activity.');
        if (!state.attempts.some(item => item.id === attempt.id)) state.attempts.push(attempt);
        session.completedAt ??= now();
        session.updatedAt = now();
      });
    },
    async addAIConversation(session) {
      validateAIConversation(session);
      return update(state => { if (!state.aiSessions.some(item => item.id === session.id)) state.aiSessions.push(structuredClone(session)); });
    },
    async updateAIConversation(id, edit) {
      return update(state => {
        const session = state.aiSessions.find(item => item.id === id);
        assert(session, 'This AI conversation could not be found.');
        edit(session); session.updatedAt = now(); validateAIConversation(session);
      });
    },
    async saveAIDraft(id, draft) {
      return this.updateAIConversation(id, session => {
        if (session.draft.status === 'sending' && session.draft.requestId === draft.requestId) {
          const payload = value => ({ text: value.text, operation: value.operation, recordingMs: value.recordingMs, audioKey: value.audioKey, supersedes: value.supersedes, createdAt: value.createdAt });
          assert(draft.status !== 'draft' && canonicalJSON(payload(session.draft)) === canonicalJSON(payload(draft)), 'This answer is being sent. Wait for its receipt before changing it.');
        }
        if (!session.endedAt && !session.turns.some(turn => turn.id === draft.requestId)) session.draft = structuredClone(draft);
      });
    },
    async completeAITurn(id, response) {
      return this.updateAIConversation(id, session => {
        if (session.turns.some(turn => turn.id === response.requestId)) return;
        assert(!session.endedAt && session.draft.requestId === response.requestId, 'A newer draft replaced this response.');
        session.turns.push(completedAITurn(session, response, now()));
        session.draft = newAIDraft(now());
      });
    },
    async saveAIReview(id, response) {
      return this.updateAIConversation(id, session => {
        assert(response.requestId === session.reviewRequestId, 'This review belongs to a different request.');
        const userTexts = activeAITurns(session).filter(turn => turn.operation === 'reply').map(turn => turn.transcript);
        const content = validateReview(response.review, userTexts);
        session.review = { content, model: response.model, promptVersion: response.promptVersion, completedAt: now() };
        session.reviewStatus = 'complete'; session.reviewError = ''; session.endedAt ??= now();
      });
    },
    async addCompanionNote(note) {
      assert(typeof note.text === 'string' && note.text.trim() && note.text.length <= 6000 && Number.isInteger(note.minutes) && note.minutes >= 0 && note.minutes <= 120, 'Write a reflection and use 0–120 minutes.');
      assert(missionById(note.missionId) || starterLessonById(note.missionId), 'Choose a valid lesson or mission.');
      return update(state => { if (!state.companionNotes.some(item => item.id === note.id)) state.companionNotes.push({ id: note.id, missionId: note.missionId, text: note.text.trim(), minutes: note.minutes, createdAt: now() }); });
    },
    async putRecording(key, blob) {
      assert(blob instanceof Blob && blob.size <= 15_000_000, 'This recording is too large to save.');
      const tx = database.transaction(['meta', 'recordings'], 'readwrite');
      try {
        const state = await tx.objectStore('meta').get('state');
        assert(!state.attempts.some(attempt => attempt.id === key), 'This answer was already graded in another tab. Its saved audio cannot be replaced.');
        assert(!state.aiSessions.some(session => session.turns.some(turn => turn.audioKey === key)), 'This recording belongs to a completed AI turn.');
        assert(!state.aiSessions.some(session => session.draft.status === 'sending' && session.draft.audioKey === key), 'This recording is being sent and cannot be replaced.');
        assert(!state.starter.sessions.some(session => session.responses.some(response => response.recordingKey === key)), 'This recording belongs to a saved beginner response.');
        assert(!state.assessments.attempts.some(attempt => attempt.submission?.kind === 'roleplay' && attempt.submission.turns.some(turn => turn.audioKey === key)), 'This recording belongs to a submitted assessment.');
        await tx.objectStore('recordings').put(blob, key);
        await tx.done;
      } catch (error) {
        try { tx.abort(); } catch { /* Already aborted. */ }
        await tx.done.catch(() => {});
        throw error;
      }
    },
    getRecording(key) { return database.get('recordings', key); },
    async deleteRecordings() { await database.clear('recordings'); await database.clear('ttsCache'); },
    async getTTS(key) {
      const item = await database.get('ttsCache', key);
      return item && now() - item.createdAt < 30 * 86_400_000 ? item.blob : null;
    },
    async putTTS(key, blob) {
      assert(blob instanceof Blob && blob.size > 0 && blob.size <= AI_LIMITS.speechBytes, 'Generated audio is empty or too large to cache.');
      const tx = database.transaction('ttsCache', 'readwrite');
      const keys = await tx.store.getAllKeys();
      if (keys.length >= 60 && !keys.includes(key)) await tx.store.delete(keys[0]);
      await tx.store.put({ blob, createdAt: now() }, key); await tx.done;
    },
    async recordingSize() {
      const records = await database.getAll('recordings');
      return records.reduce((size, blob) => size + blob.size, 0);
    },
    async export() {
      await this.refresh();
      return JSON.stringify({ app: 'sprich', format: 1, exportedAt: now(), state: snapshot }, null, 2);
    },
    async previousBackup() {
      for (let version = SCHEMA_VERSION - 1; version >= 2; version--) {
        const previous = await database.get('meta', `schema-${version}-backup`);
        if (previous) return JSON.stringify({ app: 'sprich', format: 1, state: previous }, null, 2);
      }
      return null;
    },
    async import(raw, useProfile = false) {
      const incoming = parseBackup(raw);
      await verifyAssessmentHashes(incoming.assessments);
      return update(state => mergeProgress(state, incoming, useProfile, now()));
    },
    close() { database.close(); },
  };
}

export function stateHasAttempt(state, sessionId, taskId) {
  return state.attempts.some(attempt => attempt.sessionId === sessionId && attempt.taskId === taskId);
}
