import { validateState } from './model.js';
import { tasksFor } from './session.js';
import { starterSteps } from './starter-state.js';

const PREFIX = 'sprich-pending-draft:';

// A tiny synchronous journal closes the gap between typing and IndexedDB's
// asynchronous commit during a reload. Completed progress still lives in IndexedDB.
export function journalDraft(sessionId, taskId, draft, channel = 'mission') {
  const value = JSON.stringify({ sessionId, taskId, draft, channel, writtenAt: Date.now() });
  try { localStorage.setItem(PREFIX + sessionId, value); } catch { /* Normal async saving remains available. */ }
  return value;
}

export function clearJournal(sessionId, value) {
  try {
    const key = PREFIX + sessionId;
    if (localStorage.getItem(key) === value) localStorage.removeItem(key);
  } catch { /* IndexedDB has already committed the draft. */ }
}

export async function recoverDrafts(store) {
  let keys;
  try { keys = Object.keys(localStorage).filter(key => key.startsWith(PREFIX)); } catch { return; }
  for (const key of keys) {
    let raw = null;
    try {
      raw = localStorage.getItem(key);
      const journal = JSON.parse(raw);
      if (journal.channel === 'assessment') {
        const attempt = store.state.assessments.attempts.find(item => item.id === journal.sessionId);
        if (attempt && ['prepared', 'in_progress'].includes(attempt.state) && journal.taskId === 'draft' && journal.writtenAt >= attempt.updatedAt) {
          await store.saveAssessmentDraft(attempt.id, journal.draft);
        }
        clearJournal(journal.sessionId, raw);
        continue;
      }
      if (['starter', 'word'].includes(journal.channel)) {
        const field = journal.channel === 'starter' ? 'sessions' : 'wordSessions';
        const session = store.state.starter[field].find(item => item.id === journal.sessionId);
        const taskId = session && (journal.channel === 'starter' ? starterSteps(session)[session.cursor]?.id : session.words[session.cursor]?.id);
        if (session && !session.completedAt && taskId === journal.taskId && journal.writtenAt >= session.updatedAt) {
          const candidate = structuredClone(store.state);
          candidate.starter[field].find(item => item.id === session.id).drafts[taskId] = journal.draft;
          validateState(candidate);
          if (journal.channel === 'starter') await store.saveStarterDraft(session.id, taskId, journal.draft);
          else await store.saveWordDraft(session.id, taskId, journal.draft);
        }
        clearJournal(journal.sessionId, raw);
        continue;
      }
      const session = store.state.sessions.find(item => item.id === journal.sessionId);
      if (session && !session.completedAt && journal.writtenAt >= session.updatedAt &&
        tasksFor(session)[session.cursor]?.id === journal.taskId &&
        !store.state.attempts.some(attempt => attempt.sessionId === session.id && attempt.taskId === journal.taskId)) {
        const candidate = structuredClone(store.state);
        candidate.sessions.find(item => item.id === session.id).drafts[journal.taskId] = journal.draft;
        validateState(candidate);
        await store.saveDraft(session.id, journal.taskId, journal.draft);
      }
      clearJournal(journal.sessionId, raw);
    } catch {
      // Keep an unreadable journal for recovery rather than replacing stored work.
    }
  }
}
