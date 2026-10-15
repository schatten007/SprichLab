import test from 'node:test';
import assert from 'node:assert/strict';
import { lookupTatoebaExamples, tatoebaExamples } from '../app/js/tatoeba.js';

const german = {
  id: 123,
  text: 'Guten Tag.',
  lang: 'deu',
  license: 'CC BY 2.0 FR',
  owner: 'example-user',
  is_unapproved: false,
  is_orphan: false,
  translations: [{
    id: 456,
    text: 'Hello!',
    lang: 'eng',
    license: 'CC BY 2.0 FR',
    owner: 'translator',
    is_unapproved: false,
    is_orphan: false,
    is_direct: true,
  }],
};

const fixture = { data: [german] };

function response(body, status = 200, headers = {}) {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

function sentence(overrides = {}) {
  return { ...structuredClone(german), ...overrides };
}

test('Tatoeba results keep German text, English translation, and German attribution', () => {
  assert.deepEqual(tatoebaExamples(fixture), [{
    de: 'Guten Tag.', en: 'Hello!', sourceUrl: 'https://tatoeba.org/en/sentences/show/123',
    sourceTitle: 'Tatoeba · example-user · CC BY 2.0 FR',
  }]);
});

test('Tatoeba results reject unapproved, orphaned, unlicensed, indirect, and malformed entries', () => {
  const invalid = [
    sentence({ id: 124, license: 'GPL', }),
    sentence({ id: 125, is_unapproved: true }),
    sentence({ id: 126, is_orphan: true }),
    sentence({ id: 127, translations: [{ ...german.translations[0], id: 457, license: 'CC BY-SA 4.0' }] }),
    sentence({ id: 128, translations: [{ ...german.translations[0], id: 458, is_unapproved: true }] }),
    sentence({ id: 129, translations: [{ ...german.translations[0], id: 459, is_orphan: true }] }),
    sentence({ id: 130, translations: [{ ...german.translations[0], id: 460, is_direct: false }] }),
    sentence({ id: 131, text: 42 }),
    sentence({ id: 132, lang: 'fra' }),
    sentence({ id: 133, owner: '' }),
  ];
  assert.deepEqual(tatoebaExamples({ data: invalid }), []);
});

test('Tatoeba results skip oversized text without truncating it and remove duplicates', () => {
  const longGerman = sentence({ id: 134, text: 'x'.repeat(501) });
  const longEnglish = sentence({
    id: 135,
    translations: [{ ...german.translations[0], id: 461, text: 'x'.repeat(1001) }],
  });
  const valid = [
    german,
    structuredClone(german),
    sentence({ id: 136, text: 'Guten Morgen.', translations: [{ ...german.translations[0], id: 462, text: 'Good morning!' }] }),
    sentence({ id: 137, text: 'Auf Wiedersehen.', translations: [{ ...german.translations[0], id: 463, text: 'Goodbye!' }] }),
    sentence({ id: 138, text: 'Bis bald.', translations: [{ ...german.translations[0], id: 464, text: 'See you soon!' }] }),
  ];
  const results = tatoebaExamples({ data: [longGerman, longEnglish, ...valid] });
  assert.equal(results.length, 3);
  assert.deepEqual(results.map(item => item.de), ['Guten Tag.', 'Guten Morgen.', 'Auf Wiedersehen.']);
  assert.equal(results.some(item => item.de.length > 500 || item.en.length > 1000), false);
});

test('Tatoeba lookup sanitizes sentence punctuation and sends only bounded documented filters', async () => {
  let request;
  const examples = await lookupTatoebaExamples('  Guten   Tag…  ', {
    fetchImpl: async (url, options) => {
      request = { url, options };
      return response(fixture);
    },
  });
  const url = new URL(request.url);
  assert.equal(examples[0].en, 'Hello!');
  assert.equal(url.pathname, '/v1/sentences');
  assert.deepEqual(Object.fromEntries(url.searchParams), {
    lang: 'deu',
    q: 'Guten Tag',
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
  assert.equal(request.options.credentials, 'omit');
  assert.equal(request.options.referrer, '');
  assert.equal(request.options.referrerPolicy, 'no-referrer');
  assert.equal(typeof request.options.signal?.addEventListener, 'function');
});

test('Tatoeba lookup does not query blank, punctuation-only, or oversized input', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls++; return response(fixture); };
  assert.deepEqual(await lookupTatoebaExamples(' …!? ', { fetchImpl }), []);
  assert.deepEqual(await lookupTatoebaExamples('x'.repeat(121), { fetchImpl }), []);
  assert.equal(calls, 0);
});

test('Tatoeba lookup rejects malformed or oversized responses', async () => {
  await assert.rejects(
    () => lookupTatoebaExamples('Hallo', { fetchImpl: async () => response('{bad json') }),
    /invalid response/i,
  );
  await assert.rejects(
    () => lookupTatoebaExamples('Hallo', {
      fetchImpl: async () => response({ data: [german], padding: 'x'.repeat(300_000) }, 200, { 'content-length': '300000' }),
    }),
    /too large/i,
  );
  assert.deepEqual(
    await lookupTatoebaExamples('Hallo', { fetchImpl: async () => response({ data: {} }) }),
    [],
  );
});

test('Tatoeba lookup reports HTTP and network failures', async () => {
  await assert.rejects(
    () => lookupTatoebaExamples('Hallo', { fetchImpl: async () => response('', 503) }),
    /could not be reached \(503\)/,
  );
  await assert.rejects(
    () => lookupTatoebaExamples('Hallo', { fetchImpl: async () => { throw new Error('offline'); } }),
    /network error/i,
  );
});

test('Tatoeba lookup aborts a request when its timeout expires', async () => {
  let aborted = false;
  await assert.rejects(
    () => lookupTatoebaExamples('Hallo', {
      timeoutMs: 5,
      fetchImpl: async (_url, { signal }) => new Promise((resolve, reject) => {
        const timer = setTimeout(() => resolve(response(fixture)), 30);
        signal.addEventListener('abort', () => { clearTimeout(timer); aborted = true; reject(signal.reason); }, { once: true });
      }),
    }),
    /timed out/i,
  );
  assert.equal(aborted, true);
});

test('Tatoeba lookup passes through caller cancellation', async () => {
  const controller = new AbortController();
  const request = lookupTatoebaExamples('Hallo', {
    signal: controller.signal,
    fetchImpl: async (_url, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      controller.abort();
    }),
  });
  await assert.rejects(request, error => error?.name === 'AbortError');
});
