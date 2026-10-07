export class APIError extends Error {
  constructor(status, code, detail, retryAfter = 0) {
    super(detail); this.status = status; this.code = code; this.retryAfter = retryAfter;
  }
}
export const problem = (status, code, detail, retryAfter = 0) => new APIError(status, code, detail, retryAfter);

export function errorResponse(error, requestId = '') {
  const known = error instanceof APIError;
  const status = known ? error.status : 500;
  const code = known ? error.code : 'internal';
  const detail = known ? error.message : 'The AI connection could not finish. Your draft is still available.';
  const headers = { 'Content-Type': 'application/problem+json', 'Cache-Control': 'no-store' };
  if (known && error.retryAfter > 0) headers['Retry-After'] = String(error.retryAfter);
  return new Response(JSON.stringify({ type: `urn:sprich:problem:${code}`, title: code, status, detail, code, requestId, retryAfterSeconds: known ? error.retryAfter : 0 }), { status, headers });
}

export function savedError(error) {
  return { status: error.status ?? 500, code: error.code ?? 'internal', detail: error instanceof APIError ? error.message : 'The upstream request could not finish.', retryAfter: error.retryAfter ?? 0 };
}
export function restoreError(value) { return problem(value.status, value.code, value.detail, value.retryAfter); }
