/** Editorial helpers keep each German passage beside its English meaning and answer keys. */
export function dialogue(title, lines, questions) {
  return {
    title, dialogue: lines.map(([speaker, de, en]) => ({ speaker, de, en })),
    transcript: lines.map(([, de]) => de).join(' '),
    transcriptEn: lines.map(([, , en]) => en).join(' '),
    questions: questions.map(([id, question, questionEn, options, answer]) => ({
      id, question, questionEn, options: options.map(option => option[0]), optionsEn: options.map(option => option[1]), answer,
    })),
  };
}

export function turn(id, data) {
  const prompts = [data.ask, data.also ?? data.simpler];
  return {
    id, prompts: prompts.map(item => item[0]), promptsEn: prompts.map(item => item[1]),
    rephrase: data.simpler[0], rephraseEn: data.simpler[1], goalDe: data.goal[0], goal: data.goal[1],
    model: data.model[0], modelEn: data.model[1], phraseIds: data.phrases,
    criteriaDe: data.checks.map(item => item[0]), criteria: data.checks.map(item => item[1]),
    essential: Boolean(data.essential), ...(data.intents ? { intents: data.intents } : {}), ...(data.branch ? { branch: data.branch } : {}),
  };
}

export function mission(data) {
  const retry = turn('retry', data.retry);
  return {
    ...data, goalDe: data.goal[0], goal: data.goal[1], situationDe: data.situation[0], situation: data.situation[1],
    shadow: data.shadow[0], shadowEn: data.shadow[1], retry: data.retry.goal[1], retryDe: data.retry.goal[0],
    retryTask: { ...retry, prompt: data.retry.ask[0], promptEn: data.retry.ask[1] },
  };
}

export const RETRY_CHECKS = [
  ['Ich habe die wichtigen Informationen genannt.', 'I covered the key information.'],
  ['Ich brauchte weniger Hilfe oder Pausen.', 'I needed fewer prompts or pauses.'],
  ['Meine Antwort war beim Anhören verständlich.', 'I could understand my answer on replay.'],
];
