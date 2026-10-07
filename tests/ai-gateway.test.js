import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ReadableStream } from 'node:stream/web';
import { createAIClient } from '../app/js/ai-gateway.js';
import { createGateway } from '../worker/index.js';
import { sqliteD1 } from '../worker/sqlite-adapter.js';
import { sha256 } from '../worker/auth.js';
import { createMockProvider, TEST_ACCESS_CODE, TEST_SESSION_SECRET } from '../tools/mock-ai-provider.js';

const ORIGIN = 'http://localhost:8787';

async function fixture(t) {
  const db = sqliteD1(':memory:');
  db.exec(await readFile(new URL('../worker/migrations/0001_ai.sql', import.meta.url), 'utf8'));
  t.after(() => db.close());
  const provider = createMockProvider();
  const gateway = createGateway({ fetcher: provider.fetch, testMode: true });
  const env = { AI_DB: db, OWNER_TOKEN_HASH: await sha256(TEST_ACCESS_CODE), SESSION_SECRET: TEST_SESSION_SECRET,
    GROQ_API_KEY: 'fixture-only', GROQ_FREE_TIER_CONFIRMED: 'true', ELEVENLABS_API_KEY: 'fixture-only', ELEVENLABS_VOICE_ID: 'fixture-voice' };
  const requests = [];
  let cookie = '';
  const client = createAIClient({ baseUrl: `${ORIGIN}/api/v1`, fetchImpl: async (url, options) => {
    requests.push({ url, ...options });
    // Supply the Origin and cookie that a browser adds, rather than asking production JS to set forbidden headers.
    const headers = new Headers(options.headers);
    if (options.method !== 'GET') headers.set('Origin', ORIGIN);
    if (cookie) headers.set('Cookie', cookie);
    const response = await gateway.fetch(new Request(url, { ...options, headers }), env);
    const issued = response.headers.get('Set-Cookie');
    if (issued) cookie = issued.split(';')[0];
    return response;
  } });
  await client.unlock(TEST_ACCESS_CODE);
  return { client, requests, provider };
}

test('the browser client sends speech as JSON and reads the real gateway audio response', async t => {
  const { client, requests } = await fixture(t);
  const audio = await client.speech('Guten Tag! Wie geht es Ihnen?');
  const sent = requests.find(request => request.url.endsWith('/speech'));
  assert.equal(new Headers(sent.headers).get('Content-Type'), 'application/json');
  assert.deepEqual(JSON.parse(sent.body), { text: 'Guten Tag! Wie geht es Ihnen?' });
  assert.equal(new Headers(sent.headers).has('Cookie'), false);
  assert.equal(new Headers(sent.headers).has('Origin'), false);
  assert.equal(audio.type, 'audio/wav');
  assert.ok(audio.size > 44, 'a decoded audio payload is returned, not a JSON envelope or empty response');
});

test('multipart turns still return JSON after separating request encoding from response decoding', async t => {
  const { client, requests } = await fixture(t);
  const result = await client.turn({ requestId: 'audio-client', sessionId: 'session-client', missionId: 'first-interview',
    operation: 'reply', level: 'A2', profile: {}, text: '', opening: 'Guten Tag!', history: [], recordingMs: 1000 },
  { audio: new Blob(['fixture audio'], { type: 'audio/webm' }), recordingMs: 1000 });
  assert.equal(result.inputStatus, 'clear');
  assert.equal(result.transcript, 'Ich kann montags und donnerstags arbeiten.');
  const sent = requests.find(request => request.url.endsWith('/turns'));
  assert.ok(sent.body instanceof FormData);
  assert.equal(new Headers(sent.headers).has('Content-Type'), false, 'the browser supplies the multipart boundary');
});

test('a static host or missing proxy reports an unavailable gateway instead of accepting an empty status', async () => {
  for (const response of [new Response('<html>Static host</html>'), Response.json({}), Response.json({ data: {}, meta: {} })]) {
    const client = createAIClient({ fetchImpl: async () => response });
    await assert.rejects(client.status(), error => error.code === 'invalid_response' && /gateway/i.test(error.message));
  }
});

test('speech errors preserve the free-tier reason and never treat an error page as playable audio', async () => {
  const limited = createAIClient({ fetchImpl: async () => Response.json({ code: 'speech_quota', detail: 'Free voice allowance reached.', retryAfterSeconds: 60 }, { status: 429 }) });
  await assert.rejects(limited.speech('Hallo.'), error => error.code === 'speech_quota' && error.retryAfterSeconds === 60);
  for (const response of [new Response('not audio'), new Response(null, { headers: { 'Content-Type': 'audio/mpeg' } })]) {
    const client = createAIClient({ fetchImpl: async () => response });
    await assert.rejects(client.speech('Hallo.'), error => error.code === 'speech_format');
  }
});

test('navigating away cancels speech while its response body is still downloading', async () => {
  const controller = new AbortController();
  let startBody;
  const started = new Promise(resolve => { startBody = resolve; });
  const client = createAIClient({ fetchImpl: async (_url, { signal }) => {
    const body = new ReadableStream({ start(stream) {
      signal.addEventListener('abort', () => stream.error(new DOMException('Aborted', 'AbortError')), { once: true });
      startBody();
    } });
    return new Response(body, { headers: { 'Content-Type': 'audio/mpeg' } });
  } });
  const pending = client.speech('Hallo.', { signal: controller.signal });
  await started;
  controller.abort();
  await assert.rejects(pending, error => error.code === 'cancelled');
});
