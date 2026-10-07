import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createGateway } from '../worker/index.js';
import { sqliteD1 } from '../worker/sqlite-adapter.js';
import { sha256 } from '../worker/auth.js';
import { createMockProvider, TEST_ACCESS_CODE, TEST_SESSION_SECRET } from './mock-ai-provider.js';

const testMode = process.argv.includes('--test');
const port = Number(process.env.AI_GATEWAY_PORT || 8787);
const fileEnv = {};
if (!testMode) {
  try {
    const text = await readFile(new URL('../.dev.vars', import.meta.url), 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (match) fileEnv[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
    }
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  await mkdir(new URL('../.local/', import.meta.url), { recursive: true });
}
const db = sqliteD1(testMode ? ':memory:' : fileURLToPath(new URL('../.local/ai-gateway.sqlite', import.meta.url)));
db.exec(await readFile(new URL('../worker/migrations/0001_ai.sql', import.meta.url), 'utf8'));
const env = { ...fileEnv, ...Object.fromEntries(Object.entries(process.env).filter(([, value]) => value)), AI_DB: db };
let gateway;
if (testMode) {
  Object.assign(env, { OWNER_TOKEN_HASH: await sha256(TEST_ACCESS_CODE), SESSION_SECRET: TEST_SESSION_SECRET, GROQ_API_KEY: 'test-provider-only', GROQ_FREE_TIER_CONFIRMED: 'true', ELEVENLABS_API_KEY: 'test-provider-only', ELEVENLABS_VOICE_ID: 'test-voice', AI_DAILY_TURNS: '100', AI_MINUTE_TURNS: '100', AI_DAILY_REVIEWS: '50', AI_AUTH_ATTEMPTS: '500' });
  gateway = createGateway({ fetcher: createMockProvider().fetch, testMode: true });
} else gateway = createGateway();

const server = createServer(async (incoming, outgoing) => {
  try {
    const chunks = []; let bytes = 0;
    for await (const chunk of incoming) {
      bytes += chunk.length;
      if (bytes > 1_650_000) { outgoing.writeHead(413); outgoing.end('Request too large'); return; }
      chunks.push(chunk);
    }
    const headers = new Headers();
    for (const [key, value] of Object.entries(incoming.headers)) if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
    const url = `http://${incoming.headers.host || `127.0.0.1:${port}`}${incoming.url}`;
    const request = new Request(url, { method: incoming.method, headers, body: ['GET', 'HEAD'].includes(incoming.method) ? undefined : Buffer.concat(chunks) });
    const response = await gateway.fetch(request, env, { waitUntil: promise => { void promise.catch(() => {}); } });
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch { outgoing.writeHead(500, { 'Content-Type': 'application/json' }); outgoing.end(JSON.stringify({ detail: 'Local gateway error.' })); }
});
server.listen(port, '127.0.0.1', () => console.log(`Sprich AI gateway: http://127.0.0.1:${port} (${testMode ? 'TEST PROVIDER — no real AI' : 'real provider adapters; credentials required'})`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => { db.close(); process.exit(0); }));
