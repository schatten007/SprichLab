import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parsePack, mergeCourse, starterSnapshot, loadCourse, lessonDialogues } from '../app/js/starter-content.js';
import { createStarterSession, starterDraft, starterSteps, starterResponse, starterCanFinish, createWordSession, validateStarter, supportOf } from '../app/js/starter-state.js';
import { wordMemories, newStarterPlan, recommendNext, stageSummary, missingPrerequisites, pathLessons } from '../app/js/starter-progress.js';
import { buildGeminiPack, starterGeminiSource } from '../app/js/gemini-pack.js';
import { newState, upgradeState, mergeProgress, validateState, SCHEMA_VERSION } from '../app/js/model.js';
import { createStore } from '../app/js/store.js';
import { COURSE_LESSONS, COURSE_MODULES, COURSE_PACKS, COURSE_STAGES, lessonById } from '../app/data/starter-catalog.js';

const raws = {};
for (const pack of COURSE_PACKS) raws[pack.id] = JSON.parse(await readFile(new URL(`../app/public/${pack.file}`, import.meta.url), 'utf8'));
const packs = COURSE_PACKS.map(pack => parsePack(raws[pack.id]));
const course = mergeCourse(packs);
const NOW = 1_700_000_000_000;
const content = () => starterSnapshot(course, 'starter-hello');
const spoken = patch => ({ ...starterDraft(), aloud: true, ...patch });
const practised = (starter, ids) => ids.forEach(id => {
  const session = createStarterSession(starterSnapshot(course, id), { id: `done-${id}`, now: NOW });
  starterSteps(session).filter(step => ['warmup', 'speak'].includes(step.kind))
    .forEach(step => session.responses.push(starterResponse(session, step, spoken(), step.kind === 'warmup' ? 'unscored' : 'helped', NOW)));
  session.completedAt = NOW;
  starter.sessions.push(session);
});

test('every catalog lesson is authored, classified, and covered by its own pack', () => {
  assert.equal(course.lessons.length, COURSE_LESSONS.length);
  assert.equal(course.lessons.length, 48);
  assert.equal(course.words.length, 250);
  assert.equal(COURSE_MODULES.length, 12);
  assert.deepEqual(course.lessons.map(lesson => lesson.id), COURSE_LESSONS.map(lesson => lesson.id));
  const covered = new Set(course.lessons.flatMap(lesson => lesson.wordIds));
  assert.deepEqual(course.words.filter(word => !covered.has(word.id)), [], 'each word belongs to a lesson');
  for (const module of COURSE_MODULES) assert.equal(COURSE_LESSONS.filter(lesson => lesson.module === module.id).length, 4);
  for (const lesson of COURSE_LESSONS) {
    assert.ok(['starter', 'A1', 'A2', 'B1'].includes(lesson.level), `${lesson.id} needs a level`);
    assert.ok(lesson.skill && lesson.topic && lesson.stage, `${lesson.id} needs a skill, topic, and stage`);
    assert.ok(lesson.prerequisites.every(id => lessonById(id)), `${lesson.id} refers to a real prerequisite`);
    assert.ok(lesson.prerequisites.every(id => lessonById(id).pathOrder < lesson.pathOrder), `${lesson.id} must come after its prerequisites`);
  }
  assert.deepEqual(COURSE_STAGES.flatMap(stage => stage.moduleIds).sort(), COURSE_MODULES.map(module => module.id).sort());
});

test('each lesson teaches a bilingual conversation with small targets and real variations', () => {
  for (const { id } of COURSE_LESSONS) {
    const saved = starterSnapshot(course, id);
    assert.ok(saved.words.length >= 5 && saved.words.length <= 8, id);
    assert.equal(saved.lesson.practice.length, 3);
    assert.equal(saved.lesson.variations.length, 2);
    const dialogues = lessonDialogues(saved.lesson);
    dialogues.forEach(dialogue => assert.ok(dialogue.length >= 4 && dialogue.every(line => line.de && line.en), id));
    assert.equal(starterSteps(createStarterSession(saved))[0].kind, 'warmup');
    assert.ok(saved.lesson.warmup.de.split(/\s+/).length <= 12, id);
    assert.notEqual(saved.lesson.variations[0].cue, saved.lesson.variations[1].cue);
    const pack = buildGeminiPack(starterGeminiSource(saved));
    assert.ok(pack.includes(saved.lesson.warmup.de));
    assert.ok(pack.length < 9000, `${id}: keep the phone pack concise`);
    assert.ok(!pack.includes('undefined'));
  }
  const broken = structuredClone(raws.everyday);
  broken.words[0][6] = '';
  assert.throws(() => parsePack(broken), /bilingual/);
  const short = structuredClone(raws.everyday);
  short.lessons.pop();
  assert.throws(() => parsePack(short), /catalog lessons/);
});

test('each lesson offers two model conversations, and repeating one uses the other', () => {
  const lesson = course.lessons.find(item => item.id === 'starter-ticket');
  assert.equal(lessonDialogues(lesson).length, 2);
  const snapshot = starterSnapshot(course, lesson.id);
  const first = starterSteps(createStarterSession(snapshot, { variant: 0 })).find(step => step.kind === 'dialogue');
  const second = starterSteps(createStarterSession(snapshot, { variant: 1 })).find(step => step.kind === 'dialogue');
  assert.notDeepEqual(first.dialogue, second.dialogue);
  assert.equal(first.alternates, 2);
});

test('the path recommends a ready lesson, explains why, and lists missing preparation', () => {
  const state = newState(NOW);
  const first = recommendNext(course, state.starter);
  assert.equal(first.lesson.id, pathLessons(course)[0].id);
  assert.match(first.reason, /first lesson|next step/i);
  assert.deepEqual(first.prep, []);

  practised(state.starter, ['starter-hello']);
  assert.equal(recommendNext(course, state.starter).lesson.id, pathLessons(course)[1].id);

  const prep = missingPrerequisites(course, state.starter, 'starter-ticket');
  assert.ok(prep.some(item => item.id === 'starter-prices'), 'buying a ticket needs prices first');
  const stages = stageSummary(course, state.starter);
  assert.equal(stages.length, COURSE_STAGES.length);
  assert.equal(stages.reduce((total, item) => total + item.total, 0), course.lessons.length);
  assert.equal(stages[0].done, 1);
});

test('an unfinished lesson is resumed, and repeated struggle suggests a guided retry', () => {
  const state = newState(NOW);
  const active = createStarterSession(content(), { id: 'active-lesson', now: NOW });
  state.starter.sessions.push(active);
  const resume = recommendNext(course, state.starter);
  assert.equal(resume.session.id, 'active-lesson');
  assert.match(resume.reason, /already started/i);

  const hard = newState(NOW);
  practised(hard.starter, ['starter-hello']);
  const session = hard.starter.sessions[0];
  session.responses = session.responses.map((response, index) => (index < 3 ? { ...response, outcome: 'again' } : response));
  session.updatedAt = NOW + 5000;
  const retry = recommendNext(course, hard.starter);
  assert.equal(retry.lesson.id, 'starter-hello');
  assert.equal(retry.support, 'guided');
  assert.match(retry.reason, /another try/i);
});

test('a lighter-support lesson is saved, restored, and reflected in its Gemini pack', () => {
  const light = createStarterSession(content(), { support: 'light', now: NOW });
  assert.equal(supportOf(light), 'light');
  assert.equal(supportOf({ ...light, support: undefined }), 'guided', 'older saved lessons stay guided');
  const state = newState(NOW); state.starter.sessions.push(light);
  validateState(state);
  const pack = buildGeminiPack(starterGeminiSource(light.content, { support: 'light' }));
  assert.match(pack, /Support: less help/);
  assert.match(pack, /Do not offer help unless I ask/);
  assert.throws(() => createStarterSession(content(), { support: 'automatic' }), /guided or lighter/);
});

test('the Gemini pack states the lesson level and its language focus', () => {
  const source = starterGeminiSource(starterSnapshot(course, 'starter-yesterday'));
  const pack = buildGeminiPack(source);
  assert.match(pack, /Level target: A2/);
  assert.match(pack, /Talking about yesterday/);
  assert.match(pack, /about A2 in speaking/);
  const beginner = buildGeminiPack(starterGeminiSource(content()));
  assert.match(beginner, /Level target: Starter/);
  assert.match(beginner, /near-beginner/);
});

test('schema 4 upgrades retain AI and workplace progress while adding a separate starter collection', () => {
  const old = newState(NOW);
  old.schemaVersion = 4;
  delete old.starter; delete old.preferences.learningPath;
  const upgraded = upgradeState(old);
  assert.equal(upgraded.schemaVersion, SCHEMA_VERSION);
  assert.equal(upgraded.preferences.learningPath, 'starter');
  assert.deepEqual(upgraded.aiSessions, old.aiSessions);
  assert.deepEqual(upgraded.sessions, old.sessions);
  assert.deepEqual(upgraded.starter.reviews, []);
  assert.equal(old.starter, undefined);
});

test('beginner models are assisted, typed notes are not speaking, and a finish requires each spoken task', () => {
  const session = createStarterSession(content(), { now: NOW });
  const steps = starterSteps(session);
  const question = steps.find(step => step.kind === 'speak');
  assert.throws(() => starterResponse(session, question, spoken({ hintUsed: true }), 'independent'), /Needed help/);
  assert.throws(() => starterResponse(session, question, { ...starterDraft(), text: 'Ich heiße Sam.' }, 'independent'), /aloud/);
  assert.equal(starterCanFinish(session), false);
  for (const task of steps.filter(step => ['warmup', 'speak'].includes(step.kind))) {
    session.responses.push(starterResponse(session, task, spoken(), task.kind === 'warmup' ? 'unscored' : 'helped', NOW));
  }
  assert.equal(starterCanFinish(session), true);
  const state = newState(NOW); state.starter.sessions.push(session);
  validateState(state);
});

test('saved lessons freeze their content, retain recordings, and ignore duplicate results', async t => {
  const store = await createStore({ name: `starter-${crypto.randomUUID()}`, now: () => NOW });
  t.after(() => store.close());
  const snapshot = content();
  const session = createStarterSession(snapshot, { id: 'starter-session', now: NOW });
  snapshot.lesson.goal = 'A later edit';
  await store.addStarterSession(session);
  const key = `${session.id}:warmup`;
  await store.putRecording(key, new Blob(['test recording'], { type: 'audio/webm' }));
  const draft = spoken({ recordingMs: 1000, recordingKey: key });
  await store.saveStarterResponse(session.id, 'warmup', draft, 'unscored');
  await store.saveStarterResponse(session.id, 'warmup', draft, 'unscored');
  assert.equal(store.state.starter.sessions[0].responses.length, 1);
  assert.notEqual(store.state.starter.sessions[0].content.lesson.goal, 'A later edit');
  await assert.rejects(store.putRecording(key, new Blob(['replacement'])), /saved beginner response/);
  assert.equal(await (await store.getRecording(key)).text(), 'test recording');
  assert.equal(store.state.attempts.length, 0, 'supported lesson work does not create legacy mastery evidence');
});

test('recognition, spoken recall, and sentence use have separate review evidence', async t => {
  const store = await createStore({ name: `words-${crypto.randomUUID()}`, now: () => NOW });
  t.after(() => store.close());
  const word = course.words[0];
  const meaning = createWordSession([word], 'meaning', { id: 'meaning-session', now: NOW });
  await store.addWordSession(meaning);
  await store.saveWordReview(meaning.id, word.id, { ...starterDraft(), attempted: true, revealed: true }, 'independent');
  assert.equal(wordMemories(store.state.starter, 'meaning').size, 1);
  assert.equal(wordMemories(store.state.starter, 'recall').size, 0);

  const recall = createWordSession([word], 'recall', { id: 'recall-session', now: NOW });
  await store.addWordSession(recall);
  await assert.rejects(store.saveWordReview(recall.id, word.id, { ...starterDraft(), attempted: true, revealed: true }, 'independent'), /spoken recall/);
  await store.saveWordReview(recall.id, word.id, spoken({ attempted: true, revealed: true }), 'independent');
  await store.saveWordReview(recall.id, word.id, spoken({ attempted: true, revealed: true }), 'independent');
  assert.equal(store.state.starter.reviews.length, 2);
  assert.equal(wordMemories(store.state.starter, 'recall').get(word.id).recall.successes.length, 1);
  assert.equal(store.state.attempts.length, 0);
  validateState(store.state);
});

test('early reveal cannot become an independent word result and invalid imports are rejected', async t => {
  const store = await createStore({ name: `word-help-${crypto.randomUUID()}`, now: () => NOW });
  t.after(() => store.close());
  const word = course.words[0];
  const session = createWordSession([word], 'recall', { now: NOW });
  await store.addWordSession(session);
  const draft = spoken({ attempted: false, revealed: true, hintUsed: true });
  await assert.rejects(store.saveWordReview(session.id, word.id, draft, 'independent'), /Attempt before revealing/);
  await store.saveWordReview(session.id, word.id, draft, 'helped');
  const bad = structuredClone(store.state.starter);
  bad.reviews[0].outcome = 'independent';
  assert.throws(() => validateStarter(bad), /Attempt before revealing/);
});

test('Gemini export carries the selected lesson and only explicitly supplied profile fields', () => {
  const source = starterGeminiSource(starterSnapshot(course, 'starter-coffee'));
  const pack = buildGeminiPack(source);
  assert.match(pack, /starter-coffee/);
  assert.match(pack, /Einen Kaffee, bitte/);
  assert.match(pack, /about A1 in speaking/);
  assert.match(pack, /one short German question at a time/);
  assert.ok(!pack.includes('Werkstudent job'));
  const personal = buildGeminiPack(source, { facts: { name: 'Sam', token: 'never-export-this', GROQ_API_KEY: 'not-a-real-key' } });
  assert.match(personal, /Name: Sam/);
  assert.ok(!personal.includes('never-export-this') && !personal.includes('not-a-real-key'));
  assert.ok(pack.length < 9000);
});

test('each pack downloads once, caches separately, and opens with no network', async t => {
  const store = await createStore({ name: `course-${crypto.randomUUID()}` });
  t.after(() => store.close());
  const requested = [];
  const fetchImpl = async url => {
    const manifest = COURSE_PACKS.find(pack => url.endsWith(pack.file));
    requested.push(manifest.id);
    return Response.json(raws[manifest.id]);
  };
  const first = await loadCourse(store, { fetchImpl });
  const offline = await loadCourse(store, { fetchImpl: async () => { throw new Error('Offline'); } });
  assert.deepEqual(first, offline);
  assert.deepEqual(requested, COURSE_PACKS.map(pack => pack.id));
  assert.equal(first.packs.length, COURSE_PACKS.length);
  assert.ok(!(await store.export()).includes('coursePacks'), 'downloaded catalogs are not learner progress');

  // A newer pack must replace only its own cache entry.
  await store.putCoursePack({ ...packs[1], version: COURSE_PACKS[1].version });
  const second = [];
  await loadCourse(store, { fetchImpl: async url => { second.push(url); return Response.json(raws.everyday); } });
  assert.deepEqual(second, [], 'valid caches are reused');
  await assert.rejects(loadCourse({ ...store, getCoursePack: async () => null }, { fetchImpl: async () => new Response('no', { status: 404 }) }), /not saved on this device/);
});

test('beginner assignments stay stable and duplicate backup imports do not multiply work', async t => {
  const store = await createStore({ name: `starter-merge-${crypto.randomUUID()}`, now: () => NOW });
  t.after(() => store.close());
  const plan = await store.ensureStarterPlan(course);
  assert.equal(plan.wordIds.length, 5);
  const session = createStarterSession(content(), { now: NOW });
  await store.addStarterSession(session);
  await store.saveStarterDraft(session.id, 'warmup', spoken({ text: 'Hallo!' }));
  assert.deepEqual(await store.ensureStarterPlan(course), plan);
  const incoming = structuredClone(store.state);
  const merged = mergeProgress(mergeProgress(newState(NOW), incoming), incoming);
  assert.equal(merged.starter.sessions.length, 1);
  assert.equal(merged.starter.sessions[0].drafts.warmup.text, 'Hallo!');
  assert.equal(merged.starter.plans.length, 1);
  assert.equal(newStarterPlan(merged, course, '2023-11-15', NOW).lessonId, session.lessonId);
});

test('word practice, bookmarks, activity and Gemini takeaways survive repeated transfer to a fresh device', async t => {
  const source = await createStore({ name: `starter-source-${crypto.randomUUID()}`, now: () => NOW });
  const target = await createStore({ name: `starter-target-${crypto.randomUUID()}`, now: () => NOW });
  t.after(() => { source.close(); target.close(); });
  const word = course.words[0];
  const session = createWordSession([word], 'recall', { now: NOW });
  await source.addWordSession(session);
  await source.saveWordReview(session.id, word.id, spoken({ revealed: true, attempted: true }), 'independent');
  await source.saveWord(word.id, true);
  await source.addActivity([{ id: 'word-clock:1', sessionId: session.id, start: NOW, end: NOW + 1000, ms: 1000, day: '2023-11-14' }]);
  await source.addCompanionNote({ id: 'gemini-note', missionId: 'starter-hello', text: 'Ich heiße Sam.', minutes: 5 });
  const exported = await source.export();
  await target.import(exported); await target.import(exported);
  assert.equal(target.state.starter.reviews.length, 1);
  assert.equal(target.state.starter.wordSessions.length, 1);
  assert.equal(target.state.starter.wordMarks.length, 1);
  assert.equal(target.state.companionNotes.length, 1);
  assert.equal(target.state.activity.length, 1);
  assert.equal(target.state.attempts.length, 0);
  validateState(target.state);
});

test('merging two devices preserves both saved beginner replies and the more advanced position', () => {
  const local = newState(NOW); const remote = newState(NOW);
  const session = createStarterSession(content(), { id: 'shared-starter', now: NOW });
  const steps = starterSteps(session);
  local.starter.sessions.push(structuredClone(session)); remote.starter.sessions.push(structuredClone(session));
  local.starter.sessions[0].responses.push(starterResponse(session, steps[0], spoken(), 'unscored', NOW));
  remote.starter.sessions[0].responses.push(starterResponse(session, steps[4], spoken(), 'independent', NOW + 1000));
  remote.starter.sessions[0].cursor = 5; remote.starter.sessions[0].updatedAt = NOW + 1000;
  const merged = mergeProgress(local, remote);
  assert.equal(merged.starter.sessions[0].responses.length, 2);
  assert.equal(merged.starter.sessions[0].cursor, 5);
  assert.equal(mergeProgress(merged, remote).starter.sessions[0].responses.length, 2);
});
