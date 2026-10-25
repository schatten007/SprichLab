import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { deleteDB } from 'idb';
import { createStore } from '../app/js/store.js';
import { loadAssessmentDefinition } from '../app/js/assessment-loader.js';
import { COURSE_LESSONS, COURSE_PACKS } from '../app/data/starter-catalog.js';
import { MISSIONS } from '../app/data/missions.js';
import { ASSESSMENT_PACKS, lessonAssessmentId } from '../shared/assessment-manifest.js';
import { hashJSON, validateAssessmentDefinition } from '../shared/assessment-contracts.js';
import { createAssessmentDefinitionLoader, loadWorkerAssessment } from '../worker/assessment-definitions.js';
import { loadLocalAssessment } from '../tools/assessment-definitions.js';

const WORKER_ORIGIN = 'https://assessment-assets.example';
const CAFE = { id: 'pilot.cafe.a.writing', version: '1' };
const CAFE_FILE = 'assessments/pilot-cafe-a-v1.json';
const manifests = [...ASSESSMENT_PACKS, ...COURSE_PACKS];
const assets = new Map(await Promise.all(manifests.map(async manifest => [manifest.file,
  await readFile(new URL(`../app/public/${manifest.file}`, import.meta.url), 'utf8')])));
const rawAsset = path => {
  assert.ok(assets.has(path), `Only manifest assets may be read: ${path}`);
  return JSON.parse(assets.get(path));
};

async function fixtureStore(t) {
  const name = `assessment-loader-${crypto.randomUUID()}`;
  const store = await createStore({ name });
  t.after(async () => { store.close(); await deleteDB(name); });
  return store;
}
function assetFetcher(t, respond = path => new Response(assets.get(path), { headers: { 'Content-Type': 'application/json' } })) {
  return t.mock.fn(async input => {
    const url = new URL(input instanceof Request ? input.url : input);
    const path = url.pathname.slice(1);
    assert.ok(assets.has(path), `A loader attempted a non-manifest URL: ${url.href}`);
    assert.equal(url.search, '', 'User query parameters must not select an asset.');
    assert.equal(url.hash, '');
    return respond(path);
  });
}
function workerContext(fetchAsset) {
  return { env: { ASSETS: { fetch: fetchAsset } },
    request: new Request(`${WORKER_ORIGIN}/api/v1/assessments/evaluations?asset=https://untrusted.invalid/definition.json`) };
}
function assertClientRequests(fetchImpl, files) {
  assert.deepEqual(fetchImpl.mock.calls.map(({ arguments: [url] }) => new URL(url).pathname), files.map(file => `/${file}`));
  for (const { arguments: [url, options] } of fetchImpl.mock.calls) {
    assert.equal(new URL(url).origin, 'http://localhost');
    assert.equal(options.credentials, 'omit');
    assert.equal(options.signal.aborted, false);
  }
}

test('all published pilot definitions agree across the client, worker loader and local gateway loader', async t => {
  const store = await fixtureStore(t);
  const fetchImpl = assetFetcher(t);
  const readAsset = t.mock.fn(async path => rawAsset(path));
  const loadDefinition = createAssessmentDefinitionLoader(readAsset);
  for (const manifest of ASSESSMENT_PACKS) {
    for (const id of manifest.definitionIds) {
      await t.test(id, async () => {
        const reference = { id, version: manifest.version };
        const client = await loadAssessmentDefinition(store, id, reference.version, { fetchImpl });
        const worker = await loadDefinition(reference);
        const local = await loadLocalAssessment(reference);
        assert.deepEqual(client, worker);
        assert.deepEqual(client, local);
        assert.equal(client.id, id);
        assert.equal(client.version, manifest.version);
        assert.equal(client.kind, id.split('.').at(-1));
        assert.equal(client.level, manifest.family === 'cafe' ? 'A1' : 'A2');
        assert.equal(validateAssessmentDefinition(client), client);
        assert.equal(await hashJSON(client), await hashJSON(local));
      });
    }
  }
  assertClientRequests(fetchImpl, ASSESSMENT_PACKS.map(pack => pack.file));
  assert.deepEqual(readAsset.mock.calls.map(call => call.arguments), ASSESSMENT_PACKS.map(pack => [pack.file]));
});

test('every starter and workplace roleplay variant has identical client/local content, classification, version and hash', async t => {
  const store = await fixtureStore(t);
  const fetchImpl = assetFetcher(t);
  const sources = [
    ...COURSE_LESSONS.map(lesson => ({ id: lesson.id, level: lesson.level, register: lesson.register })),
    ...MISSIONS.map(mission => ({ id: mission.id, level: mission.level === 'B1 practice' ? 'B1' : 'A2',
      register: mission.register.startsWith('Sie') ? 'Sie' : 'du' })),
  ];
  for (const source of sources) {
    await t.test(`${source.id}: variants A and B`, async () => {
      const variants = [];
      for (const variant of [0, 1]) {
        const id = lessonAssessmentId(source.id, variant);
        const client = await loadAssessmentDefinition(store, id, null, { fetchImpl });
        const local = await loadLocalAssessment({ id, version: client.version });
        assert.deepEqual(client, local, `${id} must seal the same task on both sides of the gateway.`);
        assert.equal(await hashJSON(client), await hashJSON(local));
        assert.match(client.version, /^[a-f0-9]{64}$/);
        assert.equal(client.id, id);
        assert.equal(client.kind, 'roleplay');
        assert.equal(client.level, source.level);
        assert.deepEqual(client.lessonIds, [source.id]);
        assert.equal(client.familyId, `lesson-${source.id}`);
        assert.equal(client.formId, variant === 0 ? 'a' : 'b');
        assert.equal(client.scenario.id, source.id);
        assert.equal(client.scenario.variantId, `variant-${variant}`);
        assert.equal(client.scenario.register, source.register);
        assert.equal(client.rubricId, 'conversation:1');
        assert.equal(validateAssessmentDefinition(client), client);
        variants.push(client);
      }
      assert.notEqual(variants[0].version, variants[1].version, 'Variants must not share a sealed content identity.');
      assert.notEqual(await hashJSON(variants[0]), await hashJSON(variants[1]));
    });
  }
  assertClientRequests(fetchImpl, COURSE_PACKS.map(pack => pack.file));
});

test('derived starter assets use only the course manifest and workplace definitions need no asset download', async t => {
  const store = await fixtureStore(t);
  const fetchImpl = assetFetcher(t);
  const readAsset = t.mock.fn(async path => rawAsset(path));
  const loadDefinition = createAssessmentDefinitionLoader(readAsset);
  const workplace = await loadAssessmentDefinition(store, 'lesson.first-interview.1', null, { fetchImpl });
  assert.deepEqual(await loadDefinition({ id: workplace.id, version: workplace.version }), workplace);
  assert.equal(fetchImpl.mock.callCount(), 0);
  assert.equal(readAsset.mock.callCount(), 0);
  for (const id of ['lesson.starter-hello.0', 'lesson.starter-coffee.1', 'lesson.starter-appointment.0']) {
    const client = await loadAssessmentDefinition(store, id, null, { fetchImpl });
    assert.deepEqual(await loadDefinition({ id, version: client.version }), client);
  }
  assert.deepEqual(readAsset.mock.calls.map(call => call.arguments), COURSE_PACKS.map(pack => [pack.file]));
  assertClientRequests(fetchImpl, COURSE_PACKS.map(pack => pack.file));
});

test('valid cached assessment packs reopen offline and returned definitions cannot mutate the cached task', async t => {
  const store = await fixtureStore(t);
  const fetchImpl = assetFetcher(t);
  const first = await loadAssessmentDefinition(store, CAFE.id, CAFE.version, { fetchImpl });
  const originalHash = await hashJSON(first);
  first.title = 'SYNTHETIC CALLER EDIT';
  first.task.goals[0] = 'Replace the published task.';
  const offline = t.mock.fn(async () => { throw new Error('Synthetic offline transport.'); });
  const recovered = await loadAssessmentDefinition(store, CAFE.id, CAFE.version, { fetchImpl: offline });
  assert.equal(offline.mock.callCount(), 0);
  assert.equal(await hashJSON(recovered), originalHash);
  assert.deepEqual(recovered, await loadLocalAssessment(CAFE));
  assertClientRequests(fetchImpl, [CAFE_FILE]);
});

test('worker assets are rooted at the app origin and caller URL, file and path hints cannot replace the manifest', async t => {
  const fetchAsset = assetFetcher(t);
  const reference = { ...CAFE, url: 'https://untrusted.invalid/definition.json', file: '../../.dev.vars', path: '//untrusted.invalid/pack.json' };
  const definition = await loadWorkerAssessment(reference, workerContext(fetchAsset));
  assert.deepEqual(definition, await loadLocalAssessment(CAFE));
  assert.deepEqual(fetchAsset.mock.calls.map(({ arguments: [url] }) => String(url)), [`${WORKER_ORIGIN}/${CAFE_FILE}`]);
  const store = await fixtureStore(t);
  const fetchImpl = assetFetcher(t);
  assert.deepEqual(await loadAssessmentDefinition(store, CAFE.id, CAFE.version, { fetchImpl, url: reference.url, path: reference.path }), definition);
  assertClientRequests(fetchImpl, [CAFE_FILE]);
});

const unknownReferences = [
  { id: 'https://untrusted.invalid/definition.json', version: '1' },
  { id: '//untrusted.invalid/definition.json', version: '1' },
  { id: '../../.dev.vars', version: '1' },
  { id: 'pilot.cafe.a.writing?url=https://untrusted.invalid', version: '1' },
  { id: 'lesson.starter-coffee.2', version: '1' },
  { id: 'lesson.unpublished-lesson.0', version: '1' },
  { id: CAFE.id, version: 'https://untrusted.invalid/version.json' },
  { id: CAFE.id, version: 'unpublished-version' },
];
for (const reference of unknownReferences) {
  test(`unpublished reference ${reference.id} @ ${reference.version} cannot choose a file or URL`, async t => {
    const store = await fixtureStore(t);
    const fetchImpl = assetFetcher(t);
    const readAsset = t.mock.fn(async path => rawAsset(path));
    const loadDefinition = createAssessmentDefinitionLoader(readAsset);
    const fetchAsset = assetFetcher(t);
    await assert.rejects(loadAssessmentDefinition(store, reference.id, reference.version, { fetchImpl }), /not published|Unknown assessment lesson/);
    await assert.rejects(loadDefinition(reference), { status: 404, code: 'assessment_not_found' });
    await assert.rejects(loadLocalAssessment(reference), { status: 404, code: 'assessment_not_found' });
    await assert.rejects(loadWorkerAssessment(reference, workerContext(fetchAsset)), { status: 404, code: 'assessment_not_found' });
    assert.equal(fetchImpl.mock.callCount(), 0);
    assert.equal(readAsset.mock.callCount(), 0);
    assert.equal(fetchAsset.mock.callCount(), 0);
  });
}

for (const id of ['lesson.starter-coffee.0', 'lesson.first-interview.1']) {
  test(`${id} rejects a stale derived version on the client, local loader and worker`, async t => {
    const store = await fixtureStore(t);
    const fetchImpl = assetFetcher(t);
    const client = await loadAssessmentDefinition(store, id, null, { fetchImpl });
    assert.deepEqual(await loadLocalAssessment({ id, version: client.version }), client);
    const reference = { id, version: 'stale-derived-version' };
    await assert.rejects(loadAssessmentDefinition(store, id, reference.version, { fetchImpl }), /published task changed/);
    await assert.rejects(loadLocalAssessment(reference), { status: 409, code: 'assessment_version' });
    await assert.rejects(loadWorkerAssessment(reference, workerContext(assetFetcher(t))), { status: 409, code: 'assessment_version' });
  });
}

const brokenAssets = [
  { name: 'missing asset', respond: () => new Response('Missing fixture asset', { status: 404 }), clientError: /could not be downloaded/ },
  { name: 'HTML app-shell fallback with status 200', respond: () => new Response('<!doctype html><title>Fixture app shell</title>', { headers: { 'Content-Type': 'text/html' } }), clientError: /could not be downloaded/ },
  { name: 'malformed JSON', respond: () => new Response('{ invalid-json', { headers: { 'Content-Type': 'application/json' } }), clientError: SyntaxError },
  { name: 'empty JSON body', respond: () => new Response('', { headers: { 'Content-Type': 'application/json' } }), clientError: SyntaxError },
  { name: 'invalid JSON content schema', respond: () => Response.json({ unrelated: true }), clientError: /Unexpected assessment fields/ },
];
for (const item of brokenAssets) {
  test(`the client rejects ${item.name} without caching a broken pilot pack`, async t => {
    const store = await fixtureStore(t);
    const fetchImpl = assetFetcher(t, item.respond);
    await assert.rejects(loadAssessmentDefinition(store, CAFE.id, CAFE.version, { fetchImpl }), item.clientError);
    assert.equal(await store.getAssessmentPack('pilot-cafe-a', '1'), undefined);
    assertClientRequests(fetchImpl, [CAFE_FILE]);
  });
}

test('missing worker ASSETS configuration reports an assessment content outage', async () => {
  await assert.rejects(loadWorkerAssessment(CAFE, { env: {}, request: new Request(`${WORKER_ORIGIN}/api/v1/assessments/evaluations`) }),
    { status: 503, code: 'assessment_content' });
});

test('worker asset failures consistently report assessment_content for pilot and derived definitions', async t => {
  const store = await fixtureStore(t);
  const derived = await loadAssessmentDefinition(store, 'lesson.starter-coffee.0', null, { fetchImpl: assetFetcher(t) });
  for (const reference of [CAFE, { id: derived.id, version: derived.version }]) {
    for (const item of brokenAssets) {
      await t.test(`${reference.id}: ${item.name}`, async t => {
        const fetchAsset = assetFetcher(t, item.respond);
        await assert.rejects(loadWorkerAssessment(reference, workerContext(fetchAsset)), { status: 503, code: 'assessment_content' });
        assert.ok(fetchAsset.mock.callCount() > 0);
        for (const { arguments: [url] } of fetchAsset.mock.calls) assert.equal(new URL(url).origin, WORKER_ORIGIN);
      });
    }
  }
});

const invalidPacks = [
  { name: 'wrong pack ID', edit: pack => { pack.id = 'another-pack'; }, error: /pack version mismatch/ },
  { name: 'wrong pack version', edit: pack => { pack.version = '2'; }, error: /pack version mismatch/ },
  { name: 'missing requested definition', edit: pack => { pack.definitions = pack.definitions.filter(definition => definition.id !== CAFE.id); }, error: /pack is incomplete/ },
  { name: 'invalid nested definition', edit: pack => { pack.definitions.find(definition => definition.kind === 'roleplay').level = 'C2'; }, error: /Invalid assessment classification/ },
  { name: 'duplicate definition identity', edit: pack => { pack.definitions.push(structuredClone(pack.definitions[0])); }, error: /Invalid assessment pack/ },
];
for (const item of invalidPacks) {
  test(`client and worker reject a pack with ${item.name}, even when HTTP and JSON are valid`, async t => {
    const store = await fixtureStore(t);
    const pack = rawAsset(CAFE_FILE);
    item.edit(pack);
    const fetchImpl = assetFetcher(t, () => Response.json(pack));
    await assert.rejects(loadAssessmentDefinition(store, CAFE.id, CAFE.version, { fetchImpl }), item.error);
    assert.equal(await store.getAssessmentPack('pilot-cafe-a', '1'), undefined);
    await assert.rejects(loadWorkerAssessment(CAFE, workerContext(assetFetcher(t, () => Response.json(pack)))),
      { status: 503, code: 'assessment_content' });
  });
}

test('an oversized asset is refused before a valid JSON pack can be accepted', async t => {
  const store = await fixtureStore(t);
  // Valid JSON plus whitespace avoids passing merely because the JSON parser rejected it.
  const raw = `${assets.get(CAFE_FILE)}${' '.repeat(900001)}`;
  const respond = () => new Response(raw, { headers: { 'Content-Type': 'application/json' } });
  await assert.rejects(loadAssessmentDefinition(store, CAFE.id, CAFE.version, { fetchImpl: assetFetcher(t, respond) }), /pack is too large/);
  assert.equal(await store.getAssessmentPack('pilot-cafe-a', '1'), undefined);
  await assert.rejects(loadWorkerAssessment(CAFE, workerContext(assetFetcher(t, respond))), { status: 503, code: 'assessment_content' });
});
