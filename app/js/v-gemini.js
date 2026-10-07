import { missionById, phraseById } from '../data/missions.js';
import { starterLessonById } from '../data/starter-catalog.js';
import { loadStarterCourse, starterSnapshot } from './starter-content.js';
import { starterGeminiSource, missionGeminiSource } from './gemini-pack.js';
import { mountGeminiExport } from './gemini-export.js';
import { mountCompanionReflection, courseError } from './starter-ui.js';
import { pageHeading, icon } from './ui.js';

export async function geminiSource(ctx, id) {
  const saved = ctx.store.state.sessions.find(session => session.id === id);
  if (saved) return missionGeminiSource(saved.content.mission, saved.content);
  if (starterLessonById(id)) {
    const active = ctx.store.state.starter.sessions.find(session => session.lessonId === id && !session.completedAt);
    return starterGeminiSource(active?.content ?? starterSnapshot(await loadStarterCourse(ctx.store, { signal: ctx.signal }), id));
  }
  const mission = missionById(id);
  if (!mission) throw new Error('Choose a lesson to export.');
  return missionGeminiSource(mission, null, mission.phraseIds.map(id => phraseById(id)));
}
export async function render(el, ctx, id) {
  let source;
  try { source = await geminiSource(ctx, id); } catch (error) { courseError(el, ctx, error); return; }
  if (ctx.signal.aborted) return;
  el.innerHTML = `<a class="inline-link" href="${starterLessonById(id) ? `#lesson/${id}` : '#practice'}">${icon('back')}Back to lessons</a>${pageHeading('YOUR LESSON, ON YOUR PHONE', source.title, 'A portable practice pack for a short, natural conversation. No gateway or API key is needed to export it.')}<div id="gemini-lesson-pack"></div><div class="section-gap" id="gemini-lesson-note"></div>`;
  mountGeminiExport(el.querySelector('#gemini-lesson-pack'), ctx, source, { open: true });
  mountCompanionReflection(el.querySelector('#gemini-lesson-note'), ctx, source.id);
}
