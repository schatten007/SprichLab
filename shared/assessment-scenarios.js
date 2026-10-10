import { hashJSON, validateAssessmentDefinition } from './assessment-contracts.js';

/** Derive grading criteria only from published, authored lesson tasks; never from a client's prompt. */
export async function assessmentForSource(source, variant = 0) {
  const questions = source.practice.slice(0, 3);
  const goals = (source.assessmentGoals ?? questions.map(task => task.cue || `Respond appropriately to: ${task.promptEn || task.promptDe}`)).slice(0, 3)
    .map((goal, index) => ({ id: `goal-${index + 1}`, text: goal }));
  const variation = source.variations?.[0]?.cue;
  if (variation) goals.push({ id: 'variation', text: variation });
  const dialogue = source.dialogue?.map(line => `${line.speaker}: ${line.de} — ${line.en}`).join('\n') ?? source.dialogueText ?? '';
  const preparation = [source.warmup ? `${source.warmup.de} — ${source.warmup.en}` : '',
    ...source.words.slice(0, 8).map(word => `${word.de} — ${word.en}`), ...source.patterns.map(pattern => `${pattern.de} — ${pattern.en}`), dialogue].filter(Boolean).join('\n').slice(0, 4500);
  const definition = { schemaVersion: 1, id: `lesson.${source.id}.${variant}`, version: 'derived-roleplay-1', kind: 'roleplay',
    title: `${source.title} · conversation ${variant ? 'B' : 'A'}`, level: source.level ?? 'A2', lessonIds: [source.id],
    skillIds: [source.skill ?? 'interaction'], familyId: `lesson-${source.id}`, formId: variant ? 'b' : 'a',
    exposureGroupIds: [source.id], instructions: source.goal, stimuli: [], items: [], rubricId: 'conversation:1', task: null,
    scenario: { id: source.id, variantId: `variant-${variant}`, register: source.register,
      learnerRole: `The learner in this situation: ${source.goal}`,
      partnerRole: `A natural conversation partner in: ${source.title}`,
      learnerTask: `${source.goal}\n${goals.map(goal => goal.text).join('\n')}`,
      partnerInstructions: `Keep to the published scenario. Give the learner an opportunity for each goal, but do not supply their answers. Use their answers in your follow-ups. Question ideas: ${questions.map(task => task.promptDe).join(' | ')}. The variation is: ${variation ?? 'change one practical detail'}. Personal facts must come from the learner; examples in preparation are not facts about them.`,
      openingDe: questions[0]?.promptDe || 'Guten Tag! Wie kann ich helfen?', openingEn: questions[0]?.promptEn || 'Hello! How can I help?', preparation, goals },
  };
  // Classification and authored task changes produce a different version, even when the lesson ID stays stable.
  definition.version = await hashJSON(definition);
  return validateAssessmentDefinition(definition);
}
