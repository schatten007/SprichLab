import { missionById, CONTENT_VERSION } from '../data/missions.js';
import { AI_LIMITS, AI_OPERATIONS, AI_PROFILE_FIELDS, ensure, isObject, isText, isId, isTime, validateProfile, validateReply, validateReview, validateTurnResult } from '../../shared/ai-contracts.js';
import { buildGeminiPack, missionGeminiSource } from './gemini-pack.js';
import { ASSESSMENT_LEVELS, validateAssessmentRef, validateSupportEvents, canonicalJSON, validateAssessmentDefinition } from '../../shared/assessment-contracts.js';

export function newAIDraft(now = Date.now()) {
  return { requestId: crypto.randomUUID(), operation: 'reply', text: '', recordingMs: 0, audioKey: '', status: 'draft', supersedes: '', createdAt: now, error: '' };
}

export function createAIConversation(state, missionId, { id = crypto.randomUUID(), now = Date.now(), fields = ['studies', 'experience', 'availability'], level = 'A2' } = {}) {
  const mission = missionById(missionId);
  ensure(mission, 'Choose a mission for AI practice.');
  const profile = Object.fromEntries(fields.filter(field => AI_PROFILE_FIELDS.includes(field) && state.profile[field]).map(field => [field, state.profile[field]]));
  validateProfile(profile);
  return {
    id, missionId, createdAt: now, updatedAt: now, endedAt: null, level,
    context: { title: mission.shortTitle, goal: mission.goal, register: mission.register.startsWith('Sie') ? 'Sie' : 'du', contentVersion: CONTENT_VERSION,
      openingDe: mission.turns[0].prompts[0], openingEn: mission.turns[0].promptsEn?.[0] ?? '', profile },
    turns: [], draft: newAIDraft(now), review: null, reviewRequestId: crypto.randomUUID(), reviewStatus: 'idle', reviewError: '',
  };
}

export function createAssessedAIConversation(attempt, definition, { id = crypto.randomUUID(), now = Date.now() } = {}) {
  validateAssessmentDefinition(definition);
  ensure(definition.kind === 'roleplay' && attempt.execution === 'in_app' && !attempt.submission, 'Choose an unsubmitted in-app roleplay.');
  const s = definition.scenario;
  return { id, missionId: null, assessmentRef: { attemptId: attempt.id, definitionId: definition.id, definitionVersion: definition.version,
    definitionHash: attempt.definitionHash, mode: attempt.mode }, assessmentEvents: [], createdAt: now, updatedAt: now, endedAt: null, level: definition.level,
    context: { title: definition.title, goal: definition.instructions.slice(0, 2000), register: s.register, contentVersion: definition.version,
      openingDe: s.openingDe, openingEn: s.openingEn, profile: {} },
    turns: [], draft: newAIDraft(now), review: null, reviewRequestId: crypto.randomUUID(), reviewStatus: 'idle', reviewError: '' };
}

export function activeAITurns(session) {
  const replaced = new Set(session.turns.map(turn => turn.supersedes).filter(Boolean));
  return session.turns.filter(turn => !replaced.has(turn.id));
}
export function aiHistory(session, supersedes = '') {
  const history = [];
  let chars = 0;
  for (const turn of activeAITurns(session).filter(turn => turn.id !== supersedes).slice().reverse()) {
    const user = turn.operation === 'reply' ? turn.transcript : turn.operation === 'hint' ? 'Bitte gib mir eine kleine Hilfe für meine Antwort.' : 'Bitte formuliere die letzte Frage einfacher.';
    const size = user.length + turn.replyDe.length;
    if (chars + size > AI_LIMITS.historyChars || history.length >= AI_LIMITS.historyTurns) break;
    history.unshift({ user, assistant: turn.replyDe }); chars += size;
  }
  return history;
}
export function aiPayload(session) {
  const draft = session.draft;
  return { requestId: draft.requestId, sessionId: session.id, missionId: session.missionId, operation: draft.operation, level: session.level,
    ...(session.assessmentRef ? { assessmentRef: session.assessmentRef } : {}),
    profile: session.context.profile, opening: session.context.openingDe, text: draft.text,
    history: aiHistory(session, draft.supersedes), recordingMs: draft.recordingMs };
}
export function completedAITurn(session, result, now = Date.now()) {
  validateTurnResult(result);
  ensure(result.inputStatus === 'clear' && result.requestId === session.draft.requestId && result.sessionId === session.id, 'This response belongs to a different or unclear turn.');
  ensure(canonicalJSON(session.assessmentRef ?? null) === canonicalJSON(result.assessmentRef ?? null), 'The reply belongs to a different assessment.');
  const draft = session.draft;
  return { id: result.requestId, operation: draft.operation, supersedes: draft.supersedes, createdAt: draft.createdAt, completedAt: now,
    transcript: result.transcript, ...validateReply(result.reply), recordingMs: draft.recordingMs, audioKey: draft.audioKey,
    inputMode: draft.recordingMs > 0 ? 'transcribed' : 'typed',
    model: result.model, promptVersion: result.promptVersion,
    usage: { inputTokens: Number(result.usage?.inputTokens) || 0, outputTokens: Number(result.usage?.outputTokens) || 0 } };
}

export function validateAIConversation(session) {
  const assessed = Boolean(session?.assessmentRef);
  if (assessed) { validateAssessmentRef(session.assessmentRef); validateSupportEvents(session.assessmentEvents); }
  ensure(isObject(session) && isId(session.id) && (assessed ? session.missionId === null : isId(session.missionId)), 'Invalid AI conversation ID.');
  ensure(isTime(session.createdAt) && isTime(session.updatedAt) && (session.endedAt === null || isTime(session.endedAt)), 'Invalid AI conversation date.');
  ensure((assessed ? ASSESSMENT_LEVELS : ['A2', 'B1']).includes(session.level), 'Invalid AI practice level.');
  const context = session.context;
  ensure(isObject(context) && isText(context.title, 200) && isText(context.goal, 2000) && ['Sie', 'du'].includes(context.register) && isText(context.contentVersion, 100), 'Invalid AI lesson snapshot.');
  ensure(isText(context.openingDe, 1200) && isText(context.openingEn, 1500), 'Invalid opening question.');
  validateProfile(context.profile);
  ensure(Array.isArray(session.turns) && session.turns.length <= 100, 'Too many saved conversation turns.');
  const ids = new Set();
  for (const turn of session.turns) {
    ensure(isObject(turn) && isId(turn.id) && !ids.has(turn.id) && AI_OPERATIONS.includes(turn.operation), 'Invalid or duplicate AI turn.');
    ids.add(turn.id);
    ensure(turn.supersedes === '' || (isId(turn.supersedes) && ids.has(turn.supersedes) && turn.supersedes !== turn.id), 'An edited turn must reference an earlier turn.');
    ensure(isText(turn.transcript, AI_LIMITS.textChars) && isTime(turn.createdAt) && isTime(turn.completedAt), 'Invalid AI transcript or time.');
    validateReply({ replyDe: turn.replyDe, meaningEn: turn.meaningEn, action: turn.action });
    ensure(Number.isFinite(turn.recordingMs) && turn.recordingMs >= 0 && turn.recordingMs <= AI_LIMITS.clipMs && isText(turn.audioKey, 200), 'Invalid AI recording metadata.');
    ensure(isText(turn.model, 150) && isText(turn.promptVersion, 100), 'Invalid model provenance.');
    ensure(turn.inputMode === undefined && !assessed || ['typed', 'transcribed'].includes(turn.inputMode), 'Invalid learner input provenance.');
    ensure(isObject(turn.usage) && ['inputTokens', 'outputTokens'].every(key => Number.isFinite(turn.usage[key]) && turn.usage[key] >= 0), 'Invalid usage metadata.');
  }
  const draft = session.draft;
  ensure(isObject(draft) && isId(draft.requestId) && AI_OPERATIONS.includes(draft.operation) && isText(draft.text, AI_LIMITS.textChars), 'Invalid AI draft.');
  ensure(Number.isFinite(draft.recordingMs) && draft.recordingMs >= 0 && draft.recordingMs <= AI_LIMITS.clipMs && isText(draft.audioKey, 200), 'Invalid draft audio.');
  ensure(['draft', 'sending', 'error', 'uncertain'].includes(draft.status) && isTime(draft.createdAt) && isText(draft.error, 1000), 'Invalid AI draft state.');
  ensure(draft.supersedes === '' || ids.has(draft.supersedes), 'Invalid transcript revision.');
  ensure(isId(session.reviewRequestId) && ['idle', 'sending', 'error', 'uncertain', 'complete'].includes(session.reviewStatus) && isText(session.reviewError, 1000), 'Invalid AI review state.');
  if (session.review !== null) {
    ensure(isTime(session.review.completedAt) && isText(session.review.model, 150) && isText(session.review.promptVersion, 100), 'Invalid review provenance.');
    validateReview(session.review.content, activeAITurns(session).filter(turn => turn.operation === 'reply').map(turn => turn.transcript));
  }
  return session;
}

export function mergeAIConversations(local = [], incoming = []) {
  const sessions = new Map(local.map(session => [session.id, structuredClone(session)]));
  for (const remote of incoming) {
    const current = sessions.get(remote.id);
    if (!current) { sessions.set(remote.id, structuredClone(remote)); continue; }
    ensure(canonicalJSON(current.assessmentRef ?? null) === canonicalJSON(remote.assessmentRef ?? null), 'These conversations belong to different assessments.');
    const turnMap = new Map(current.turns.map(turn => [turn.id, turn]));
    for (const turn of remote.turns) if (!turnMap.has(turn.id)) turnMap.set(turn.id, structuredClone(turn));
    const merged = remote.updatedAt > current.updatedAt ? structuredClone(remote) : current;
    const parents = new Map([...turnMap.values()].map(turn => [turn.id, turn.supersedes]));
    const depthOf = id => { let depth = 0; let cursor = id; const visited = new Set();
      while (parents.get(cursor) && !visited.has(cursor)) { visited.add(cursor); cursor = parents.get(cursor); depth += 1; }
      return depth; };
    const depth = new Map([...parents.keys()].map(id => [id, depthOf(id)]));
    // An edited turn always follows the turn it replaces, whatever the two devices' clocks say.
    merged.turns = [...turnMap.values()].sort((a, b) => depth.get(a.id) - depth.get(b.id) || a.completedAt - b.completedAt || a.id.localeCompare(b.id));
    merged.endedAt = current.endedAt ?? remote.endedAt;
    if (merged.assessmentRef) merged.assessmentEvents = [...new Map([...(current.assessmentEvents ?? []), ...(remote.assessmentEvents ?? [])].map(event => [event.id, event])).values()];
    merged.review ??= current.review ?? remote.review;
    if (merged.turns.some(turn => turn.id === merged.draft.requestId)) merged.draft = newAIDraft();
    sessions.set(remote.id, merged);
  }
  return [...sessions.values()];
}

export function companionBrief(mission, profile, level = 'A2') {
  return buildGeminiPack(missionGeminiSource(mission), { level, facts: profile });
}
