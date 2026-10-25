import { AI_LIMITS, AI_MODELS, validateTurnInput, isId, isObject, isText } from '../shared/ai-contracts.js';
import { missionById } from '../app/data/missions.js';
import { authConfigured, authenticated, verifyOwnerToken, issueSession, sessionCookie, securityHeaders, requireOrigin, sha256 } from './auth.js';
import { APIError, problem, errorResponse, restoreError } from './errors.js';
import { RequestLedger } from './ledger.js';
import * as providers from './providers.js';
import { PROMPT_VERSION } from './prompts.js';
import { loadWorkerAssessment } from './assessment-definitions.js';
import { evaluateAssessment, trustedAssessment } from './assessments.js';
import { ASSESSMENT_LIMITS } from '../shared/assessment-contracts.js';

const PREFIX = '/api/v1';
const AUDIO_TYPES = new Map([['audio/webm', 'webm'], ['audio/mp4', 'm4a'], ['audio/m4a', 'm4a'], ['audio/ogg', 'ogg'], ['audio/wav', 'wav'], ['audio/mpeg', 'mp3'], ['audio/mp3', 'mp3']]);
const limitValue = (value, fallback, max) => Math.min(max, Math.max(1, Number.parseInt(value, 10) || fallback));
const canonical = value => JSON.stringify(value, (_key, item) => isObject(item) ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
function success(data, status = 200, meta = {}) { return Response.json({ data, meta: { apiVersion: 'v1', ...meta } }, { status, headers: { 'Cache-Control': 'no-store' } }); }

async function jsonBody(request, max = 30_000) {
  const bytes = await providers.readLimited(request, max);
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch (error) {
    if (error instanceof APIError) throw error;
    throw problem(400, 'invalid_json', 'Send a valid JSON request.');
  }
}

async function turnBody(request, kind) {
  let raw; let audio = null; let extension = '';
  if ((request.headers.get('Content-Type') ?? '').startsWith('multipart/form-data')) {
    const bytes = await providers.readLimited(request, AI_LIMITS.bodyBytes);
    let form;
    try { form = await new Response(bytes, { headers: { 'Content-Type': request.headers.get('Content-Type') } }).formData(); }
    catch { throw problem(400, 'invalid_audio_form', 'The audio upload could not be read. Try your saved recording again.'); }
    try { raw = JSON.parse(String(form.get('metadata') ?? '')); } catch { throw problem(400, 'invalid_json', 'The audio request is missing valid metadata.'); }
    audio = form.get('audio');
    if (!(audio instanceof Blob) || !audio.size || audio.size > AI_LIMITS.clipBytes) throw problem(413, 'audio_size', 'Use an audio clip under 1.5 MB.');
    const mime = audio.type.split(';')[0].toLowerCase();
    extension = AUDIO_TYPES.get(mime);
    if (!extension) throw problem(415, 'audio_type', 'Use WebM, M4A, WAV, MP3 or OGG audio.');
  } else raw = await jsonBody(request);
  let input;
  try { input = validateTurnInput(raw); } catch (error) { throw problem(422, 'validation', error.message); }
  if (!input.assessmentRef && !missionById(input.missionId)) throw problem(422, 'mission', 'Choose one of Sprich’s current missions.');
  if (audio && (input.operation !== 'reply' || input.text || input.recordingMs <= 0)) throw problem(422, 'audio_metadata', 'An audio turn needs its recording duration and no separate text.');
  if (!audio && input.recordingMs !== 0) throw problem(422, 'audio_missing', 'The recording is missing. Re-record or send a text correction.');
  if (input.operation === 'reply' && !audio && !input.text && kind !== 'review') throw problem(422, 'empty_input', 'Record a response or enter a transcript first.');
  const audioHash = audio ? await sha256(await audio.arrayBuffer()) : '';
  return { input, audio, extension, hash: await sha256(canonical({ input, audioHash })) };
}

export function createGateway({ fetcher = (...args) => fetch(...args), now = Date.now, testMode = false, logger = console, loadAssessmentDefinition = loadWorkerAssessment, saveAudioConfig = null } = {}) {
  async function handle(request, env, execution = {}) {
    const path = new URL(request.url).pathname;
    if (!path.startsWith('/api/')) return env.ASSETS ? env.ASSETS.fetch(request) : new Response('Not found', { status: 404 });
    let requestId = '';
    try {
      if (!path.startsWith(`${PREFIX}/`)) throw problem(404, 'api_version', 'Use the v1 AI connection API.');
      if (!['GET', 'POST', 'DELETE'].includes(request.method)) throw problem(405, 'method', 'This method is not supported.');
      if (request.method !== 'GET') requireOrigin(request);
      const signedIn = await authenticated(request, env, now());
      const ledger = env.AI_DB ? new RequestLedger(env.AI_DB, now) : null;
      const limits = { ...AI_LIMITS,
        dailyTurns: limitValue(env.AI_DAILY_TURNS, AI_LIMITS.dailyTurns, 100), minuteTurns: limitValue(env.AI_MINUTE_TURNS, AI_LIMITS.minuteTurns, 100),
        dailyReviews: limitValue(env.AI_DAILY_REVIEWS, AI_LIMITS.dailyReviews, 50) };
      const configured = authConfigured(env) && Boolean(ledger);
      const groqReady = Boolean(env.GROQ_API_KEY) && env.GROQ_FREE_TIER_CONFIRMED === 'true';
      if (path === `${PREFIX}/status` && request.method === 'GET') {
        let databaseReady = false;
        if (ledger) { try { await ledger.count('health'); databaseReady = true; } catch { /* Setup status is useful before migrations. */ } }
        return securityHeaders(success({ configured: configured && databaseReady, authenticated: signedIn, groqReady,
          naturalVoiceConfigured: Boolean(env.ELEVENLABS_API_KEY && env.ELEVENLABS_VOICE_ID), naturalVoiceId: env.ELEVENLABS_VOICE_ID ?? '',
          testMode, models: AI_MODELS, limits,
          audioSetupAvailable: Boolean(saveAudioConfig),
          missing: [!authConfigured(env) && 'owner access code / signing secret', !databaseReady && 'request database and migrations', !env.GROQ_API_KEY && 'Groq API key', env.GROQ_FREE_TIER_CONFIRMED !== 'true' && 'owner confirmation of the Groq Free plan'].filter(Boolean) }), request);
      }
      if (!configured) throw problem(503, 'setup', 'The owner has not configured the AI gateway yet. Open the setup guide; Gemini Companion is available now.');
      if (path === `${PREFIX}/session` && request.method === 'POST') {
        const bucket = Math.floor(now() / 900_000);
        const addressHash = await sha256(request.headers.get('CF-Connecting-IP') ?? 'local');
        await ledger.consume(`auth:${addressHash.slice(0, 24)}:${bucket}`, limitValue(env.AI_AUTH_ATTEMPTS, 5, 1000), 1, 900_000);
        const input = await jsonBody(request, 2000);
        if (!await verifyOwnerToken(input?.token, env)) { logger.warn({ event: 'auth_failed' }); throw problem(401, 'authentication', 'The access code is invalid. Check the owner-provided code.'); }
        const response = success({ authenticated: true });
        response.headers.set('Set-Cookie', sessionCookie(await issueSession(env, now()), request.url));
        return securityHeaders(response, request);
      }
      if (path === `${PREFIX}/session` && request.method === 'DELETE') {
        const response = success({ authenticated: false }); response.headers.set('Set-Cookie', sessionCookie('', request.url, true));
        return securityHeaders(response, request);
      }
      if (!signedIn) throw problem(401, 'authentication', 'Unlock the private AI connection first.');
      const day = new Date(now()).toISOString().slice(0, 10);
      if (path === `${PREFIX}/setup/audio` && request.method === 'POST') {
        if (!saveAudioConfig) throw problem(503, 'setup_remote', 'Provider keys can only be saved by the local gateway. Use your host’s secret manager for a deployed gateway.');
        const input = await jsonBody(request, 5000);
        const config = {};
        const groqKey = typeof input?.groqApiKey === 'string' ? input.groqApiKey.trim() : '';
        const elevenLabsKey = typeof input?.elevenLabsApiKey === 'string' ? input.elevenLabsApiKey.trim() : '';
        const voiceId = typeof input?.elevenLabsVoiceId === 'string' ? input.elevenLabsVoiceId.trim() : '';
        if (groqKey) {
          if (groqKey.length > 500 || input.groqFreeTierConfirmed !== true) throw problem(422, 'validation', 'Confirm the Groq Free account before saving its key.');
          config.GROQ_API_KEY = groqKey;
          config.GROQ_FREE_TIER_CONFIRMED = 'true';
        }
        if (elevenLabsKey) {
          if (elevenLabsKey.length > 500) throw problem(422, 'validation', 'The ElevenLabs key is too long.');
          config.ELEVENLABS_API_KEY = elevenLabsKey;
        }
        if (voiceId) {
          if (voiceId.length > 200) throw problem(422, 'validation', 'The ElevenLabs voice ID is too long.');
          config.ELEVENLABS_VOICE_ID = voiceId;
        }
        if (!Object.keys(config).length) throw problem(422, 'validation', 'Enter a provider key or voice ID first.');
        await saveAudioConfig(config);
        Object.assign(env, config);
        return securityHeaders(success({ saved: true, groqReady: Boolean(env.GROQ_API_KEY) && env.GROQ_FREE_TIER_CONFIRMED === 'true', naturalVoiceConfigured: Boolean(env.ELEVENLABS_API_KEY && env.ELEVENLABS_VOICE_ID) }), request);
      }
      if (path === `${PREFIX}/usage` && request.method === 'GET') return securityHeaders(success({ day, resetAt: Date.parse(`${day}T00:00:00Z`) + 86_400_000,
        turnsUsed: await ledger.count(`turns:${day}`), reviewsUsed: await ledger.count(`reviews:${day}`), limits, testMode }), request);
      if (path === `${PREFIX}/capabilities` && request.method === 'GET') {
        if (!groqReady) throw problem(503, 'provider_setup', 'Configure a Groq Free account key and its server-side confirmation first.');
        await ledger.consume(`checks:${day}`, 12);
        return securityHeaders(success({ ...await providers.capabilities(fetcher, env), testMode }), request);
      }
      if (path.startsWith(`${PREFIX}/requests/`) && request.method === 'GET') {
        const id = path.slice(`${PREFIX}/requests/`.length);
        if (!isId(id)) throw problem(422, 'validation', 'Invalid request ID.');
        const receipt = await ledger.get(id);
        if (!receipt) throw problem(404, 'request_missing', 'No saved server request was found. Your local draft can be sent again.');
        if (receipt.status === 'complete') return securityHeaders(success(JSON.parse(receipt.response_json), 200, { cached: true }), request);
        if (receipt.status === 'pending' && receipt.lease_until > now()) return securityHeaders(success({ requestId: id, status: 'pending' }, 202), request);
        if (receipt.error_json) throw restoreError(JSON.parse(receipt.error_json));
        throw problem(409, 'uncertain', 'This request may have reached the provider but has no saved result. Start a new attempt only when you are ready.');
      }
      if (path === `${PREFIX}/speech` && request.method === 'POST') {
        if (!env.ELEVENLABS_API_KEY || !env.ELEVENLABS_VOICE_ID) throw problem(503, 'speech_setup', 'Natural speech is not configured. Device speech is available.');
        const input = await jsonBody(request, 5000);
        if (!isText(input?.text, AI_LIMITS.speechChars) || !input.text.trim()) throw problem(422, 'validation', `Natural speech accepts a short reply of at most ${AI_LIMITS.speechChars} characters.`);
        await ledger.consume(`speech-day:${day}`, AI_LIMITS.dailySpeechChars, input.text.length);
        await ledger.consume(`speech-month:${day.slice(0, 7)}`, AI_LIMITS.monthlySpeechChars, input.text.length, 35 * 86_400_000);
        const audio = await providers.freeSpeech(fetcher, env, input.text);
        return securityHeaders(new Response(audio.bytes, { headers: { 'Content-Type': audio.contentType } }), request);
      }
      if (path === `${PREFIX}/assessments/evaluations` && request.method === 'POST') {
        if (!groqReady) throw problem(503, 'provider_setup', 'Configure the Groq Free connection, or use a Gemini grading report.');
        const input = await jsonBody(request, ASSESSMENT_LIMITS.requestBytes);
        requestId = isId(input?.requestId) ? input.requestId : '';
        const result = await evaluateAssessment(input, { loadDefinition: loadAssessmentDefinition, request, env, ledger, limits, now, testMode, execution,
          grade: (definition, submission, mode) => providers.assess(fetcher, env, definition, submission, mode) });
        return securityHeaders(success(result.data, result.status, result.meta), request);
      }
      if (![`${PREFIX}/turns`, `${PREFIX}/reviews`].includes(path) || request.method !== 'POST') throw problem(404, 'not_found', 'This AI resource does not exist.');
      if (!groqReady) throw problem(503, 'provider_setup', 'The Groq Free connection is not configured. Use the setup guide or Gemini Companion.');
      const isReview = path.endsWith('/reviews');
      const parsed = await turnBody(request, isReview ? 'review' : 'turn');
      const { input, audio, extension, hash } = parsed;
      requestId = input.requestId;
      let assessedDefinition = null;
      if (input.assessmentRef) {
        if (isReview) throw problem(422, 'assessment_kind', 'Use the grading endpoint for assessed conversations.');
        assessedDefinition = await trustedAssessment({ id: input.assessmentRef.definitionId, version: input.assessmentRef.definitionVersion }, input.assessmentRef.definitionHash, loadAssessmentDefinition, { env, request });
        if (assessedDefinition.kind !== 'roleplay' || assessedDefinition.level !== input.level) throw problem(422, 'assessment_kind', 'The roleplay must use its published level and scenario.');
        if (input.assessmentRef.mode === 'checkpoint' && input.operation === 'hint') throw problem(422, 'assessment_support', 'Checkpoint answer hints are unavailable. You can ask to repeat or simplify the question.');
      }
      if (isReview && (audio || input.history.filter(turn => turn.user.trim()).length < 2)) throw problem(422, 'review_context', 'Have at least two spoken or typed exchanges before requesting a review.');
      const claim = await ledger.claim(requestId, hash, isReview ? 'review' : 'turn');
      if (!claim.claimed) return securityHeaders(claim.pending ? success({ requestId, status: 'pending' }, 202) : success(claim.response, 200, { cached: true }), request);
      const run = async () => {
        try {
          await ledger.consume(`${isReview ? 'reviews' : 'turns'}:${day}`, isReview ? limits.dailyReviews : limits.dailyTurns);
          await ledger.consume(`minute:${Math.floor(now() / 60_000)}`, limits.minuteTurns, 1, 60_000);
          let result;
          if (isReview) result = { requestId, sessionId: input.sessionId, ...await providers.review(fetcher, env, input), testMode };
          else {
            let transcript = input.text;
            if (audio) {
              transcript = claim.transcript ?? await providers.transcribe(fetcher, env, audio, `turn.${extension}`, Boolean(assessedDefinition));
              await ledger.saveTranscript(requestId, transcript);
            }
            result = input.operation === 'reply' && !transcript
              ? { requestId, sessionId: input.sessionId, inputStatus: 'unclear', transcript: '', model: AI_MODELS.chat, promptVersion: PROMPT_VERSION, testMode }
              : { requestId, sessionId: input.sessionId, inputStatus: 'clear', transcript, ...await providers.reply(fetcher, env, input, transcript, assessedDefinition), testMode };
            if (input.assessmentRef) result.assessmentRef = input.assessmentRef;
          }
          await ledger.finish(requestId, result);
          return result;
        } catch (error) {
          const status = error.code === 'provider_timeout' ? 'uncertain' : error.status === 429 ? 'retryable' : 'failed';
          throw await ledger.fail(requestId, error, status);
        }
      };
      const running = run();
      execution.waitUntil?.(running.catch(() => {}));
      const result = await running;
      execution.waitUntil?.(ledger.cleanup().catch(() => {}));
      return securityHeaders(success(result), request);
    } catch (error) {
      if (!(error instanceof APIError)) logger.error({ event: 'gateway_error', requestId });
      return securityHeaders(errorResponse(error, requestId), request);
    }
  }
  return { fetch: handle };
}

export default createGateway();
