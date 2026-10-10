export const ASSESSMENT_PACKS = ['cafe', 'appointment'].flatMap(family => ['a', 'b'].map(form => ({
  id: `pilot-${family}-${form}`, version: '1', file: `assessments/pilot-${family}-${form}-v1.json`, family, form,
  definitionIds: ['objective', 'writing', 'roleplay'].map(kind => `pilot.${family}.${form}.${kind}`),
})));
export function assessmentPackFor(id, version = '1') {
  return ASSESSMENT_PACKS.find(pack => pack.version === version && pack.definitionIds.includes(id));
}
export const lessonAssessmentId = (lessonId, variant = 0) => `lesson.${lessonId}.${variant}`;
export function lessonAssessmentRef(id) {
  const match = /^lesson\.([a-zA-Z0-9_-]+)\.([01])$/.exec(id);
  return match ? { lessonId: match[1], variant: Number(match[2]) } : null;
}
