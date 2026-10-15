import { freezeLegacySession } from './legacy-session.js';
import { validateAIConversation, mergeAIConversations } from './ai-state.js';
import { emptyStarter, validateStarter, mergeStarter } from './starter-state.js';
import { emptyAssessments, validateAssessmentState, mergeAssessments, assertAssessmentConversationMerge } from './assessment-state.js';

export const SCHEMA_VERSION = 6;
export const DAY = 86_400_000;
export const PLAN_LENGTHS = [15, 30, 60, 90, 120];
export const PROFILE_FIELDS = ['name', 'studies', 'experience', 'availability', 'start', 'motivation'];
export const OUTCOMES = ['again', 'helped', 'independent', 'correct', 'incorrect', 'unscored'];
export const INPUT_MODES = ['recording', 'aloud', 'typed', 'selection'];
const formatters = new Map();

export function validTimeZone(zone) {
  try { new Intl.DateTimeFormat('en', { timeZone: zone }).format(); return typeof zone === 'string'; }
  catch { return false; }
}

export function dateKey(timestamp = Date.now(), timeZone = 'Europe/Berlin') {
  if (!formatters.has(timeZone)) {
    formatters.set(timeZone, new Intl.DateTimeFormat('en-CA', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    }));
  }
  const parts = Object.fromEntries(formatters.get(timeZone).formatToParts(timestamp).map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** Split real elapsed time at local midnights, including 23/25-hour DST days. */
export function splitActivity(start, end, timeZone, id, sessionId) {
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];
  const segments = [];
  let cursor = start;
  while (cursor < end) {
    const day = dateKey(cursor, timeZone);
    let boundary = end;
    if (dateKey(end - 1, timeZone) !== day) {
      let low = cursor + 1;
      let high = Math.min(end, cursor + 36 * 3_600_000);
      while (low < high) {
        const middle = Math.floor((low + high) / 2);
        if (dateKey(middle, timeZone) === day) low = middle + 1;
        else high = middle;
      }
      boundary = low;
    }
    segments.push({ id: `${id}:${segments.length}`, sessionId, start: cursor, end: boundary, day, ms: boundary - cursor });
    cursor = boundary;
  }
  return segments;
}

export function newState(now = Date.now(), timeZone = 'Europe/Berlin') {
  return {
    schemaVersion: SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
    profile: Object.fromEntries(PROFILE_FIELDS.map(field => [field, ''])),
    preferences: { dailyMinutes: 90, timeZone, voiceURI: '', speechRate: 0.9, theme: 'system', englishSupport: 'on-demand', aiVoice: 'device', aiLevel: 'A2', learningPath: 'starter' },
    sessions: [], attempts: [], activity: [], personalPhrases: [], resourceStates: [], dailyPlans: [], aiSessions: [], companionNotes: [], starter: emptyStarter(), assessments: emptyAssessments(), legacy: null,
  };
}

export function migrateLegacy(raw, now = Date.now()) {
  const state = newState(now);
  if (!raw) return state;
  let previous = null;
  try { previous = JSON.parse(raw); } catch { /* Preserve unreadable legacy text for recovery. */ }
  if (PLAN_LENGTHS.includes(previous?.planMin)) state.preferences.dailyMinutes = previous.planMin;
  state.legacy = {
    importedAt: now, raw, readable: previous !== null,
    assessmentCount: Array.isArray(previous?.assess) ? previous.assess.length : 0,
  };
  // Old auto-grades and estimated minutes cannot establish a trustworthy baseline.
  return state;
}

export function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function text(value, max = 6000) { return typeof value === 'string' && value.length <= max; }
function identifier(value) { return typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,200}$/.test(value); }
function timestamp(value) { return Number.isFinite(value) && value >= 0 && value <= 8.64e15; }
function stringList(value, max = 100) {
  return Array.isArray(value) && value.length <= max && value.every(item => text(item, 200));
}

export function safeSourceURL(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; }
  catch { return false; }
}

export function validatePhrase(phrase, personal = false) {
  assert(object(phrase) && identifier(phrase.id) && text(phrase.de, 500) && phrase.de.trim() && text(phrase.en, 1000) && phrase.en.trim(), 'Invalid phrase or meaning.');
  assert(text(phrase.cue) && text(phrase.example, 1500) && text(phrase.note) && stringList(phrase.tags, 20), 'Invalid phrase example or context.');
  for (const field of ['cueDe', 'noteDe', 'sourceId', 'sourceTitle', 'exampleSourceTitle']) assert(phrase[field] === undefined || text(phrase[field], 1500), 'Invalid phrase metadata.');
  if (personal) {
    assert(phrase.id.startsWith('personal-') && timestamp(phrase.createdAt), 'Invalid personal phrase ID or date.');
    assert(phrase.sourceUrl === '' || safeSourceURL(phrase.sourceUrl), 'Use an HTTPS source link for a personal phrase.');
    assert(phrase.exampleSourceUrl === undefined || phrase.exampleSourceUrl === '' || safeSourceURL(phrase.exampleSourceUrl), 'Use an HTTPS example source link.');
  }
  return phrase;
}

function validateTaskText(task) {
  for (const key of ['prompt', 'promptEn', 'rephrase', 'rephraseEn', 'goal', 'goalDe', 'model', 'modelEn']) {
    assert(task[key] === undefined || text(task[key], 12_000), 'Invalid lesson text.');
  }
  for (const key of ['criteria', 'criteriaDe']) assert(task[key] === undefined || stringList(task[key], 10), 'Invalid lesson reflection.');
}

export function validateContent(content, session) {
  assert(object(content) && text(content.version, 100) && object(content.mission), 'Missing or invalid lesson snapshot.');
  const mission = content.mission;
  assert(mission.id === session.missionId && text(mission.shortTitle, 200) && text(mission.goal) && text(mission.register, 100) && text(mission.icon, 50) && stringList(mission.resources, 20), 'Invalid saved mission details.');
  for (const key of ['title', 'goalDe', 'situation', 'situationDe']) assert(mission[key] === undefined || text(mission[key]), 'Invalid mission description.');
  assert(Array.isArray(content.phrases) && content.phrases.length <= 80, 'Invalid saved phrase collection.');
  content.phrases.forEach(phrase => validatePhrase(phrase));
  const phraseIds = new Set(content.phrases.map(phrase => phrase.id));
  assert(phraseIds.size === content.phrases.length, 'Duplicate saved phrase IDs.');
  assert(Array.isArray(content.tasks) && content.tasks.length > 0 && content.tasks.length <= 100, 'Invalid saved task sequence.');
  assert(session.cursor < content.tasks.length, 'The saved position is outside this lesson.');
  const taskIds = new Set();
  for (const task of content.tasks) {
    assert(object(task) && identifier(task.id) && !taskIds.has(task.id) && ['brief', 'listen', 'recall', 'shadow', 'speak', 'wrap', 'resource'].includes(task.kind), 'Invalid or duplicate lesson task.');
    taskIds.add(task.id);
    validateTaskText(task);
    if (task.kind === 'recall') assert(phraseIds.has(task.phraseId), 'A recall task is missing its saved phrase.');
    if (task.kind === 'speak') {
      assert(text(task.prompt) && text(task.rephrase) && text(task.goal) && text(task.model) && stringList(task.criteria, 10) && task.criteria.length === 3, 'Incomplete speaking task.');
      assert(stringList(task.phraseIds, 30) && task.phraseIds.every(id => phraseIds.has(id)), 'A speaking task is missing a phrase.');
      if (task.intents) assert(Array.isArray(task.intents) && task.intents.length <= 10 && task.intents.every(intent => identifier(intent.id) && text(intent.label, 300)), 'Invalid response choices.');
    }
    if (task.kind === 'listen') {
      const listening = task.listening;
      assert(object(listening) && text(listening.title, 300) && text(listening.transcript, 12_000), 'Invalid listening example.');
      assert(listening.transcriptEn === undefined || text(listening.transcriptEn, 12_000), 'Invalid listening translation.');
      assert(Array.isArray(listening.questions) && listening.questions.length > 0 && listening.questions.length <= 10, 'Invalid listening questions.');
      const questions = new Set();
      for (const question of listening.questions) {
        assert(identifier(question.id) && !questions.has(question.id) && text(question.question), 'Duplicate or invalid listening question.');
        questions.add(question.id);
        assert(stringList(question.options, 20) && question.options.length >= 2 && Number.isInteger(question.answer) && question.answer >= 0 && question.answer < question.options.length, 'Invalid listening answer key.');
        assert(question.questionEn === undefined || text(question.questionEn), 'Invalid question translation.');
        assert(question.optionsEn === undefined || (stringList(question.optionsEn, 20) && question.optionsEn.length === question.options.length), 'Invalid option translations.');
      }
    }
    if (task.branch) {
      assert(object(task.branch) && identifier(task.branch.from) && object(task.branch.options) && Object.keys(task.branch.options).length <= 10, 'Invalid dialogue branch.');
      for (const [intent, patch] of Object.entries(task.branch.options)) {
        assert(identifier(intent) && object(patch) && Object.keys(patch).every(key => ['prompt', 'promptEn', 'rephrase', 'rephraseEn', 'goal', 'goalDe', 'model', 'modelEn', 'criteria', 'criteriaDe'].includes(key)), 'Invalid branch override.');
        validateTaskText(patch);
      }
    }
  }
  for (const task of content.tasks) if (task.branch) assert(taskIds.has(task.branch.from), 'A dialogue branch is missing its preceding turn.');
  if (session.kind === 'resource') {
    assert(object(content.resource) && content.resource.id === session.resourceId && safeSourceURL(content.resource.url), 'Invalid saved resource.');
    assert(text(content.resource.title, 500) && text(content.resource.provider, 200) && text(content.resource.taskDe) && text(content.resource.taskEn), 'Incomplete resource activity.');
    assert(stringList(content.resource.stepsDe, 10) && stringList(content.resource.stepsEn, 10), 'Invalid resource guidance.');
    const resource = content.resource;
    assert(stringList(resource.formats, 10) && stringList(resource.missionIds, 30) && stringList(resource.phraseIds, 30), 'Invalid saved resource categories.');
    assert(['none', 'optional', 'required'].includes(resource.registration) && Number.isInteger(resource.practiceMinutes) && resource.practiceMinutes > 0 && resource.practiceMinutes <= 120, 'Invalid saved resource access or time.');
    for (const key of ['level', 'summaryDe', 'summaryEn', 'access', 'verification', 'checkedOn', 'transcript', 'voice']) assert(text(resource[key], 2000), 'Invalid saved resource description.');
  }
}

export function validateAttempt(attempt) {
  assert(object(attempt) && identifier(attempt.id), 'An attempt has an invalid ID.');
  assert(identifier(attempt.sessionId) && identifier(attempt.taskId) && identifier(attempt.missionId), 'An attempt has invalid references.');
  assert(['recall', 'listening', 'speaking', 'shadow', 'resource'].includes(attempt.kind), 'Unknown attempt type.');
  assert(OUTCOMES.includes(attempt.outcome), 'Unknown assessment outcome.');
  assert(['self', 'checked', 'practice'].includes(attempt.source), 'Unknown assessment source.');
  assert(INPUT_MODES.includes(attempt.inputMode), 'Unknown response mode.');
  assert(timestamp(attempt.completedAt) && /^\d{4}-\d{2}-\d{2}$/.test(attempt.day), 'An attempt has an invalid date.');
  assert(text(attempt.answer) && typeof attempt.hintUsed === 'boolean', 'An attempt has an invalid response.');
  assert(stringList(attempt.phraseIds, 30) && stringList(attempt.criteria, 10), 'An attempt has invalid phrase or rubric data.');
  assert(Number.isFinite(attempt.recordingMs) && attempt.recordingMs >= 0 && attempt.recordingMs <= 181_000, 'Invalid recording duration.');
  assert(text(attempt.focus, 100) && text(attempt.intent, 100), 'Invalid reflection data.');
  assert(attempt.kind !== 'listening' || (attempt.source === 'checked' && ['correct', 'incorrect'].includes(attempt.outcome)), 'Listening needs a checked answer.');
  assert(attempt.kind !== 'speaking' || attempt.source === 'self', 'Open speaking must be labelled self-assessed.');
  assert(!['recall', 'speaking'].includes(attempt.kind) || (attempt.source === 'self' && ['again', 'helped', 'independent'].includes(attempt.outcome)), 'Recall and speaking need an explicit self-rating.');
  assert(attempt.kind !== 'shadow' || (attempt.source === 'practice' && attempt.outcome === 'unscored'), 'Shadowing is unscored practice.');
  if (attempt.kind === 'resource') {
    assert(attempt.source === 'practice' && attempt.outcome === 'unscored' && identifier(attempt.resourceId), 'Resource practice requires a source and an unscored artifact.');
    assert(Number.isInteger(attempt.externalMinutes) && attempt.externalMinutes >= 0 && attempt.externalMinutes <= 120, 'Reported external study time must be 0–120 minutes.');
    assert(attempt.answer.trim() || attempt.recordingMs > 0, 'Save a written response or recording before completing this activity.');
  }
  if (attempt.assistance) assert(object(attempt.assistance) && ['questionTranslation', 'answerTranslation'].every(key => typeof attempt.assistance[key] === 'boolean'), 'Invalid assistance details.');
  assert(attempt.inputMode === 'recording' || attempt.recordingMs === 0, 'Only a recording can have recorded time.');
  assert(attempt.outcome !== 'independent' || !attempt.hintUsed, 'An assisted response cannot be independent.');
  assert(attempt.kind !== 'speaking' || attempt.outcome !== 'independent' ||
    (attempt.inputMode !== 'typed' && attempt.criteria.length >= 3), 'Independent speaking needs spoken practice and a completed rubric.');
  return attempt;
}

/** Validate a whole backup before touching storage. Avoid accepting arbitrary object graphs. */
export function validateState(state, { legacy = false, version = SCHEMA_VERSION } = {}) {
  const expected = legacy ? 2 : version;
  assert(object(state) && state.schemaVersion === expected, 'This progress file uses an unsupported version.');
  assert(timestamp(state.createdAt) && timestamp(state.updatedAt), 'Invalid progress timestamps.');
  assert(object(state.profile) && PROFILE_FIELDS.every(field => text(state.profile[field], 500)), 'Invalid learner profile.');
  const prefs = state.preferences;
  assert(object(prefs) && PLAN_LENGTHS.includes(prefs.dailyMinutes) && validTimeZone(prefs.timeZone), 'Invalid study preferences.');
  assert(text(prefs.voiceURI, 1000) && Number.isFinite(prefs.speechRate) && prefs.speechRate >= 0.6 && prefs.speechRate <= 1.2, 'Invalid voice preferences.');
  assert(['light', 'dark', 'system'].includes(prefs.theme), 'Invalid appearance preference.');
  if (!legacy) assert(['on-demand', 'always'].includes(prefs.englishSupport), 'Invalid English support preference.');
  if (expected >= 4) {
    assert(['device', 'natural'].includes(prefs.aiVoice) && ['A2', 'B1'].includes(prefs.aiLevel), 'Invalid AI preferences.');
    assert(Array.isArray(state.aiSessions) && state.aiSessions.length <= 2000, 'Invalid AI conversation collection.');
    state.aiSessions.forEach(validateAIConversation);
    assert(new Set(state.aiSessions.map(session => session.id)).size === state.aiSessions.length, 'Duplicate AI conversations.');
    assert(Array.isArray(state.companionNotes) && state.companionNotes.length <= 10_000, 'Invalid companion notes.');
    const noteIds = new Set();
    for (const note of state.companionNotes) {
      assert(object(note) && identifier(note.id) && !noteIds.has(note.id) && identifier(note.missionId) && timestamp(note.createdAt), 'Invalid companion note ID or date.');
      noteIds.add(note.id);
      assert(text(note.text, 6000) && note.text.trim() && Number.isInteger(note.minutes) && note.minutes >= 0 && note.minutes <= 120, 'Invalid companion reflection.');
    }
  }
  if (expected >= 5) {
    assert(['starter', 'work'].includes(prefs.learningPath), 'Choose the beginner or workplace learning path.');
    validateStarter(state.starter);
  }
  if (expected >= 6) {
    validateAssessmentState(state.assessments);
    for (const conversation of state.aiSessions.filter(session => session.assessmentRef)) {
      const attempt = state.assessments.attempts.find(item => item.id === conversation.assessmentRef.attemptId);
      assert(attempt?.aiSessionId === conversation.id && attempt.definitionHash === conversation.assessmentRef.definitionHash && attempt.mode === conversation.assessmentRef.mode, 'An assessed conversation is missing its matching attempt.');
    }
    for (const attempt of state.assessments.attempts) assert(attempt.aiSessionId === null || state.aiSessions.some(session => session.id === attempt.aiSessionId && session.assessmentRef?.attemptId === attempt.id), 'A roleplay assessment is missing its conversation.');
  }
  for (const key of ['sessions', 'attempts', 'activity']) {
    assert(Array.isArray(state[key]) && state[key].length <= 200_000, `Invalid ${key} list.`);
    const ids = new Set();
    for (const item of state[key]) {
      assert(object(item) && identifier(item.id) && !ids.has(item.id), `Duplicate or invalid ${key} ID.`);
      ids.add(item.id);
    }
  }
  for (const session of state.sessions) {
    assert(identifier(session.missionId) && (legacy ? ['mission', 'review'] : ['mission', 'review', 'resource']).includes(session.kind), 'Invalid session type.');
    assert(timestamp(session.createdAt) && timestamp(session.updatedAt) && (session.completedAt === null || timestamp(session.completedAt)), 'Invalid session date.');
    assert(Number.isInteger(session.cursor) && session.cursor >= 0 && session.cursor <= 100, 'Invalid session position.');
    assert(Number.isInteger(session.variant) && session.variant >= 0 && session.variant <= 1000, 'Invalid mission variation.');
    assert(session.short === undefined || typeof session.short === 'boolean', 'Invalid session length.');
    assert(session.paused === undefined || typeof session.paused === 'boolean', 'Invalid pause state.');
    assert(stringList(session.phraseIds, 50) && object(session.drafts) && object(session.profile), 'Invalid session content.');
    assert(PROFILE_FIELDS.every(field => text(session.profile[field], 500)), 'Invalid session profile.');
    if (!legacy) validateContent(session.content, session);
    for (const [key, draft] of Object.entries(session.drafts)) {
      assert(text(key, 100) && object(draft) && text(draft.text ?? '') && text(draft.intent ?? '', 100), 'Invalid saved response.');
      assert(stringList(draft.phraseIds ?? [], 30) && stringList(draft.criteria ?? [], 10), 'Invalid saved rubric.');
      assert(Number.isFinite(draft.recordingMs ?? 0) && (draft.recordingMs ?? 0) >= 0 && (draft.recordingMs ?? 0) <= 181_000, 'Invalid saved recording.');
      assert(text(draft.recordingKey ?? '', 300) && text(draft.focus ?? '', 100), 'Invalid saved response metadata.');
      assert(['aloud', 'revealed', 'hintUsed', 'attemptedBeforeReveal', 'listened', 'readInstead', 'phrasesRevealed', 'questionTranslation', 'answerTranslation', 'sourceOpened'].every(field => draft[field] === undefined || typeof draft[field] === 'boolean'), 'Invalid saved assistance state.');
      // Drafts may contain an unfinished numeric edit. Completed resource attempts
      // enforce the integer 0–120 range; a temporary invalid edit must not break reload.
      assert(draft.externalMinutes === undefined || Number.isFinite(draft.externalMinutes), 'Invalid reported study time draft.');
      assert(draft.answers === undefined || (object(draft.answers) && Object.values(draft.answers).every(value => Number.isInteger(value) && value >= 0 && value <= 20)), 'Invalid saved listening answers.');
    }
  }
  state.attempts.forEach(validateAttempt);
  const sessionIds = new Set([...state.sessions.map(session => session.id), ...(expected >= 4 ? state.aiSessions.map(session => session.id) : []),
    ...(expected >= 5 ? [...state.starter.sessions, ...state.starter.wordSessions].map(session => session.id) : []),
    ...(expected >= 6 ? state.assessments.attempts.map(attempt => attempt.id) : [])]);
  for (const attempt of state.attempts) assert(sessionIds.has(attempt.sessionId), 'An attempt is missing its session.');
  for (const event of state.activity) {
    assert(sessionIds.has(event.sessionId) && timestamp(event.start) && timestamp(event.end) && event.end > event.start, 'Invalid activity interval.');
    assert(Number.isFinite(event.ms) && event.ms === event.end - event.start && event.ms <= 60_000, 'Invalid active practice duration.');
    assert(/^\d{4}-\d{2}-\d{2}$/.test(event.day), 'Invalid activity day.');
  }
  assert(state.legacy === null || (object(state.legacy) && text(state.legacy.raw, 10_000_000)), 'Invalid legacy backup.');
  if (!legacy) {
    assert(Array.isArray(state.personalPhrases) && state.personalPhrases.length <= 10_000, 'Invalid personal phrase collection.');
    state.personalPhrases.forEach(phrase => validatePhrase(phrase, true));
    assert(new Set(state.personalPhrases.map(phrase => phrase.id)).size === state.personalPhrases.length, 'Duplicate personal phrases.');
    assert(Array.isArray(state.resourceStates) && state.resourceStates.length <= 10_000, 'Invalid resource preferences.');
    const ids = new Set();
    for (const item of state.resourceStates) {
      assert(object(item) && identifier(item.id) && !ids.has(item.id) && timestamp(item.updatedAt), 'Invalid or duplicate resource preference.');
      ids.add(item.id);
      assert(typeof item.bookmarked === 'boolean' && typeof item.unavailable === 'boolean' && ['unrated', 'easy', 'right', 'hard'].includes(item.difficulty), 'Invalid resource difficulty or bookmark.');
    }
    assert(state.dailyPlans === undefined || (Array.isArray(state.dailyPlans) && state.dailyPlans.length <= 5000), 'Invalid daily plans.');
    const planIds = new Set();
    for (const plan of state.dailyPlans ?? []) {
      assert(object(plan) && /^\d{4}-\d{2}-\d{2}$/.test(plan.id) && !planIds.has(plan.id), 'Invalid or duplicate daily plan.');
      planIds.add(plan.id);
      assert(timestamp(plan.createdAt) && timestamp(plan.updatedAt) && PLAN_LENGTHS.includes(plan.minutes), 'Invalid daily plan date or budget.');
      assert(identifier(plan.missionId) && (plan.resourceId === '' || identifier(plan.resourceId)) && stringList(plan.reviewPhraseIds, 30), 'Invalid daily plan references.');
      assert(text(plan.reflection, 2000) && (plan.reflectionAt === null || timestamp(plan.reflectionAt)), 'Invalid daily reflection.');
    }
  }
  return state;
}

export function upgradeState(raw) {
  if (raw?.schemaVersion === SCHEMA_VERSION) return validateState(raw);
  if (raw?.schemaVersion === 5) {
    validateState(raw, { version: 5 });
    return validateState({ ...structuredClone(raw), schemaVersion: SCHEMA_VERSION, assessments: emptyAssessments() });
  }
  const starterUpgrade = state => {
    state.schemaVersion = SCHEMA_VERSION;
    state.preferences.learningPath = 'starter';
    state.starter = emptyStarter();
    state.assessments = emptyAssessments();
    return validateState(state);
  };
  if (raw?.schemaVersion === 4) {
    validateState(raw, { version: 4 });
    return starterUpgrade(structuredClone(raw));
  }
  if (raw?.schemaVersion === 3) {
    validateState(raw, { version: 3 });
    const state = structuredClone(raw);
    state.schemaVersion = SCHEMA_VERSION;
    state.preferences.aiVoice = 'device'; state.preferences.aiLevel = 'A2';
    state.aiSessions = []; state.companionNotes = [];
    return starterUpgrade(state);
  }
  validateState(raw, { legacy: true });
  const state = structuredClone(raw);
  state.schemaVersion = SCHEMA_VERSION;
  state.preferences.englishSupport = 'on-demand';
  state.personalPhrases = [];
  state.resourceStates = [];
  state.dailyPlans = [];
  state.preferences.aiVoice = 'device'; state.preferences.aiLevel = 'A2';
  state.aiSessions = []; state.companionNotes = [];
  for (const session of state.sessions) session.content = freezeLegacySession(session);
  return starterUpgrade(state);
}

export function parseBackup(raw) {
  assert(typeof raw === 'string' && raw.length <= 25_000_000, 'Choose a progress JSON file smaller than 25 MB.');
  let file;
  try { file = JSON.parse(raw); } catch { throw new Error('That file is not valid JSON. No progress was changed.'); }
  assert(file?.app === 'sprich' && file?.format === 1, 'Choose a Sprich progress export.');
  return upgradeState(file.state);
}

/** Immutable attempts are merged by ID; newer session cursors never undo a completion. */
export function mergeProgress(local, incoming, useProfile = false, now = Date.now()) {
  validateState(incoming);
  assertAssessmentConversationMerge(local, incoming);
  const merged = structuredClone(local);
  const sessions = new Map(local.sessions.map(session => [session.id, session]));
  for (const session of incoming.sessions) {
    const current = sessions.get(session.id);
    if (!current || (!current.completedAt && (session.completedAt || session.updatedAt > current.updatedAt))) {
      sessions.set(session.id, structuredClone(session));
    }
  }
  merged.sessions = [...sessions.values()];
  for (const key of ['attempts', 'personalPhrases']) {
    const records = new Map(local[key].map(item => [item.id, item]));
    for (const item of incoming[key]) if (!records.has(item.id)) records.set(item.id, structuredClone(item));
    merged[key] = [...records.values()];
  }
  const resourceStates = new Map(local.resourceStates.map(item => [item.id, item]));
  for (const item of incoming.resourceStates) if (!resourceStates.has(item.id) || item.updatedAt > resourceStates.get(item.id).updatedAt) resourceStates.set(item.id, structuredClone(item));
  merged.resourceStates = [...resourceStates.values()];
  const plans = new Map((local.dailyPlans ?? []).map(plan => [plan.id, plan]));
  for (const plan of incoming.dailyPlans ?? []) if (!plans.has(plan.id) || plan.updatedAt > plans.get(plan.id).updatedAt) plans.set(plan.id, structuredClone(plan));
  merged.dailyPlans = [...plans.values()];
  merged.aiSessions = mergeAIConversations(local.aiSessions, incoming.aiSessions);
  const notes = new Map(local.companionNotes.map(note => [note.id, note]));
  for (const note of incoming.companionNotes) if (!notes.has(note.id)) notes.set(note.id, structuredClone(note));
  merged.companionNotes = [...notes.values()];
  merged.starter = mergeStarter(local.starter, incoming.starter);
  merged.assessments = mergeAssessments(local.assessments, incoming.assessments);
  merged.activity = mergeActivity(local.activity, incoming.activity);
  if (useProfile) {
    merged.profile = structuredClone(incoming.profile);
    merged.preferences = structuredClone(incoming.preferences);
  }
  merged.legacy ??= incoming.legacy;
  merged.updatedAt = now;
  return validateState(merged);
}

/** A clock run uses one mutable interval per minute, rather than 12 new rows/minute. */
export function mergeActivity(existing, incoming) {
  const events = new Map(existing.map(event => [event.id, event]));
  for (const event of incoming) {
    const current = events.get(event.id);
    if (!current) events.set(event.id, event);
    else if (current.day === event.day && current.sessionId === event.sessionId &&
      event.start <= current.end && event.end >= current.start) {
      const start = Math.min(current.start, event.start);
      const end = Math.max(current.end, event.end);
      events.set(event.id, { ...current, start, end, ms: end - start });
    }
  }
  return [...events.values()];
}

export function previousDay(day, offset = 1) {
  return new Date(Date.parse(`${day}T12:00:00Z`) - offset * DAY).toISOString().slice(0, 10);
}

export function progressStats(state, now = Date.now()) {
  const today = dateKey(now, state.preferences.timeZone);
  const days = new Map();
  const intervals = new Map();
  for (const event of state.activity) {
    if (!intervals.has(event.day)) intervals.set(event.day, []);
    intervals.get(event.day).push([event.start, event.end]);
  }
  for (const [day, spans] of intervals) {
    spans.sort((a, b) => a[0] - b[0]);
    let total = 0;
    let end = -Infinity;
    for (const [start, finish] of spans) {
      total += Math.max(0, finish - Math.max(start, end));
      end = Math.max(end, finish);
    }
    days.set(day, total);
  }
  const weekStart = previousDay(today, 6);
  const weekMs = [...days].filter(([day]) => day >= weekStart && day <= today).reduce((sum, [, ms]) => sum + ms, 0);
  let streak = 0;
  let cursor = (days.get(today) ?? 0) >= 15 * 60_000 ? today : previousDay(today);
  while ((days.get(cursor) ?? 0) >= 15 * 60_000) { streak++; cursor = previousDay(cursor); }
  const listening = state.attempts.filter(attempt => attempt.kind === 'listening' && !attempt.hintUsed);
  const speaking = state.attempts.filter(attempt => attempt.kind === 'speaking' && attempt.inputMode !== 'typed');
  const starterResponses = (state.starter?.sessions ?? []).flatMap(session => session.responses);
  return {
    today, days, todayMs: days.get(today) ?? 0, weekMs, streak,
    recordingMs: state.attempts.reduce((sum, attempt) => sum + attempt.recordingMs, 0) + starterResponses.reduce((sum, response) => sum + response.recordingMs, 0),
    speaking, listening,
    listeningPct: listening.length ? Math.round(100 * listening.filter(attempt => attempt.outcome === 'correct').length / listening.length) : null,
    completed: state.sessions.filter(session => session.completedAt),
    resourceActivities: state.attempts.filter(attempt => attempt.kind === 'resource'),
    externalMinutes: state.attempts.filter(attempt => attempt.kind === 'resource').reduce((total, attempt) => total + attempt.externalMinutes, 0),
    aiRecordedMs: (state.aiSessions ?? []).flatMap(session => session.turns).reduce((total, turn) => total + turn.recordingMs, 0),
    aiConversations: state.aiSessions ?? [], companionNotes: state.companionNotes ?? [],
    starterResponses,
  };
}
