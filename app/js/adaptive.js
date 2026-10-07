import { MISSIONS, allPhrases } from '../data/missions.js';
import { duePhrases } from './srs.js';

const ALLOCATIONS = {
  15: [3, 3, 0, 6, 2, 1],
  30: [5, 5, 3, 10, 5, 2],
  60: [8, 10, 7, 20, 10, 5],
  90: [10, 15, 10, 30, 15, 10],
  120: [10, 20, 10, 45, 20, 15],
};

export function dailyPlan(minutes = 90) {
  const allocation = ALLOCATIONS[minutes] ?? ALLOCATIONS[90];
  const labels = ['Recall aloud', 'Listen & understand', 'Shadow a short line', 'Practise conversations', 'Repeat with less help', 'Reflect & reuse'];
  return labels.map((label, index) => ({ label, minutes: allocation[index] })).filter(block => block.minutes > 0);
}

export function recommendation(state, now = Date.now()) {
  const active = state.sessions.filter(session => !session.completedAt && (session.kind !== 'resource' || !state.resourceStates?.some(item => item.id === session.resourceId && (item.unavailable || item.difficulty === 'hard'))))
    .sort((a, b) => b.updatedAt - a.updatedAt)[0];
  if (active) return { mission: MISSIONS.find(mission => mission.id === active.missionId) ?? MISSIONS[0], active, reason: 'Pick up exactly where you left off.' };
  const completedIds = new Set(state.sessions.filter(session => session.kind === 'mission' && session.completedAt).map(session => session.missionId));
  const newMission = MISSIONS.find(mission => !completedIds.has(mission.id));
  if (newMission) return { mission: newMission, reason: completedIds.size ? 'Try another useful situation with familiar phrases.' : 'Start with the conversation that opens doors.' };
  const recent = state.attempts.filter(attempt => attempt.kind === 'speaking' && now - attempt.completedAt < 14 * 86_400_000);
  const ranked = MISSIONS.map(mission => {
    const attempts = recent.filter(attempt => attempt.missionId === mission.id);
    const needsHelp = attempts.length ? attempts.filter(attempt => attempt.outcome !== 'independent').length / attempts.length : 1;
    const last = state.sessions.filter(session => session.missionId === mission.id).reduce((latest, session) => Math.max(latest, session.createdAt), 0);
    return { mission, needsHelp, last };
  }).sort((a, b) => b.needsHelp - a.needsHelp || a.last - b.last);
  return { mission: ranked[0].mission, reason: 'Revisit a situation where you recently needed more support.' };
}

export function reviewCount(state, now = Date.now()) { return duePhrases(allPhrases(state), state.attempts, now).length; }
