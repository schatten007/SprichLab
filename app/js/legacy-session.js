import { MISSIONS, PHRASES } from '../data/legacy-content.js';

/** Preserve the exact v2 task ordering, prompts, answer keys, and recording IDs. */
export function freezeLegacySession(session) {
  const mission = MISSIONS.find(item => item.id === session.missionId);
  if (!mission) throw new Error('An older session refers to an unknown mission. Its data has not been reset.');
  const recall = session.phraseIds.filter(id => PHRASES.some(phrase => phrase.id === id))
    .map(id => ({ id: `recall-${id}`, kind: 'recall', phraseId: id }));
  let tasks;
  if (session.kind === 'review') tasks = [...recall, { id: 'wrap', kind: 'wrap' }];
  else {
    const turns = session.short ? mission.turns.filter(turn => ['intro', 'availability'].includes(turn.id)).slice(0, 2) : mission.turns;
    tasks = [
      { id: 'brief', kind: 'brief' },
      { id: 'listen', kind: 'listen', listening: mission.listening[session.variant % mission.listening.length] },
      ...recall,
      ...(!session.short ? [{ id: 'shadow', kind: 'shadow', model: mission.shadow }] : []),
      ...turns.map(turn => ({ ...turn, kind: 'speak', prompt: turn.prompts[session.variant % turn.prompts.length] })),
      { ...mission.turns[0], id: 'retry', kind: 'speak', prompt: 'Noch einmal: Erzählen Sie bitte in Ihren eigenen Worten.',
        goal: mission.retry, retry: true, criteria: ['I covered the key information.', 'I needed fewer prompts or pauses.', 'I could understand my answer on replay.'] },
      { id: 'wrap', kind: 'wrap' },
    ];
    if (mission.id === 'colleague-smalltalk') tasks.find(task => task.id === 'retry').prompt = 'Erzähl bitte noch einmal in deinen eigenen Worten.';
    if (mission.id === 'clear-instructions') tasks.find(task => task.id === 'retry').prompt = 'Was machst du jetzt zuerst, und bis wann?';
    const follow = tasks.find(task => task.id === 'availability-followup');
    if (follow) follow.branch = {
      from: 'availability', options: {
        'asked-hours': { prompt: 'Wir suchen jemanden für zwölf bis sechzehn Stunden pro Woche. Wäre das für Sie möglich?', rephrase: 'Können Sie zwölf bis sechzehn Stunden pro Woche arbeiten?', goal: 'Respond to the employer’s proposed hours. Your real availability is what matters.' },
        clarify: { prompt: 'An welchen Tagen haben Sie Zeit? Sie können auch nur zwei Tage nennen.', goal: 'Answer the simpler question, naming days that actually work for you.' },
        unsure: { prompt: 'Wann können Sie uns sagen, an welchen Tagen Sie Zeit haben?', goal: 'Say when you can confirm your timetable.' },
      },
    };
  }
  const needed = new Set([...session.phraseIds, ...tasks.flatMap(task => task.phraseIds ?? [])]);
  return structuredClone({
    version: 'sprich-2.0',
    mission: { id: mission.id, shortTitle: mission.shortTitle, title: mission.title, icon: mission.icon, register: mission.register, goal: mission.goal, situation: mission.situation, resources: mission.resources },
    phrases: PHRASES.filter(phrase => needed.has(phrase.id)), tasks,
  });
}
