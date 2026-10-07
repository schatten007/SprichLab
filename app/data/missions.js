import { coreMissions } from './mission-packs/core.js';
import { vacancyCall, appointmentChange } from './mission-packs/interview-logistics.js';
import { workUpdate, problemHelp, customerRequest } from './mission-packs/workplace.js';
import { availabilityPlanning, meeting, mockInterview } from './mission-packs/planning-and-interviews.js';

export { PHRASES, phraseById, allPhrases } from './phrases.js';
export { RESOURCES, resourceById } from './resources.js';
export const CONTENT_VERSION = '2026.10-course-1';
const [interview, instructions, project, smalltalk] = coreMissions();

interview.turns.find(turn => turn.id === 'availability').intents.forEach((intent, index) => {
  intent.labelDe = ['Ich habe meine verfügbaren Zeiten genannt.', 'Ich habe nach den benötigten Stunden gefragt.', 'Ich habe um eine einfachere Frage gebeten.', 'Ich muss meinen Stundenplan noch prüfen.'][index];
});
interview.turns.find(turn => turn.id === 'availability-followup').branch = {
  from: 'availability', options: {
    'asked-hours': {
      prompt: 'Wir suchen jemanden für zwölf bis sechzehn Stunden pro Woche. Wäre das für Sie möglich?', promptEn: 'We need someone for twelve to sixteen hours a week. Would that be possible for you?',
      rephrase: 'Können Sie zwölf bis sechzehn Stunden pro Woche arbeiten?', rephraseEn: 'Can you work twelve to sixteen hours a week?',
      goal: 'Respond to the proposed hours using your real availability.', goalDe: 'Antworte auf den Vorschlag mit deiner echten Verfügbarkeit.',
      model: 'Sechzehn Stunden wären für mich möglich. Ich könnte montags und donnerstags arbeiten.', modelEn: 'Sixteen hours would be possible for me. I could work on Mondays and Thursdays.',
    },
    clarify: {
      prompt: 'An welchen Tagen haben Sie Zeit? Sie können auch nur zwei Tage nennen.', promptEn: 'On which days are you available? You can simply name two days.',
      rephrase: 'Haben Sie zum Beispiel montags oder freitags Zeit?', rephraseEn: 'Are you available on Mondays or Fridays, for example?',
      goal: 'Name days that actually work for you.', goalDe: 'Nenne Tage, an denen du wirklich arbeiten könntest.',
      model: 'Am Montag und am Donnerstag habe ich Zeit. An den anderen Tagen habe ich Vorlesungen.', modelEn: 'I am available on Monday and Thursday. I have lectures on the other days.',
    },
    unsure: {
      prompt: 'Wann können Sie uns sagen, an welchen Tagen Sie Zeit haben?', promptEn: 'When can you tell us which days you are available?',
      rephrase: 'Wann bekommen Sie Ihren Stundenplan?', rephraseEn: 'When will you receive your timetable?',
      goal: 'Say when you can confirm your timetable.', goalDe: 'Sag, wann du deinen Stundenplan bestätigen kannst.',
      model: 'Ich bekomme meinen Stundenplan morgen. Ich könnte Ihnen am Freitag Bescheid geben.', modelEn: 'I will receive my timetable tomorrow. I could let you know on Friday.',
    },
  },
};

export const MISSIONS = [interview, vacancyCall, appointmentChange, availabilityPlanning, instructions, workUpdate,
  problemHelp, smalltalk, project, meeting, customerRequest, mockInterview]
  .map((mission, index) => ({ ...mission, number: String(index + 1).padStart(2, '0') }));
export const missionById = id => MISSIONS.find(mission => mission.id === id);
