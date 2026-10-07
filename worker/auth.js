import { problem } from './errors.js';

export const COOKIE = 'sprich_ai_session';
const MAX_AGE = 7 * 86_400;
const encoder = new TextEncoder();

export async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', typeof value === 'string' ? encoder.encode(value) : value);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
const base64url = bytes => btoa(String.fromCharCode(...bytes)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
function unbase64url(text) { return Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), character => character.charCodeAt(0)); }
async function signingKey(secret) { return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']); }

export function authConfigured(env) {
  return /^[a-f0-9]{64}$/i.test(env.OWNER_TOKEN_HASH ?? '') && /^[A-Za-z0-9_-]{43,128}$/.test(env.SESSION_SECRET ?? '');
}
export function requireOrigin(request) {
  if (request.headers.get('Origin') !== new URL(request.url).origin) throw problem(403, 'origin', 'Open AI Talk from this app’s own address and try again.');
}
export async function verifyOwnerToken(token, env) {
  // This is a generated 256-bit bearer access code, not a user-chosen password.
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token) || !authConfigured(env)) return false;
  const actual = await sha256(token);
  const expected = env.OWNER_TOKEN_HASH.toLowerCase();
  let difference = 0;
  for (let i = 0; i < actual.length; i++) difference |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  return difference === 0;
}
export async function issueSession(env, now = Date.now()) {
  const payload = base64url(encoder.encode(JSON.stringify({ v: 1, sub: 'owner', exp: Math.floor(now / 1000) + MAX_AGE, nonce: crypto.randomUUID() })));
  const signature = await crypto.subtle.sign('HMAC', await signingKey(env.SESSION_SECRET), encoder.encode(payload));
  return `${payload}.${base64url(new Uint8Array(signature))}`;
}
export async function authenticated(request, env, now = Date.now()) {
  if (!authConfigured(env)) return false;
  const cookie = request.headers.get('Cookie')?.split(';').map(part => part.trim()).find(part => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  if (!cookie || cookie.length > 1200) return false;
  try {
    const [payload, signature, extra] = cookie.split('.');
    if (extra || !/^[A-Za-z0-9_-]+$/.test(payload) || !/^[A-Za-z0-9_-]+$/.test(signature)) return false;
    if (!await crypto.subtle.verify('HMAC', await signingKey(env.SESSION_SECRET), unbase64url(signature), encoder.encode(payload))) return false;
    const data = JSON.parse(new TextDecoder().decode(unbase64url(payload)));
    const seconds = Math.floor(now / 1000);
    return data.v === 1 && data.sub === 'owner' && Number.isInteger(data.exp) && data.exp > seconds && data.exp <= seconds + MAX_AGE + 60;
  } catch { return false; }
}
export function sessionCookie(value, url, clear = false) {
  const target = new URL(url);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(target.hostname);
  const secure = target.protocol === 'https:' || !local;
  return `${COOKIE}=${clear ? '' : value}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=${clear ? 0 : MAX_AGE}${secure ? '; Secure' : ''}`;
}
export function securityHeaders(response, request) {
  const headers = new Headers(response.headers);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Referrer-Policy', 'no-referrer');
  headers.set('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
  headers.set('Cache-Control', 'no-store');
  if (new URL(request.url).protocol === 'https:') headers.set('Strict-Transport-Security', 'max-age=31536000');
  return new Response(response.body, { status: response.status, headers });
}
