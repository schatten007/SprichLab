export const AI_API_VERSION = 'v1';
export const AI_MODELS = { chat: 'openai/gpt-oss-120b', transcription: 'whisper-large-v3', speech: 'eleven_multilingual_v2' };
export const AI_LIMITS = { clipMs: 60_000, clipBytes: 1_500_000, bodyBytes: 1_650_000, textChars: 3000, historyChars: 8000, historyTurns: 12, replyChars: 1500, dailyTurns: 40, minuteTurns: 3, dailyReviews: 6, speechChars: 800, speechBytes: 2_000_000, dailySpeechChars: 1500, monthlySpeechChars: 8000 };
export const AI_OPERATIONS = ['reply', 'rephrase', 'hint'];
export const AI_PROFILE_FIELDS = ['name', 'studies', 'experience', 'availability', 'start', 'motivation'];

export function ensure(condition, message) { if (!condition) throw new Error(message); }
export function isObject(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
export function isId(value) { return typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,160}$/.test(value); }
export function isText(value, max = 3000) { return typeof value === 'string' && value.length <= max; }
export function isTime(value) { return Number.isFinite(value) && value >= 0 && value <= 8.64e15; }

export function validateProfile(profile) {
  ensure(isObject(profile) && Object.keys(profile).every(key => AI_PROFILE_FIELDS.includes(key)), 'Choose only supported profile fields.');
  ensure(Object.values(profile).every(value => isText(value, 500)), 'Keep profile facts short.');
  ensure(Object.values(profile).join('').length <= 1800, 'Use at most 1,800 characters of profile context.');
  return profile;
}

export function validateTurnInput(input) {
  ensure(isObject(input), 'Provide a conversation turn.');
  ensure(isId(input.requestId) && isId(input.sessionId) && isId(input.missionId), 'Invalid conversation identifiers.');
  ensure(AI_OPERATIONS.includes(input.operation) && ['A2', 'B1'].includes(input.level), 'Choose a valid operation and level.');
  validateProfile(input.profile);
  ensure(isText(input.text, AI_LIMITS.textChars) && isText(input.opening, 1200), 'The response or opening is too long.');
  ensure(Array.isArray(input.history) && input.history.length <= AI_LIMITS.historyTurns, 'Start a new short conversation or reduce the history.');
  for (const turn of input.history) ensure(isObject(turn) && isText(turn.user, 3000) && isText(turn.assistant, AI_LIMITS.replyChars), 'Invalid conversation history.');
  ensure(input.history.reduce((sum, turn) => sum + turn.user.length + turn.assistant.length, 0) <= AI_LIMITS.historyChars, 'Conversation context is too long.');
  ensure(Number.isFinite(input.recordingMs) && input.recordingMs >= 0 && input.recordingMs <= AI_LIMITS.clipMs, 'Record at most 60 seconds per AI turn.');
  // Rebuild the object: the client cannot select a provider URL, system prompt, or model.
  return { requestId: input.requestId, sessionId: input.sessionId, missionId: input.missionId, operation: input.operation, level: input.level,
    profile: { ...input.profile }, text: input.text.trim(), opening: input.opening,
    history: input.history.map(turn => ({ user: turn.user, assistant: turn.assistant })), recordingMs: input.recordingMs };
}

export const REPLY_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['replyDe', 'meaningEn', 'action'],
  properties: { replyDe: { type: 'string' }, meaningEn: { type: 'string' }, action: { type: 'string', enum: ['question', 'clarify', 'acknowledge', 'finish'] } },
};
export function validateReply(reply) {
  ensure(isObject(reply) && Object.keys(reply).every(key => ['replyDe', 'meaningEn', 'action'].includes(key)), 'The AI reply did not match the expected format.');
  ensure(isText(reply.replyDe, AI_LIMITS.replyChars) && reply.replyDe.trim() && isText(reply.meaningEn, 1800), 'The AI reply was empty or too long.');
  ensure(['question', 'clarify', 'acknowledge', 'finish'].includes(reply.action), 'The AI returned an unknown conversation action.');
  ensure(reply.replyDe.trim().split(/\s+/u).length <= 100, 'The AI reply was too verbose.');
  return { replyDe: reply.replyDe.trim(), meaningEn: reply.meaningEn.trim(), action: reply.action };
}

const quoteSchema = { type: 'object', additionalProperties: false, required: ['quote', 'de', 'en'], properties: { quote: { type: 'string' }, de: { type: 'string' }, en: { type: 'string' } } };
const correctionSchema = { type: 'object', additionalProperties: false, required: ['original', 'corrected', 'explanationDe', 'explanationEn'], properties: { original: { type: 'string' }, corrected: { type: 'string' }, explanationDe: { type: 'string' }, explanationEn: { type: 'string' } } };
const phraseSchema = { type: 'object', additionalProperties: false, required: ['de', 'en', 'example'], properties: { de: { type: 'string' }, en: { type: 'string' }, example: { type: 'string' } } };
export const REVIEW_SCHEMA = { type: 'object', additionalProperties: false, required: ['strengths', 'corrections', 'phrases', 'retryDe', 'retryEn'], properties: {
  strengths: { type: 'array', items: quoteSchema }, corrections: { type: 'array', items: correctionSchema }, phrases: { type: 'array', items: phraseSchema }, retryDe: { type: 'string' }, retryEn: { type: 'string' },
} };
export function validateReview(review, userTexts = null) {
  ensure(isObject(review) && Array.isArray(review.strengths) && review.strengths.length <= 2 && Array.isArray(review.corrections) && review.corrections.length <= 2 && Array.isArray(review.phrases) && review.phrases.length <= 3, 'The AI review did not match the expected format.');
  ensure(isText(review.retryDe, 1200) && review.retryDe.trim() && isText(review.retryEn, 1200), 'The review needs a short retry task.');
  for (const item of review.strengths) ensure(isObject(item) && ['quote', 'de', 'en'].every(key => isText(item[key], 1000)) && item.quote.trim(), 'Invalid quoted strength.');
  for (const item of review.corrections) ensure(isObject(item) && ['original', 'corrected', 'explanationDe', 'explanationEn'].every(key => isText(item[key], 1000)) && item.original.trim() && item.corrected.trim(), 'Invalid correction.');
  for (const item of review.phrases) ensure(isObject(item) && ['de', 'en', 'example'].every(key => isText(item[key], 1000)) && item.de.trim() && item.en.trim(), 'Invalid phrase suggestion.');
  if (userTexts) {
    const quoted = text => userTexts.some(source => source.toLocaleLowerCase('de').replace(/\s+/g, ' ').includes(text.toLocaleLowerCase('de').replace(/\s+/g, ' ').trim()));
    ensure(review.strengths.every(item => quoted(item.quote)) && review.corrections.every(item => quoted(item.original)), 'The review quoted words that were not in your responses.');
  }
  return { strengths: review.strengths.map(item => ({ quote: item.quote, de: item.de, en: item.en })),
    corrections: review.corrections.map(item => ({ original: item.original, corrected: item.corrected, explanationDe: item.explanationDe, explanationEn: item.explanationEn })),
    phrases: review.phrases.map(item => ({ de: item.de, en: item.en, example: item.example })), retryDe: review.retryDe, retryEn: review.retryEn };
}

export function validateTurnResult(result) {
  ensure(isObject(result) && isId(result.requestId) && isId(result.sessionId), 'The AI response has an invalid turn ID.');
  ensure(['clear', 'unclear'].includes(result.inputStatus) && isText(result.transcript, AI_LIMITS.textChars), 'Invalid transcription response.');
  if (result.inputStatus === 'clear') validateReply(result.reply);
  ensure(isText(result.model, 150) && isText(result.promptVersion, 100), 'Missing AI response provenance.');
  return result;
}
