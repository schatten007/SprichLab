import { AI_MODELS } from '../shared/ai-contracts.js';

export const TEST_ACCESS_CODE = 'test-only-owner-token-'.padEnd(43, '0');
export const TEST_SESSION_SECRET = 'test-only-session-secret-000000000000000000000';

function wav() {
  const samples = 8000;
  const bytes = new Uint8Array(44 + samples * 2);
  const data = new DataView(bytes.buffer);
  const ascii = (offset, value) => [...value].forEach((char, index) => data.setUint8(offset + index, char.charCodeAt(0)));
  ascii(0, 'RIFF'); data.setUint32(4, bytes.length - 8, true); ascii(8, 'WAVE'); ascii(12, 'fmt ');
  data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, 1, true);
  data.setUint32(24, 16000, true); data.setUint32(28, 32000, true); data.setUint16(32, 2, true); data.setUint16(34, 16, true);
  ascii(36, 'data'); data.setUint32(40, samples * 2, true);
  for (let i = 0; i < samples; i++) data.setInt16(44 + i * 2, Math.sin(i / 16000 * Math.PI * 440) * 1200, true);
  return bytes;
}

/** Deliberately simple fixtures. The gateway and UI always identify this as test mode. */
export function createMockProvider() {
  const calls = [];
  return {
    calls,
    async fetch(url, options = {}) {
      calls.push({ url, method: options.method ?? 'GET' });
      if (url.endsWith('/models')) return Response.json({ data: [{ id: AI_MODELS.chat }, { id: AI_MODELS.transcription }] });
      if (url.endsWith('/audio/transcriptions')) return Response.json({ text: 'Ich kann montags und donnerstags arbeiten.', duration: 1, segments: [{ no_speech_prob: .01 }] });
      if (url.endsWith('/chat/completions')) {
        const body = JSON.parse(options.body);
        const last = body.messages.at(-1).content;
        if (last.includes('quota-fixture')) return Response.json({ error: 'quota' }, { status: 429, headers: { 'Retry-After': '2' } });
        if (last.includes('uncertain-fixture')) throw new Error('Network fixture');
        const isReview = body.response_format.json_schema.name === 'german_review';
        let answer;
        if (isReview) {
          const history = JSON.parse(last).conversation;
          answer = { strengths: [{ quote: history[0].user, de: 'Du hast eine konkrete Information genannt.', en: 'You gave specific information.' }], corrections: [],
            phrases: [{ de: 'Ich gebe Ihnen morgen Bescheid.', en: 'I will let you know tomorrow.', example: 'Ich prüfe meinen Kalender und gebe Ihnen morgen Bescheid.' }], retryDe: 'Erkläre deine Verfügbarkeit noch einmal mit anderen Tagen.', retryEn: 'Explain your availability again using different days.' };
        } else if (body.messages.some(message => message.content.includes('Please rephrase the last question'))) answer = { replyDe: 'An welchen Tagen haben Sie Zeit?', meaningEn: 'On which days are you available?', action: 'clarify' };
        else if (last.includes('small answer hint')) answer = { replyDe: 'Du kannst beginnen: Ich kann an zwei Tagen pro Woche arbeiten.', meaningEn: 'You can start: I can work on two days a week.', action: 'acknowledge' };
        else answer = { replyDe: 'Danke. Wie viele Stunden könnten Sie an diesen Tagen arbeiten?', meaningEn: 'Thank you. How many hours could you work on those days?', action: 'question' };
        return Response.json({ choices: [{ message: { content: JSON.stringify(answer) }, finish_reason: 'stop' }], usage: { prompt_tokens: 120, completion_tokens: 50 } });
      }
      if (url.endsWith('/user/subscription')) return Response.json({ tier: 'free', character_count: 0, character_limit: 10_000, can_extend_character_limit: false });
      if (url.includes('/text-to-speech/')) return new Response(wav(), { headers: { 'Content-Type': 'audio/wav' } });
      throw new Error('Unexpected fixture endpoint');
    },
  };
}
