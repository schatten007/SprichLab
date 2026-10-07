import { ensure, isId, isText, isObject, isTime } from '../../shared/ai-contracts.js';
import { starterLessonById } from '../data/starter-catalog.js';
import { validateStarterSnapshot, validateWord, lessonDialogues } from './starter-content.js';

export const WORD_MODES = ['meaning', 'recall', 'sentence'];
export const SUPPORT_MODES = ['guided', 'light'];
export const supportOf = session => (SUPPORT_MODES.includes(session?.support) ? session.support : 'guided');
export const emptyStarter = () => ({ sessions: [], wordSessions: [], reviews: [], wordMarks: [], plans: [] });
export const starterDraft = () => ({ text: '', aloud: false, recordingMs: 0, recordingKey: '', hintUsed: false, revealed: false, attempted: false });
export function starterSteps(session) {
  const lesson = session.content.lesson;
  const dialogues = lessonDialogues(lesson);
  return [{ id: 'warmup', kind: 'warmup' }, { id: 'words', kind: 'words' }, { id: 'patterns', kind: 'patterns' },
    { id: 'dialogue', kind: 'dialogue', dialogue: dialogues[session.variant % dialogues.length], alternates: dialogues.length },
    ...lesson.practice.map((task, index) => ({ ...task, id: `reply-${index + 1}`, kind: 'speak' })),
    { ...lesson.variations[session.variant % lesson.variations.length], id: 'variation', kind: 'speak' }, { id: 'finish', kind: 'finish' }];
}
export function createStarterSession(content, { now = Date.now(), id = crypto.randomUUID(), variant = 0, support = 'guided' } = {}) {
  validateStarterSnapshot(content);
  ensure(SUPPORT_MODES.includes(support), 'Choose a guided or lighter-support lesson.');
  return { id, lessonId: content.lesson.id, createdAt: now, updatedAt: now, completedAt: null, support,
    cursor: 0, variant: variant % 2, content: structuredClone(content), drafts: {}, responses: [] };
}
function validateDraft(draft) {
  ensure(isObject(draft) && isText(draft.text, 6000) && ['aloud', 'hintUsed', 'revealed', 'attempted'].every(key => typeof draft[key] === 'boolean'), 'Invalid beginner draft.');
  ensure(Number.isFinite(draft.recordingMs) && draft.recordingMs >= 0 && draft.recordingMs <= 181_000 && isText(draft.recordingKey, 300), 'Invalid beginner recording.');
}
export function starterResponse(session, task, draft, outcome, now = Date.now()) {
  validateDraft(draft);
  const spoken = draft.aloud || draft.recordingMs > 0;
  ensure(['helped', 'independent', 'again', 'unscored'].includes(outcome), 'Choose a speaking reflection.');
  ensure(outcome === 'again' || spoken, 'Say an answer aloud or record it first.');
  ensure(task.kind === 'warmup' ? outcome === 'unscored' : task.kind === 'speak' && outcome !== 'unscored', 'Use the appropriate reflection for this task.');
  ensure(outcome !== 'independent' || !draft.hintUsed, 'Choose Needed help after seeing a model answer.');
  return { id: `${session.id}:${task.id}`, taskId: task.id, outcome, spoken, hintUsed: draft.hintUsed,
    text: draft.text.trim(), recordingMs: draft.recordingMs, recordingKey: draft.recordingKey, completedAt: now };
}
export function starterCanFinish(session) {
  return starterSteps(session).filter(task => ['warmup', 'speak'].includes(task.kind)).every(task => session.responses.some(response => response.taskId === task.id));
}
export function validateStarterSession(session) {
  ensure(isObject(session) && isId(session.id) && starterLessonById(session.lessonId), 'Invalid beginner session ID.');
  ensure(isTime(session.createdAt) && isTime(session.updatedAt) && (session.completedAt === null || isTime(session.completedAt)), 'Invalid beginner session dates.');
  validateStarterSnapshot(session.content);
  ensure(session.content.lesson.id === session.lessonId && [0, 1].includes(session.variant), 'Invalid saved lesson variation.');
  ensure(session.support === undefined || SUPPORT_MODES.includes(session.support), 'Invalid saved support mode.');
  const steps = starterSteps(session);
  ensure(Number.isInteger(session.cursor) && session.cursor >= 0 && session.cursor < steps.length && isObject(session.drafts), 'Invalid beginner lesson position.');
  for (const [id, draft] of Object.entries(session.drafts)) { ensure(steps.some(step => step.id === id), 'Unknown beginner draft step.'); validateDraft(draft); }
  ensure(Array.isArray(session.responses) && session.responses.length <= 5 && new Set(session.responses.map(item => item.taskId)).size === session.responses.length, 'Invalid or duplicate beginner responses.');
  for (const response of session.responses) {
    const task = steps.find(step => step.id === response.taskId);
    ensure(task && response.id === `${session.id}:${task.id}` && isTime(response.completedAt) && typeof response.spoken === 'boolean', 'Invalid saved beginner response.');
    ensure(response.recordingMs === 0 || response.spoken, 'A recorded response must be identified as spoken practice.');
    starterResponse(session, task, { ...starterDraft(), text: response.text, aloud: response.spoken, hintUsed: response.hintUsed, recordingMs: response.recordingMs, recordingKey: response.recordingKey }, response.outcome, response.completedAt);
  }
  ensure(session.completedAt === null || starterCanFinish(session), 'Finish the spoken tasks before completing the lesson.');
  return session;
}
export function createWordSession(words, mode, { id = crypto.randomUUID(), now = Date.now() } = {}) {
  ensure(WORD_MODES.includes(mode) && words.length > 0 && words.length <= 10, 'Choose 1–10 words and a practice mode.');
  words.forEach(validateWord);
  return { id, mode, words: structuredClone(words), cursor: 0, drafts: {}, createdAt: now, updatedAt: now, completedAt: null };
}
export function wordReview(session, word, draft, outcome, day, now = Date.now()) {
  validateDraft(draft);
  ensure(['again', 'helped', 'independent'].includes(outcome), 'Choose a word recall rating.');
  ensure(draft.revealed, 'Compare with the meaning or model before saving your rating.');
  const spoken = draft.aloud || draft.recordingMs > 0;
  ensure(outcome !== 'independent' || (draft.attempted && !draft.hintUsed && (session.mode === 'meaning' || spoken)), 'Attempt before revealing; spoken recall needs an aloud attempt.');
  ensure(outcome === 'again' || session.mode !== 'sentence' || spoken || draft.text.trim(), 'Say or write your sentence first.');
  return { id: `${session.id}:${word.id}`, sessionId: session.id, wordId: word.id, mode: session.mode, outcome,
    hintUsed: draft.hintUsed, attempted: draft.attempted, spoken, answer: draft.text.trim(), day, completedAt: now };
}
export function validateStarter(starter) {
  ensure(isObject(starter), 'Missing beginner progress.');
  for (const key of ['sessions', 'wordSessions', 'reviews', 'wordMarks', 'plans']) {
    ensure(Array.isArray(starter[key]) && starter[key].length <= (key === 'reviews' ? 50_000 : 5000), 'Invalid beginner progress list.');
    ensure(new Set(starter[key].map(item => item.id)).size === starter[key].length && starter[key].every(item => isObject(item) && isId(item.id)), 'Duplicate or invalid beginner progress ID.');
  }
  starter.sessions.forEach(validateStarterSession);
  for (const session of starter.wordSessions) {
    ensure(WORD_MODES.includes(session.mode) && Array.isArray(session.words) && session.words.length > 0 && session.words.length <= 10 && new Set(session.words.map(word => word.id)).size === session.words.length, 'Invalid saved word practice.');
    session.words.forEach(validateWord);
    ensure(Number.isInteger(session.cursor) && session.cursor >= 0 && session.cursor <= session.words.length && isObject(session.drafts), 'Invalid word practice position.');
    ensure(isTime(session.createdAt) && isTime(session.updatedAt) && (session.completedAt === null || isTime(session.completedAt)), 'Invalid word practice dates.');
    ensure(session.completedAt === null ? session.cursor < session.words.length : session.cursor === session.words.length, 'Invalid word practice completion position.');
    for (const [id, draft] of Object.entries(session.drafts)) { ensure(session.words.some(word => word.id === id), 'Unknown word draft.'); validateDraft(draft); }
  }
  for (const review of starter.reviews) {
    const session = starter.wordSessions.find(item => item.id === review.sessionId);
    const word = session?.words.find(item => item.id === review.wordId);
    ensure(word && review.id === `${session.id}:${word.id}` && review.mode === session.mode && /^\d{4}-\d{2}-\d{2}$/.test(review.day) && isTime(review.completedAt), 'Invalid word review references.');
    ensure(typeof review.spoken === 'boolean', 'Invalid word review evidence.');
    wordReview(session, word, { ...starterDraft(), revealed: true, attempted: review.attempted, hintUsed: review.hintUsed, aloud: review.spoken, text: review.answer }, review.outcome, review.day, review.completedAt);
  }
  for (const session of starter.wordSessions) ensure(session.completedAt === null || session.words.every(word => starter.reviews.some(review => review.id === `${session.id}:${word.id}`)), 'Complete word reviews before closing the session.');
  starter.wordMarks.forEach(mark => ensure(typeof mark.saved === 'boolean' && isTime(mark.updatedAt), 'Invalid saved word.'));
  starter.plans.forEach(plan => ensure(/^\d{4}-\d{2}-\d{2}$/.test(plan.id) && starterLessonById(plan.lessonId) && Array.isArray(plan.wordIds) && plan.wordIds.length <= 5 && plan.wordIds.every(isId) && isTime(plan.createdAt) && isTime(plan.updatedAt) && isText(plan.reflection, 2000), 'Invalid beginner daily plan.'));
  return starter;
}

export function mergeStarter(local, remote) {
  const result = structuredClone(local);
  for (const key of ['wordMarks', 'plans']) {
    const records = new Map(result[key].map(item => [item.id, item]));
    for (const item of remote[key]) if (!records.has(item.id) || item.updatedAt > records.get(item.id).updatedAt) records.set(item.id, structuredClone(item));
    result[key] = [...records.values()];
  }
  const reviews = new Map(result.reviews.map(item => [item.id, item]));
  for (const item of remote.reviews) if (!reviews.has(item.id)) reviews.set(item.id, structuredClone(item));
  result.reviews = [...reviews.values()];
  for (const key of ['sessions', 'wordSessions']) {
    const sessions = new Map(result[key].map(item => [item.id, item]));
    for (const item of remote[key]) {
      const current = sessions.get(item.id);
      if (!current) { sessions.set(item.id, structuredClone(item)); continue; }
      const latest = item.updatedAt > current.updatedAt ? structuredClone(item) : current;
      latest.cursor = Math.max(current.cursor, item.cursor);
      latest.completedAt = current.completedAt ?? item.completedAt;
      if (key === 'sessions') {
        const responses = new Map(current.responses.map(response => [response.id, response]));
        for (const response of item.responses) if (!responses.has(response.id)) responses.set(response.id, structuredClone(response));
        latest.responses = [...responses.values()];
      }
      sessions.set(item.id, latest);
    }
    result[key] = [...sessions.values()];
  }
  return validateStarter(result);
}
