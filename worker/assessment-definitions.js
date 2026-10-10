import { assessmentPackFor, lessonAssessmentRef } from '../shared/assessment-manifest.js';
import { validateAssessmentPack } from '../shared/assessment-contracts.js';
import { assessmentForSource } from '../shared/assessment-scenarios.js';
import { COURSE_PACKS, lessonById } from '../app/data/starter-catalog.js';
import { missionById } from '../app/data/missions.js';
import { parsePack, mergeCourse, starterSnapshot } from '../app/js/starter-content.js';
import { starterGeminiSource } from '../app/js/gemini-pack.js';
import { missionAssessmentSource } from '../app/js/assessment-loader.js';
import { problem } from './errors.js';

/** readAsset only accepts paths produced by these manifests, never a path or URL from the request. */
export function createAssessmentDefinitionLoader(readAsset) {
  const cached = new Map();
  const get = async path => {
    if (cached.has(path)) return cached.get(path);
    const value = await readAsset(path);
    cached.set(path, value);
    return value;
  };
  const resolve = async (reference, context = {}) => {
    const derived = lessonAssessmentRef(reference.id);
    if (derived) {
      let source; const mission = missionById(derived.lessonId);
      if (mission) source = missionAssessmentSource(mission, derived.variant);
      else {
        if (!lessonById(derived.lessonId)) throw problem(404, 'assessment_not_found', 'This lesson has no published assessment.');
        const packs = await Promise.all(COURSE_PACKS.map(async pack => parsePack(await get(pack.file))));
        source = starterGeminiSource(starterSnapshot(mergeCourse(packs), derived.lessonId), { variant: derived.variant });
      }
      const def = await assessmentForSource(source, derived.variant);
      if (reference.version !== def.version) throw problem(409, 'assessment_version', 'The published roleplay changed. Start a new assessment; previous grades remain saved.');
      return def;
    }
    const manifest = assessmentPackFor(reference.id, reference.version);
    if (!manifest) throw problem(404, 'assessment_not_found', 'This assessment definition/version is not published.');
    try {
      const pack = validateAssessmentPack(await get(manifest.file), manifest);
      const definition = pack.definitions.find(def => def.id === reference.id && def.version === reference.version);
      if (!definition) throw new Error('Missing definition.');
      return definition;
    } catch (error) {
      if (error.status) throw error;
      context.logger?.error({ event: 'assessment_definition_invalid' });
      throw problem(503, 'assessment_content', 'The assessment definition could not be loaded. Your response is saved.');
    }
  };
  return async (reference, context = {}) => {
    try { return await resolve(reference, context); }
    catch (error) {
      if (error.status) throw error;
      context.logger?.error({ event: 'assessment_definition_invalid' });
      throw problem(503, 'assessment_content', 'The assessment definition could not be loaded. Your response is saved.');
    }
  };
}

export async function loadWorkerAssessment(reference, { env, request }) {
  if (!env.ASSETS) throw problem(503, 'assessment_content', 'Assessment assets are not configured on this gateway.');
  const loader = createAssessmentDefinitionLoader(async path => {
    const response = await env.ASSETS.fetch(new URL(path, new URL('/', request.url)));
    if (!response.ok || !(response.headers.get('Content-Type') ?? '').includes('application/json')) throw problem(503, 'assessment_content', 'The assessment asset is unavailable.');
    const raw = await response.text();
    if (new TextEncoder().encode(raw).length > 900000) throw problem(503, 'assessment_content', 'The assessment asset is too large.');
    return JSON.parse(raw);
  });
  return loader(reference);
}
