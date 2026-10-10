import { readFile } from 'node:fs/promises';
import { ASSESSMENT_PACKS } from '../shared/assessment-manifest.js';
import { COURSE_PACKS } from '../app/data/starter-catalog.js';
import { createAssessmentDefinitionLoader } from '../worker/assessment-definitions.js';

const allowed = new Set([...ASSESSMENT_PACKS.map(pack => pack.file), ...COURSE_PACKS.map(pack => pack.file)]);
export const loadLocalAssessment = createAssessmentDefinitionLoader(async path => {
  if (!allowed.has(path)) throw new Error('Unregistered assessment asset.');
  return JSON.parse(await readFile(new URL(`../app/public/${path}`, import.meta.url), 'utf8'));
});
