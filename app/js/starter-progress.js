import { reviewStates, nextDue } from './srs.js';
import { COURSE_STAGES, lessonById } from '../data/starter-catalog.js';

export function wordMemories(starter, mode = 'recall') {
  return reviewStates(starter.reviews.filter(review => review.mode === mode).map(review => ({ ...review, kind: 'recall', phraseIds: [review.wordId] })));
}
export function dueWords(course, starter, mode = 'recall', now = Date.now()) {
  const memories = wordMemories(starter, mode);
  return course.words.filter(word => nextDue(memories.get(word.id)) !== null && nextDue(memories.get(word.id)) <= now)
    .sort((a, b) => nextDue(memories.get(a.id)) - nextDue(memories.get(b.id)));
}

/** Lessons in recommended order, so a growing catalog never changes the path arbitrarily. */
export const pathLessons = course => [...course.lessons].sort((a, b) => (lessonById(a.id)?.pathOrder ?? 0) - (lessonById(b.id)?.pathOrder ?? 0));
export const practisedLessons = starter => new Set(starter.sessions.filter(session => session.completedAt).map(session => session.lessonId));
export const activeSession = (starter, lessonId) => starter.sessions.find(session => session.lessonId === lessonId && !session.completedAt);
export function lessonStatus(starter, lessonId) {
  if (practisedLessons(starter).has(lessonId)) return 'practised';
  return activeSession(starter, lessonId) ? 'active' : 'new';
}
export function missingPrerequisites(course, starter, lessonId) {
  const practised = practisedLessons(starter);
  return (lessonById(lessonId)?.prerequisites ?? [])
    .filter(id => !practised.has(id))
    .map(id => course.lessons.find(lesson => lesson.id === id) ?? lessonById(id))
    .filter(Boolean);
}
/** A lesson the learner recently marked hard enough to be worth a supported retry. */
export function strugglingLesson(starter) {
  return [...starter.sessions]
    .filter(session => session.responses.filter(response => response.outcome === 'again').length >= 2)
    .sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null;
}

export function recommendNext(course, starter) {
  const ordered = pathLessons(course);
  const practised = practisedLessons(starter);
  const resume = [...starter.sessions].filter(session => !session.completedAt).sort((a, b) => b.updatedAt - a.updatedAt)[0];
  if (resume) {
    const lesson = course.lessons.find(item => item.id === resume.lessonId);
    if (lesson) return { lesson, session: resume, support: resume.support ?? 'guided', prep: [], reason: 'You already started this lesson. Carry on where you stopped.' };
  }
  const hard = strugglingLesson(starter);
  if (hard && practised.has(hard.lessonId)) {
    const lesson = course.lessons.find(item => item.id === hard.lessonId);
    if (lesson) return { lesson, session: null, support: 'guided', prep: missingPrerequisites(course, starter, lesson.id),
      reason: 'You marked several answers here for another try. One more guided round will help before moving on.' };
  }
  const ready = ordered.find(lesson => !practised.has(lesson.id) && !missingPrerequisites(course, starter, lesson.id).length);
  if (ready) {
    return { lesson: ready, session: null, support: 'guided', prep: [],
      reason: practised.size ? 'This is the next step on your path, and you have practised what it builds on.' : 'A small first lesson: say hello, give your name, and ask a name.' };
  }
  const next = ordered.find(lesson => !practised.has(lesson.id));
  if (next) {
    return { lesson: next, session: null, support: 'guided', prep: missingPrerequisites(course, starter, next.id),
      reason: 'This is next on your path. The lessons below prepare it, but you can start whenever you like.' };
  }
  const oldest = [...starter.sessions].filter(session => session.completedAt).sort((a, b) => a.completedAt - b.completedAt)[0];
  const lesson = course.lessons.find(item => item.id === oldest?.lessonId) ?? ordered[0];
  return { lesson, session: null, support: 'light', prep: [],
    reason: 'You have practised every lesson once. Repeat this one with less help, or try another variation.' };
}

export function stageSummary(course, starter) {
  const practised = practisedLessons(starter);
  return COURSE_STAGES.map(stage => {
    const lessons = pathLessons(course).filter(lesson => lessonById(lesson.id)?.stage === stage.id);
    return { stage, lessons, total: lessons.length, done: lessons.filter(lesson => practised.has(lesson.id)).length };
  });
}
export function currentStage(course, starter) {
  const summary = stageSummary(course, starter);
  return summary.find(item => item.done < item.total) ?? summary.at(-1);
}

export function newStarterPlan(state, course, day, now = Date.now()) {
  const { lesson } = recommendNext(course, state.starter);
  const known = new Set(state.starter.reviews.map(review => review.wordId));
  const fresh = lesson.wordIds.filter(id => !known.has(id));
  return { id: day, lessonId: lesson.id, wordIds: (fresh.length ? fresh : lesson.wordIds).slice(0, 5), createdAt: now, updatedAt: now, reflection: '' };
}

export function wordProgressSummary(starter) {
  const recognition = new Set(starter.reviews.filter(review => review.mode === 'meaning' && review.outcome === 'independent').map(review => review.wordId)).size;
  const recalled = new Set(starter.reviews.filter(review => review.mode === 'recall' && review.spoken && review.outcome === 'independent').map(review => review.wordId)).size;
  const used = new Set(starter.reviews.filter(review => review.mode === 'sentence' && review.spoken && review.outcome === 'independent').map(review => review.wordId)).size;
  const due = [...wordMemories(starter).values()].filter(memory => nextDue(memory) !== null && nextDue(memory) <= Date.now()).length;
  return { recognition, recalled, used, due };
}
export const nextStarterLesson = (course, starter) => recommendNext(course, starter).lesson;
