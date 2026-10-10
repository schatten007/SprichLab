import { AI_API_VERSION, AI_LIMITS, isObject } from '../../shared/ai-contracts.js';

const BASE = '/api/v1';

export class GatewayError extends Error {
  constructor(message, { code = 'network', status = 0, retryAfterSeconds = 0, requestId = '' } = {}) {
    super(message);
    this.name = 'GatewayError';
    this.code = code;
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
    this.requestId = requestId;
  }
}
export const isCancelled = error => error?.code === 'cancelled';

function describe(body) {
  if (body && typeof body === 'object' && typeof body.detail === 'string') return body;
  return { detail: 'The AI connection could not finish. Your draft is still available.', code: 'network', retryAfterSeconds: 0, requestId: '' };
}

/**
 * The only place the browser talks to the gateway. Everything is same-origin,
 * so no provider key, model choice, or provider URL can be supplied by the page.
 */
export function createAIClient({ fetchImpl = (...args) => fetch(...args), baseUrl = BASE, sleep = ms => new Promise(resolve => { setTimeout(resolve, ms); }),
  polls = 30, pollMs = 1000, timeoutMs = 45_000 } = {}) {
  function linked(viewSignal) {
    const controller = new AbortController();
    let timedOut = false;
    const onAbort = () => controller.abort();
    if (viewSignal) {
      if (viewSignal.aborted) controller.abort();
      else viewSignal.addEventListener('abort', onAbort, { once: true });
    }
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
    return {
      signal: controller.signal,
      finish() { clearTimeout(timer); viewSignal?.removeEventListener('abort', onAbort); },
      get timedOut() { return timedOut; },
      get viewAborted() { return Boolean(viewSignal?.aborted); },
    };
  }

  async function request(path, { method = 'GET', body, signal, responseType = 'json', accept = 'application/json' } = {}) {
    const link = linked(signal);
    const headers = { Accept: accept };
    // Origin, Cookie, and Set-Cookie belong to the browser, not application JavaScript.
    let payload = body;
    if (body !== undefined && !(body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    try {
      const response = await fetchImpl(`${baseUrl}${path}`, { method, headers, body: payload, credentials: 'same-origin', signal: link.signal });
      if (response.status === 401) {
        const problem = await response.json().catch(() => null);
        throw new GatewayError(problem?.detail ?? 'Unlock the private AI connection first.', { code: 'locked', status: 401 });
      }
      if (!response.ok) {
        const problem = describe(await response.json().catch(() => null));
        throw new GatewayError(problem.detail, { code: problem.code ?? 'network', status: response.status, retryAfterSeconds: problem.retryAfterSeconds ?? 0, requestId: problem.requestId ?? '' });
      }
      if (responseType === 'blob') {
        const type = response.headers.get('Content-Type')?.split(';')[0].toLowerCase();
        if (!['audio/mpeg', 'audio/mp3', 'audio/wav'].includes(type)
          || Number(response.headers.get('Content-Length')) > AI_LIMITS.speechBytes) {
          throw new GatewayError('The voice gateway returned an unsupported audio response.', { code: 'speech_format' });
        }
        const audio = await response.blob();
        if (!audio.size || audio.size > AI_LIMITS.speechBytes) throw new GatewayError('The voice gateway returned empty or oversized audio.', { code: 'speech_format' });
        return audio;
      }
      let result;
      try { result = await response.json(); }
      catch (error) { if (error instanceof SyntaxError) throw new GatewayError('The AI gateway is unavailable at this address. Start the gateway and check the /api proxy.', { code: 'invalid_response' }); throw error; }
      if (!isObject(result?.data) || result.meta?.apiVersion !== AI_API_VERSION) {
        throw new GatewayError('The AI gateway returned an unexpected response. Check the gateway setup.', { code: 'invalid_response' });
      }
      return { data: result.data, meta: result.meta, status: response.status };
    } catch (error) {
      if (link.viewAborted) throw new GatewayError('This conversation is no longer open.', { code: 'cancelled' });
      if (link.timedOut) throw new GatewayError('The AI connection took too long. Your draft is saved on this device.', { code: 'timeout' });
      if (error instanceof GatewayError) throw error;
      throw new GatewayError('The AI connection could not be reached. Check your connection, then send again.', { code: 'network' });
    } finally { link.finish(); }
  }

  async function send(path, payload, { signal, audio = null, recordingMs = 0 } = {}) {
    const body = audio
      ? (() => { const form = new FormData(); form.set('metadata', JSON.stringify({ ...payload, recordingMs })); form.set('audio', audio, 'clip.webm'); return form; })()
      : payload;
    const first = await request(path, { method: 'POST', body, signal });
    if (first.status !== 202) return first.data;
    const receipt = await waitFor(payload.requestId, { signal });
    return receipt;
  }

  async function waitFor(requestId, { signal } = {}) {
    for (let attempt = 0; attempt < polls; attempt++) {
      if (attempt) await sleep(pollMs);
      const result = await request(`/requests/${encodeURIComponent(requestId)}`, { signal });
      if (result.status !== 202) return result.data;
    }
    throw new GatewayError('The reply is still being prepared. Send the same response again to recover it.', { code: 'pending', requestId });
  }

  return {
    async status({ signal } = {}) {
      const { data } = await request('/status', { signal });
      return data;
    },
    async unlock(token, { signal } = {}) {
      const { data } = await request('/session', { method: 'POST', body: { token }, signal });
      return data.authenticated === true;
    },
    async lock({ signal } = {}) { await request('/session', { method: 'DELETE', signal }); },
    async usage({ signal } = {}) { return (await request('/usage', { signal })).data; },
    async capabilities({ signal } = {}) { return (await request('/capabilities', { signal })).data; },
    async turn(payload, options = {}) { return send('/turns', payload, options); },
    async review(payload, options = {}) { return send('/reviews', payload, options); },
    async evaluateAssessment(payload, options = {}) { return send('/assessments/evaluations', payload, options); },
    async receipt(requestId, options = {}) { return waitFor(requestId, options); },
    async speech(text, { signal } = {}) {
      return request('/speech', { method: 'POST', body: { text }, signal, responseType: 'blob', accept: 'audio/mpeg, audio/wav' });
    },
    get limits() { return AI_LIMITS; },
  };
}

export const aiClient = createAIClient();
