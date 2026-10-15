import { missionById, phraseById, CONTENT_VERSION } from '../data/missions.js';
import { assert, dateKey, validateAttempt } from './model.js';
import { choosePhrases } from './srs.js';
import { buildGeminiPack, missionGeminiSource } from './gemini-pack.js';

export function createSession(state, missionId, { id = crypto.randomUUID(), now = Date.now(), phraseIds = null } = {}) {
  const mission = missionById(missionId);
  assert(mission, 'Choose one of the available missions.');
  const completed = state.sessions.filter(session => session.kind === 'mission' && session.missionId === missionId && session.completedAt).length;
  const session = {
    id, missionId, kind: phraseIds ? 'review' : 'mission', createdAt: now, updatedAt: now,
    completedAt: null, cursor: 0, variant: completed % 1000,
    phraseIds: phraseIds ?? choosePhrases(mission.phraseIds, state.attempts, state.preferences.dailyMinutes === 15 ? 2 : 6, now),
    short: state.preferences.dailyMinutes === 15,
    profile: structuredClone(state.profile), drafts: {},
  };
  const tasks = buildTasks(session, mission, state);
  const needed = new Set([...session.phraseIds, ...tasks.flatMap(task => task.phraseIds ?? [])]);
  session.content = structuredClone({
    version: CONTENT_VERSION,
    mission: { id: mission.id, shortTitle: mission.shortTitle, title: mission.title, titleDe: mission.titleDe ?? '', icon: mission.icon, register: mission.register,
      goal: mission.goal, goalDe: mission.goalDe ?? '', situation: mission.situation, situationDe: mission.situationDe ?? '', resources: mission.resources },
    phrases: [...needed].map(phraseId => phraseById(phraseId, state)).filter(Boolean), tasks,
  });
  return session;
}

function buildTasks(session, mission, state) {
  const recall = session.phraseIds.map(id => ({ id: `recall-${id}`, kind: 'recall', phraseId: id }));
  if (session.kind === 'review') {
    const phrase = phraseById(session.phraseIds[0], state);
    const reuse = phrase ? {
      id: 'reuse', kind: 'speak', prompt: `Benutze „${phrase.de}“ in einem eigenen Satz.`,
      promptEn: `Use “${phrase.de}” in a sentence about your own situation.`,
      rephrase: `Benutze „${phrase.de}“ in einem eigenen Satz.`,
      rephraseEn: `Use “${phrase.de}” in a sentence about your own situation.`,
      goal: 'Use one phrase in a new sentence about your own situation.',
      goalDe: 'Benutze eine Wendung in einem neuen Satz über deine eigene Situation.',
      model: phrase.example || phrase.de, modelEn: phrase.en,
      criteria: ['I used the target phrase or frame.', 'I added my own detail.', 'I could understand my answer on replay.'],
      criteriaDe: ['Ich habe die Wendung oder den Satzrahmen benutzt.', 'Ich habe ein eigenes Detail ergänzt.', 'Ich konnte meine Antwort beim Anhören verstehen.'],
      phraseIds: [phrase.id],
    } : null;
    return [...recall, ...(reuse ? [reuse] : []), { id: 'wrap', kind: 'wrap' }];
  }
  const turns = session.short ? mission.turns.filter(turn => turn.essential) : mission.turns;
  const result = [
    { id: 'brief', kind: 'brief' },
    { id: 'listen', kind: 'listen', listening: mission.listening[session.variant % mission.listening.length] },
    ...recall,
    ...(!session.short ? [{ id: 'shadow', kind: 'shadow', model: mission.shadow, modelEn: mission.shadowEn ?? '' }] : []),
    ...turns.map(turn => ({ ...turn, kind: 'speak', prompt: turn.prompts[session.variant % turn.prompts.length], promptEn: turn.promptsEn?.[session.variant % turn.prompts.length] ?? '' })),
    { ...(mission.retryTask ?? mission.turns[0]), id: 'retry', kind: 'speak', prompt: mission.retryTask?.prompt ?? 'Noch einmal: Erzählen Sie bitte in Ihren eigenen Worten.',
      goal: mission.retry, goalDe: mission.retryDe ?? '', retry: true, criteria: ['I covered the key information.', 'I needed fewer prompts or pauses.', 'I could understand my answer on replay.'],
      criteriaDe: ['Ich habe die wichtigen Informationen genannt.', 'Ich brauchte weniger Hilfe oder Pausen.', 'Meine Antwort war beim Anhören verständlich.'] },
    { id: 'wrap', kind: 'wrap' },
  ];
  return result;
}

export function tasksFor(session) {
  assert(session.content?.tasks, 'This session needs a content snapshot. Reload to migrate older progress.');
  return session.content.tasks.map(original => {
    const task = structuredClone(original);
    if (task.branch) {
      const intent = session.drafts[task.branch.from]?.intent;
      const patch = task.branch.options[intent];
      if (patch) Object.assign(task, patch);
    }
    return task;
  });
}

export function missionForSession(session) { return session.content.mission; }
export function phraseForSession(session, id) { return session.content.phrases.find(phrase => phrase.id === id); }

export function taskAttempts(state, sessionId, taskId) {
  return state.attempts.filter(attempt => attempt.sessionId === sessionId && attempt.taskId === taskId);
}

export function draftFor(session, taskId) {
  return { text: '', intent: '', criteria: [], phraseIds: [], focus: '', answers: {}, recordingMs: 0,
    recordingKey: '', aloud: false, revealed: false, hintUsed: false, attemptedBeforeReveal: false,
    listened: false, readInstead: false, questionTranslation: false, answerTranslation: false, externalMinutes: 0, sourceOpened: false,
    ...structuredClone(session.drafts[taskId] ?? {}) };
}

export function responseMode(draft) {
  if (draft.recordingMs > 0) return 'recording';
  if (draft.aloud) return 'aloud';
  return 'typed';
}

export function makeAttempt(session, task, draft, outcome, timeZone, now = Date.now()) {
  const isRecall = task.kind === 'recall';
  const kind = isRecall ? 'recall' : task.kind === 'shadow' ? 'shadow' : 'speaking';
  const inputMode = responseMode(draft);
  const hasResponse = draft.recordingMs > 0 || draft.aloud || draft.text.trim().length > 0;
  assert(hasResponse || outcome === 'again', 'Record an answer, add a draft, or confirm that you practised aloud first.');
  assert(!task.intents || task.intents.some(intent => intent.id === draft.intent), 'Choose the option that matches what you said.');
  assert(outcome !== 'independent' || !draft.hintUsed, 'Use “Needed help” after looking at an answer hint.');
  assert(!isRecall || outcome !== 'independent' || draft.attemptedBeforeReveal, 'Try from memory before revealing the model.');
  assert(kind !== 'speaking' || outcome !== 'independent' || task.criteria.every(criterion => draft.criteria.includes(criterion)), 'Complete the reflection before choosing independent speaking.');
  const allowedPhrases = isRecall ? [task.phraseId] : task.phraseIds ?? [];
  return validateAttempt({
    id: `${session.id}:${task.id}`, sessionId: session.id, taskId: task.id, missionId: session.missionId,
    kind, outcome, source: kind === 'shadow' ? 'practice' : 'self', inputMode,
    completedAt: now, day: dateKey(now, timeZone), answer: draft.text.trim(),
    hintUsed: Boolean(draft.hintUsed), recordingMs: inputMode === 'recording' ? draft.recordingMs : 0,
    phraseIds: isRecall ? allowedPhrases : draft.phraseIds.filter(id => allowedPhrases.includes(id)),
    criteria: draft.criteria.filter(criterion => (task.criteria ?? []).includes(criterion)),
    focus: draft.focus, intent: draft.intent,
    assistance: { questionTranslation: Boolean(draft.questionTranslation), answerTranslation: Boolean(draft.answerTranslation) },
  });
}

export function checkListening(session, task, draft, timeZone, now = Date.now()) {
  assert(draft.listened || draft.readInstead, 'Listen to the example, or choose the reading alternative first.');
  return task.listening.questions.map(question => {
    const answer = draft.answers[question.id];
    assert(Number.isInteger(answer) && answer >= 0 && answer < question.options.length, 'Answer each question before checking.');
    return validateAttempt({
      id: `${session.id}:${task.id}:${question.id}`, sessionId: session.id, taskId: task.id,
      missionId: session.missionId, kind: 'listening', source: 'checked', inputMode: 'selection',
      outcome: answer === question.answer ? 'correct' : 'incorrect',
      completedAt: now, day: dateKey(now, timeZone), answer: question.options[answer],
      hintUsed: Boolean(draft.readInstead), recordingMs: 0, phraseIds: [], criteria: [], focus: '', intent: '',
      assistance: { questionTranslation: Boolean(draft.questionTranslation), answerTranslation: Boolean(draft.answerTranslation) },
    });
  });
}

export function voiceBrief(mission, profile, focus = '') {
  return buildGeminiPack(missionGeminiSource(mission), { level: 'A2', facts: profile, focus });
}
