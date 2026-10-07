import { AI_MODELS, AI_LIMITS, REPLY_SCHEMA, REVIEW_SCHEMA, validateReply, validateReview } from '../shared/ai-contracts.js';
import { conversationMessages, reviewMessages, PROMPT_VERSION, REVIEW_PROMPT_VERSION } from './prompts.js';
import { problem } from './errors.js';

async function boundedJSON(response, maxBytes = 100_000) {
  const body = await readLimited(response, maxBytes);
  try { return JSON.parse(new TextDecoder().decode(body)); } catch { throw problem(502, 'provider_format', 'The provider returned an unreadable response. Your input is saved.'); }
}

export async function readLimited(message, limit, timeoutMs = 10_000) {
  if (Number(message.headers.get('Content-Length') || 0) > limit) throw problem(413, 'too_large', 'This request is too large. Use a shorter clip.');
  const reader = message.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks = []; let size = 0;
  const deadline = Date.now() + timeoutMs;
  while (true) {
    let timer;
    let chunk;
    try {
      chunk = await Promise.race([reader.read(), new Promise((_, reject) => {
        timer = setTimeout(() => {
          // Reject first: cancelling the reader resolves the pending read with {done:true},
          // and Promise.race would otherwise treat a truncated body as a normal end of stream.
          reject(problem(504, 'body_timeout', 'The request body stopped arriving. Your local draft is still available.'));
          void reader.cancel().catch(() => {});
        }, Math.max(1, deadline - Date.now()));
      })]);
    } finally { clearTimeout(timer); }
    const { done, value } = chunk;
    if (done) break;
    size += value.byteLength;
    if (size > limit) { await reader.cancel(); throw problem(413, 'too_large', 'This request is too large. Use a shorter clip.'); }
    chunks.push(value);
  }
  const result = new Uint8Array(size); let position = 0;
  for (const chunk of chunks) { result.set(chunk, position); position += chunk.byteLength; }
  return result;
}

async function call(fetcher, url, options, ms = 20_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const response = await fetcher(url, { ...options, signal: controller.signal });
    if (response.status === 429) throw problem(429, 'provider_quota', 'The provider’s free allowance or rate limit was reached. Wait, use device speech, or continue with Gemini Companion.', Math.max(1, Math.min(3600, Number(response.headers.get('Retry-After')) || 60)));
    if ([401, 403].includes(response.status)) throw problem(503, 'provider_credentials', 'The provider rejected its configured key. Check the server-side connection settings.');
    if (!response.ok) throw problem(502, 'provider_error', 'The provider could not complete the request. Your draft is saved.');
    return response;
  } catch (error) {
    if (error.status) throw error;
    throw problem(504, 'provider_timeout', 'The provider did not finish in time. Its request status may be uncertain; check for the reply before a new attempt.');
  } finally { clearTimeout(timer); }
}

export async function transcribe(fetcher, env, audio, filename) {
  const form = new FormData();
  form.set('file', audio, filename); form.set('model', AI_MODELS.transcription); form.set('language', 'de'); form.set('response_format', 'verbose_json');
  form.set('prompt', 'Ein kurzes Gespräch auf Deutsch für eine Werkstudentenstelle.');
  const response = await call(fetcher, 'https://api.groq.com/openai/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: `Bearer ${env.GROQ_API_KEY}` }, body: form });
  const value = await boundedJSON(response);
  if (Number(value.duration ?? 0) > 65) throw problem(413, 'clip_too_long', 'Use at most 60 seconds for each AI turn.');
  const silent = Array.isArray(value.segments) && value.segments.length > 0 && value.segments.every(segment => Number(segment.no_speech_prob) >= .85);
  const text = typeof value.text === 'string' ? value.text.trim() : '';
  if (!text || silent) return '';
  if (text.length > AI_LIMITS.textChars) throw problem(422, 'transcript_too_long', 'The transcript is too long. Try a shorter answer.');
  return text;
}

async function completion(fetcher, env, messages, schema, name, maxTokens) {
  const response = await call(fetcher, 'https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST', headers: { Authorization: `Bearer ${env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: AI_MODELS.chat, messages, temperature: .5, reasoning_effort: 'low', max_completion_tokens: maxTokens,
      response_format: { type: 'json_schema', json_schema: { name, strict: true, schema } } }),
  });
  const value = await boundedJSON(response);
  const content = value.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || value.choices?.[0]?.finish_reason === 'length') throw problem(502, 'provider_format', 'The AI response was incomplete. Your input is saved.');
  let parsed;
  try { parsed = JSON.parse(content); } catch { throw problem(502, 'provider_format', 'The AI response could not be validated.'); }
  return { parsed, usage: { inputTokens: Number(value.usage?.prompt_tokens) || 0, outputTokens: Number(value.usage?.completion_tokens) || 0 } };
}

export async function reply(fetcher, env, input, transcript) {
  const { parsed, usage } = await completion(fetcher, env, conversationMessages(input, transcript), REPLY_SCHEMA, 'german_reply', 700);
  try { return { reply: validateReply(parsed), usage, model: AI_MODELS.chat, promptVersion: PROMPT_VERSION }; }
  catch { throw problem(502, 'provider_format', 'The reply did not meet the short-conversation format. Try again with your saved input.'); }
}
export async function review(fetcher, env, input) {
  const { parsed, usage } = await completion(fetcher, env, reviewMessages(input), REVIEW_SCHEMA, 'german_review', 1800);
  try { return { review: validateReview(parsed, input.history.map(turn => turn.user)), usage, model: AI_MODELS.chat, promptVersion: REVIEW_PROMPT_VERSION }; }
  catch { throw problem(502, 'review_evidence', 'The review could not be grounded in your actual words. No corrections were added. You can request a new review.'); }
}

export async function capabilities(fetcher, env) {
  const response = await call(fetcher, 'https://api.groq.com/openai/v1/models', { headers: { Authorization: `Bearer ${env.GROQ_API_KEY}` } }, 10_000);
  const value = await boundedJSON(response, 300_000);
  const ids = new Set((value.data ?? []).map(model => model.id));
  return { chatAvailable: ids.has(AI_MODELS.chat), transcriptionAvailable: ids.has(AI_MODELS.transcription), billing: 'Owner-declared Free account; provider billing is managed in its own console.' };
}

export async function freeSpeech(fetcher, env, text) {
  // An account reporting any paid tier is rejected, rather than consuming paid credits.
  const account = await boundedJSON(await call(fetcher, 'https://api.elevenlabs.io/v1/user/subscription', { headers: { 'xi-api-key': env.ELEVENLABS_API_KEY } }, 10_000));
  if (account?.tier !== 'free' || account.can_extend_character_limit !== false) throw problem(409, 'speech_not_free', 'Natural speech is enabled only for a confirmed ElevenLabs Free account without credit extensions. Device speech is available.');
  const { character_limit: limit, character_count: used } = account;
  if (!Number.isInteger(limit) || !Number.isInteger(used) || limit < 0 || used < 0 || limit - used < text.length) {
    throw problem(429, 'speech_quota', 'The free natural-voice allowance is exhausted or could not be verified. Device speech is available.', 3600);
  }
  const response = await call(fetcher, `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(env.ELEVENLABS_VOICE_ID)}?output_format=mp3_44100_128`, {
    method: 'POST', headers: { 'xi-api-key': env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({ text, model_id: AI_MODELS.speech, language_code: 'de', voice_settings: { stability: .55, similarity_boost: .5 } }),
  });
  const contentType = response.headers.get('Content-Type')?.split(';')[0] ?? '';
  if (!['audio/mpeg', 'audio/mp3', 'audio/wav'].includes(contentType)) throw problem(502, 'speech_format', 'Natural speech returned an unsupported format.');
  const bytes = await readLimited(response, AI_LIMITS.speechBytes);
  if (!bytes.length) throw problem(502, 'speech_format', 'Natural speech returned empty audio. Device speech is available.');
  return { bytes, contentType };
}
