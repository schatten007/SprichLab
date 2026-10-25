export const ASSESSMENT_RUBRICS = {
  'conversation:1': { id: 'conversation:1', title: 'Conversation', criteria: [
    ['task', 'Task achievement', 'Accomplish the stated goals that the partner actually elicited.'],
    ['interaction', 'Interaction and relevance', 'Respond appropriately, ask useful questions, and repair misunderstandings.'],
    ['clarity', 'Clarity and coherence', 'Communicate an understandable and consistent meaning. This is not an acoustic judgment.'],
    ['vocabulary', 'Vocabulary', 'Use words and natural alternatives appropriate to this task and level.'],
    ['grammar', 'Grammar', 'Control the relevant forms and sentence patterns at the target level.'],
  ] },
  'writing:1': { id: 'writing:1', title: 'Writing', criteria: [
    ['task', 'Task fulfilment', 'Address the requested points and use the given facts correctly.'],
    ['organisation', 'Organisation', 'Organise the message so its purpose and sequence can be followed.'],
    ['vocabulary', 'Vocabulary', 'Choose words appropriate to the message and target level.'],
    ['grammar', 'Grammar', 'Control the relevant grammatical forms at the target level.'],
    ['mechanics', 'Spelling and punctuation', 'Use written spelling, noun capitalization, and punctuation appropriately.'],
  ] },
};
export const RATING_ANCHORS = [
  'Observable failure despite an opportunity to demonstrate the criterion.',
  'Limited success; substantial communication or language problems.',
  'Partially meets the target; several problems remain.',
  'Mostly meets the target, with minor problems.',
  'Meets this task-level target consistently; native-like language is not required.',
];
export function assessmentRubric(id) {
  const rubric = ASSESSMENT_RUBRICS[id];
  if (!rubric) throw new Error('Unsupported assessment rubric.');
  return rubric;
}
