const ENDPOINT = 'https://api.tatoeba.org/v1/sentences';
const MAX_QUERY_LENGTH = 120;
const MAX_GERMAN_LENGTH = 500;
const MAX_ENGLISH_LENGTH = 1000;
const MAX_ATTRIBUTION_LENGTH = 150;
const MAX_RESPONSE_BYTES = 256 * 1024;
const MAX_RESULTS = 3;
const REQUEST_TIMEOUT_MS = 8_000;
const REUSABLE_LICENSES = new Set(['CC0 1.0', 'CC BY 2.0 FR']);

function boundedText(value, max) {
  return typeof value === 'string' && value.trim() && value.length <= max;
}

function validId(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function reusableSentence(sentence, maxText, language) {
  return sentence && sentence.lang === language && validId(sentence.id) &&
    boundedText(sentence.text, maxText) && boundedText(sentence.owner, MAX_ATTRIBUTION_LENGTH) &&
    REUSABLE_LICENSES.has(sentence.license) && sentence.is_unapproved === false && sentence.is_orphan !== true;
}

function sentenceUrl(id) {
  return `https://tatoeba.org/en/sentences/show/${id}`;
}

export function tatoebaExamples(payload) {
  if (!Array.isArray(payload?.data)) return [];
  const results = [];
  const seen = new Set();
  for (const sentence of payload.data) {
    if (!reusableSentence(sentence, MAX_GERMAN_LENGTH, 'deu') || !Array.isArray(sentence.translations)) continue;
    const translation = sentence.translations.find(item =>
      reusableSentence(item, MAX_ENGLISH_LENGTH, 'eng') && item.is_direct === true);
    if (!translation) continue;
    if (seen.has(sentence.id)) continue;
    seen.add(sentence.id);
    // shortcut: persist only German attribution until phrase data stores translation provenance.
    results.push({
      de: sentence.text,
      en: translation.text,
      sourceUrl: sentenceUrl(sentence.id),
      sourceTitle: `Tatoeba · ${sentence.owner} · ${sentence.license}`,
    });
    if (results.length === MAX_RESULTS) break;
  }
  return results;
}

function sanitizeQuery(value) {
  if (typeof value !== 'string') return '';
  const input = value.normalize('NFKC').trim();
  if (!input || input.length > MAX_QUERY_LENGTH) return '';
  const query = input.replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/gu, ' ').trim();
  return query && query.length <= MAX_QUERY_LENGTH && /[\p{L}\p{N}]/u.test(query) ? query : '';
}

function abortedError() {
  return new DOMException('Tatoeba lookup was aborted.', 'AbortError');
}

function byteLength(text) {
  return new TextEncoder().encode(text).byteLength;
}

async function responseText(response) {
  const contentLength = Number(response.headers?.get?.('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) {
    throw new Error('Tatoeba response was too large.');
  }
  if (response.body?.getReader) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let bytes = 0;
    let text = '';
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) return text + decoder.decode();
        bytes += part.value.byteLength;
        if (bytes > MAX_RESPONSE_BYTES) {
          try { await reader.cancel(); } catch { /* The response is already unusable. */ }
          throw new Error('Tatoeba response was too large.');
        }
        text += decoder.decode(part.value, { stream: true });
      }
    } finally {
      reader.releaseLock();
    }
  }
  if (typeof response.text !== 'function') throw new Error('Tatoeba response could not be read.');
  const text = await response.text();
  if (byteLength(text) > MAX_RESPONSE_BYTES) throw new Error('Tatoeba response was too large.');
  return text;
}

export async function lookupTatoebaExamples(text, {
  fetchImpl = (...args) => fetch(...args), signal, timeoutMs = REQUEST_TIMEOUT_MS,
} = {}) {
  const query = sanitizeQuery(text);
  if (!query) return [];

  const params = new globalThis.URLSearchParams({
    lang: 'deu',
    q: query,
    'trans:lang': 'eng',
    'trans:is_direct': 'yes',
    'trans:is_unapproved': 'no',
    'trans:is_orphan': 'no',
    is_unapproved: 'no',
    is_orphan: 'no',
    license: 'CC0 1.0,CC BY 2.0 FR',
    showtrans: 'matching',
    sort: 'relevance',
    limit: '8',
  });
  const controller = new AbortController();
  const timeout = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : REQUEST_TIMEOUT_MS;
  let timedOut = false;
  let timer;
  const forwardAbort = () => controller.abort();
  if (signal?.aborted) throw abortedError();
  signal?.addEventListener('abort', forwardAbort, { once: true });
  timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeout);

  try {
    let response;
    try {
      response = await fetchImpl(`${ENDPOINT}?${params}`, {
        credentials: 'omit', referrer: '', referrerPolicy: 'no-referrer', signal: controller.signal,
      });
    } catch {
      if (timedOut) throw new Error('Tatoeba lookup timed out.');
      if (signal?.aborted) throw abortedError();
      throw new Error('Tatoeba lookup failed due to a network error.');
    }
    if (!response?.ok) throw new Error(`Tatoeba could not be reached (${response?.status ?? 'unknown'}).`);

    let body;
    try {
      body = await responseText(response);
    } catch (error) {
      if (timedOut) throw new Error('Tatoeba lookup timed out.');
      if (signal?.aborted) throw abortedError();
      if (error?.message === 'Tatoeba response was too large.') throw error;
      throw new Error('Tatoeba response could not be read.');
    }
    let payload;
    try { payload = JSON.parse(body); } catch { throw new Error('Tatoeba returned an invalid response.'); }
    return tatoebaExamples(payload);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', forwardAbort);
  }
}
