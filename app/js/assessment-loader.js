import { ASSESSMENT_PACKS, assessmentPackFor, lessonAssessmentRef, lessonAssessmentId } from '../../shared/assessment-manifest.js';
import { validateAssessmentPack, check, ASSESSMENT_LIMITS } from '../../shared/assessment-contracts.js';
import { assessmentForSource } from '../../shared/assessment-scenarios.js';
import { COURSE_LESSONS } from '../data/starter-catalog.js';
import { MISSIONS, missionById, phraseById } from '../data/missions.js';
import { loadCourse, starterSnapshot } from './starter-content.js';
import { starterGeminiSource, missionGeminiSource } from './gemini-pack.js';

export function assessmentChoices(lessonId = null) {
  const pilots = ASSESSMENT_PACKS.flatMap(pack => pack.definitionIds.map(id => ({ id, version: pack.version,
    kind: id.split('.').at(-1), title: `${pack.family === 'cafe' ? 'Café and shopping' : 'Changing an appointment'} · ${id.split('.').at(-1)} ${pack.form.toUpperCase()}`,
    level: pack.family === 'cafe' ? 'A1' : 'A2', lessonIds: pack.family === 'cafe' ? ['starter-coffee', 'starter-prices', 'starter-time'] : ['starter-meeting-time', 'starter-change-time', 'starter-repeat'] })));
  const roles = [...COURSE_LESSONS.map(lesson => ({ ...lesson, label: lesson.title })), ...MISSIONS.map(mission => ({ ...mission, label: mission.shortTitle, level: mission.level === 'B1 practice' ? 'B1' : 'A2' }))]
    .flatMap(lesson => [0, 1].map(variant => ({ id: lessonAssessmentId(lesson.id, variant), version: null, kind: 'roleplay', title: `${lesson.label} · conversation ${variant ? 'B' : 'A'}`, level: lesson.level, lessonIds: [lesson.id] })));
  return [...pilots, ...roles].filter(item => !lessonId || item.lessonIds.includes(lessonId));
}

export function missionAssessmentSource(mission, variant) {
  const selected = { ...mission, listening: [mission.listening[variant % mission.listening.length]],
    turns: mission.turns.map(turn => ({ ...turn, prompts: [turn.prompts[variant % turn.prompts.length]], promptsEn: [turn.promptsEn?.[variant % turn.prompts.length] ?? 'Please answer the question.'] })) };
  return { ...missionGeminiSource(selected, null, mission.phraseIds.map(id => phraseById(id))), level: mission.level === 'B1 practice' ? 'B1' : 'A2',
    assessmentGoals: selected.turns.slice(0, 3).map(turn => turn.goal) };
}

export async function loadAssessmentDefinition(store, definitionId, version = null, { signal, fetchImpl = (...args) => fetch(...args) } = {}) {
  const derived = lessonAssessmentRef(definitionId);
  if (derived) {
    const mission = missionById(derived.lessonId);
    let source;
    if (mission) source = missionAssessmentSource(mission, derived.variant);
    else {
      check(COURSE_LESSONS.some(lesson => lesson.id === derived.lessonId), 'Unknown assessment lesson.');
      const course = await loadCourse(store, { signal, fetchImpl });
      source = starterGeminiSource(starterSnapshot(course, derived.lessonId), { variant: derived.variant });
    }
    const definition = await assessmentForSource(source, derived.variant);
    check(version === null || definition.version === version, 'The published task changed. Start a new assessment; saved results keep their original content.');
    return definition;
  }
  const manifest = assessmentPackFor(definitionId, version ?? '1');
  check(manifest, 'This assessment definition/version is not published.');
  let pack = await store.getAssessmentPack(manifest.id, manifest.version).catch(() => null);
  if (pack) { try { validateAssessmentPack(pack, manifest); } catch { pack = null; } }
  if (!pack) {
    const controller = new AbortController(); const abort = () => controller.abort();
    if (signal?.aborted) controller.abort(); else signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(abort, 12000);
    try {
      const response = await fetchImpl(new URL(manifest.file, globalThis.location?.href ?? 'http://localhost/').href, { signal: controller.signal, credentials: 'omit' });
      check(response.ok && (response.headers.get('Content-Type') ?? '').includes('application/json'), 'The assessment pack could not be downloaded. Connect and try again.');
      const raw = await response.text();
      check(new TextEncoder().encode(raw).length <= ASSESSMENT_LIMITS.packBytes, 'The assessment pack is too large.');
      pack = validateAssessmentPack(JSON.parse(raw), manifest);
      check(pack.definitions.length === manifest.definitionIds.length && manifest.definitionIds.every(id => pack.definitions.some(def => def.id === id && def.version === manifest.version)), 'The assessment pack is incomplete.');
      await store.putAssessmentPack(pack);
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
  }
  const definition = pack.definitions.find(item => item.id === definitionId && item.version === manifest.version);
  check(definition, 'This assessment is missing from its pack.');
  return structuredClone(definition);
}
