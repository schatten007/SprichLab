import { COURSE_LESSONS, COURSE_MODULES, COURSE_PACKS, lessonById, packById } from '../data/starter-catalog.js';
import { ensure, isId, isText, isObject } from '../../shared/ai-contracts.js';

const filled = (value, max = 1500) => isText(value, max) && value.trim();
const uniqueIds = items => new Set(items.map(item => item.id)).size === items.length;
const WORD_TYPES = ['noun', 'verb', 'adjective', 'adverb', 'pronoun', 'number', 'preposition', 'conjunction', 'expression', 'language'];

/** Saved lessons may hold a single legacy dialogue or several alternatives. */
export const lessonDialogues = lesson => (Array.isArray(lesson.dialogues) && lesson.dialogues.length ? lesson.dialogues : [lesson.dialogue ?? []]);

export function validateWord(word) {
  ensure(isObject(word) && isId(word.id) && filled(word.de, 100) && filled(word.en, 300), 'A word needs a stable ID and both meanings.');
  ensure(WORD_TYPES.includes(word.pos), 'Unknown word type.');
  ensure(isText(word.forms, 300) && filled(word.exampleDe, 500) && filled(word.exampleEn, 500), 'A word needs a bilingual example.');
  ensure(Number.isInteger(word.unit) && word.unit >= 1 && word.unit <= COURSE_MODULES.length, 'Invalid vocabulary unit.');
  if (word.pos === 'noun') ensure(/^(der|die|das) /.test(word.de) && word.forms.trim(), 'Teach nouns with their article and plural (or singular-only note).');
  if (word.pos === 'verb') ensure(word.forms.trim(), 'Teach verbs with a useful spoken form.');
  return word;
}

function validateDialogue(dialogue) {
  ensure(Array.isArray(dialogue) && dialogue.length >= 4 && dialogue.length <= 8, 'Use a short 4–8-line conversation.');
  dialogue.forEach(line => ensure(isObject(line) && filled(line.speaker, 100) && filled(line.de) && filled(line.en), 'Translate every dialogue line.'));
}

export function validateStarterLesson(lesson) {
  ensure(isObject(lesson) && lessonById(lesson.id) && filled(lesson.title, 200) && filled(lesson.titleDe, 200), 'Invalid lesson.');
  ensure(Number.isInteger(lesson.number) && lesson.number >= 1 && lesson.number <= COURSE_LESSONS.length, 'Invalid lesson order.');
  ensure(Number.isInteger(lesson.unit) && lesson.unit >= 1 && lesson.unit <= COURSE_MODULES.length, 'Invalid lesson module.');
  ensure(['du', 'Sie'].includes(lesson.register) && filled(lesson.goal), 'The lesson needs a goal and a consistent register.');
  ensure(isObject(lesson.warmup) && filled(lesson.warmup.de) && filled(lesson.warmup.en), 'Begin with a bilingual phrase to say aloud.');
  ensure(Array.isArray(lesson.wordIds) && lesson.wordIds.length >= 5 && lesson.wordIds.length <= 8 && lesson.wordIds.every(isId) && new Set(lesson.wordIds).size === lesson.wordIds.length, 'Use 5–8 distinct word targets.');
  ensure(Array.isArray(lesson.patterns) && lesson.patterns.length >= 1 && lesson.patterns.length <= 2, 'Use one or two sentence patterns.');
  lesson.patterns.forEach(pattern => ensure(isObject(pattern) && filled(pattern.de) && filled(pattern.en) && filled(pattern.note), 'Explain each sentence pattern.'));
  const dialogues = lessonDialogues(lesson);
  ensure(dialogues.length >= 1 && dialogues.length <= 2, 'Use one or two model conversations.');
  dialogues.forEach(validateDialogue);
  ensure(Array.isArray(lesson.practice) && lesson.practice.length === 3 && Array.isArray(lesson.variations) && lesson.variations.length === 2, 'Include three guided replies and two variations.');
  [...lesson.practice, ...lesson.variations].forEach(task => {
    ensure(isObject(task) && filled(task.cue) && filled(task.promptDe) && filled(task.promptEn) && filled(task.modelDe) && filled(task.modelEn), 'Every speaking task needs a question, meaning, and optional model.');
  });
  return lesson;
}

export function validateStarterSnapshot(content) {
  ensure(isObject(content) && filled(content.version, 100), 'Missing lesson content version.');
  validateStarterLesson(content.lesson);
  ensure(Array.isArray(content.words) && content.words.length === content.lesson.wordIds.length && uniqueIds(content.words), 'Invalid saved word targets.');
  content.words.forEach(validateWord);
  ensure(content.lesson.wordIds.every(id => content.words.some(word => word.id === id)), 'A saved lesson is missing a target word.');
  return content;
}

export function validatePack(pack) {
  const manifest = packById(pack?.id);
  ensure(manifest && pack.version === manifest.version, 'This content pack belongs to a different app version.');
  ensure(Array.isArray(pack.words) && pack.words.length === manifest.words && uniqueIds(pack.words), `The ${pack.id} pack needs all ${manifest.words} distinct words.`);
  ensure(Array.isArray(pack.lessons) && uniqueIds(pack.lessons), 'Duplicate lessons in the content pack.');
  pack.words.forEach(validateWord);
  pack.lessons.forEach(validateStarterLesson);
  const ids = pack.lessons.map(lesson => lesson.id);
  ensure(manifest.lessonIds.length === ids.length && manifest.lessonIds.every(id => ids.includes(id)), `The ${pack.id} pack needs all ${manifest.lessonIds.length} of its catalog lessons.`);
  return pack;
}

/** One merged course from every pack, with each lesson's own pack version kept for snapshots. */
export function mergeCourse(packs) {
  packs.forEach(validatePack);
  const words = packs.flatMap(pack => pack.words);
  const lessons = packs.flatMap(pack => pack.lessons.map(lesson => ({ ...lesson, packVersion: pack.version })))
    .sort((a, b) => a.number - b.number);
  ensure(uniqueIds(words) && uniqueIds(lessons), 'Duplicate content across packs.');
  ensure(lessons.length === COURSE_LESSONS.length, 'The course is missing a lesson pack.');
  const wordIds = new Set(words.map(word => word.id));
  const used = new Set(lessons.flatMap(lesson => lesson.wordIds));
  lessons.forEach(lesson => lesson.wordIds.forEach(id => ensure(wordIds.has(id), `${lesson.id} refers to a missing word.`)));
  words.forEach(word => ensure(used.has(word.id), `${word.id} is not taught by any lesson.`));
  return { version: packs.map(pack => pack.version).join(' + '), packs: packs.map(pack => ({ id: pack.id, version: pack.version })), words, lessons };
}

/** Compact authored JSON is expanded once into the shape used by frozen snapshots. */
export function parsePack(raw) {
  ensure(isObject(raw) && Array.isArray(raw.words) && Array.isArray(raw.lessons), 'The content pack could not be read.');
  const task = ([cue, promptDe, promptEn, modelDe, modelEn]) => ({ cue, promptDe, promptEn, modelDe, modelEn });
  const dialogue = lines => lines.map(([speaker, de, en]) => ({ speaker, de, en }));
  return validatePack({ id: raw.id, version: raw.version,
    words: raw.words.map(([id, de, en, pos, forms, exampleDe, exampleEn, unit]) => ({ id, de, en, pos, forms, exampleDe, exampleEn, unit })),
    lessons: raw.lessons.map(lesson => ({ ...lessonById(lesson.id), id: lesson.id, goal: lesson.goal,
      warmup: { de: lesson.warmup[0], en: lesson.warmup[1] }, wordIds: lesson.wordIds,
      patterns: lesson.patterns.map(([de, en, note]) => ({ de, en, note })),
      dialogues: (lesson.dialogues ?? [lesson.dialogue]).map(dialogue),
      practice: lesson.practice.map(task), variations: lesson.variations.map(task),
    })),
  });
}

export function starterSnapshot(course, id) {
  const lesson = course.lessons.find(item => item.id === id);
  ensure(lesson, 'Choose an available lesson.');
  return structuredClone({ version: lesson.packVersion ?? course.version, lesson,
    words: lesson.wordIds.map(wordId => course.words.find(word => word.id === wordId)) });
}

async function loadPack(store, manifest, { fetchImpl, signal }) {
  const cached = await store.getCoursePack(manifest.id).catch(() => null);
  if (cached?.version === manifest.version) { try { return validatePack(cached); } catch { /* Replace a damaged cache when online. */ } }
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, 12_000);
  try {
    const response = await fetchImpl(new URL(manifest.file, globalThis.location?.href ?? 'http://localhost/').href, { signal: controller.signal, credentials: 'omit' });
    if (!response.ok) throw new Error(`Download failed with status ${response.status}.`);
    const text = await response.text();
    ensure(text.length <= 900_000, 'The content download was unexpectedly large.');
    const pack = parsePack(JSON.parse(text));
    await store.putCoursePack(pack);
    return pack;
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}

/** Packs are separate versioned downloads. Their IndexedDB copies work offline and are not progress. */
export async function loadCourse(store, { fetchImpl = (...args) => fetch(...args), signal } = {}) {
  const packs = [];
  for (const manifest of COURSE_PACKS) {
    try { packs.push(await loadPack(store, manifest, { fetchImpl, signal })); }
    catch (error) {
      if (signal?.aborted) throw error;
      throw new Error('Some lessons are not saved on this device yet. Check your connection and this site’s storage, then choose Try again. Lessons you already started stay available.', { cause: error });
    }
  }
  await store.pruneCoursePacks(COURSE_PACKS.map(pack => pack.id)).catch(() => {});
  return mergeCourse(packs);
}

export const loadStarterCourse = loadCourse;
export const validateCourse = mergeCourse;
export const parseCourse = parsePack;
