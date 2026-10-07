import { CURRICULUM } from '../data/curriculum.js';
import { allPhrases } from '../data/phrases.js';
import { missionById } from '../data/missions.js';
import { resourceById } from '../data/resources.js';
import { dateKey } from './model.js';
import { recommendation, dailyPlan } from './adaptive.js';
import { duePhrases } from './srs.js';
import { chooseResource, resourceState } from './resources.js';

export function curriculumStage(state) {
  const completed = new Set(state.sessions.filter(session => session.kind === 'mission' && session.completedAt).map(session => session.missionId));
  return CURRICULUM.find(stage => stage.missionIds.some(id => !completed.has(id))) ?? CURRICULUM.at(-1);
}

export function createDailyPlan(state, now = Date.now()) {
  const next = recommendation(state, now);
  const mission = next.mission;
  const due = duePhrases(allPhrases(state), state.attempts, now);
  const listenMinutes = dailyPlan(state.preferences.dailyMinutes).find(block => block.label === 'Listen & understand').minutes;
  const recentSpeaking = state.attempts.filter(attempt => attempt.kind === 'speaking').slice(-6);
  const needsSupport = recentSpeaking.length >= 3 && recentSpeaking.filter(attempt => attempt.outcome !== 'independent').length > recentSpeaking.length / 2;
  const stage = needsSupport ? Math.min(2, curriculumStage(state).number) : curriculumStage(state).number;
  const resource = chooseResource(state, mission.id, { minutes: listenMinutes, stage, now });
  return {
    id: dateKey(now, state.preferences.timeZone), createdAt: now, updatedAt: now,
    minutes: state.preferences.dailyMinutes, missionId: mission.id, resourceId: resource?.id ?? '',
    reviewPhraseIds: due.slice(0, 10).map(phrase => phrase.id),
    reflection: '', reflectionAt: null,
  };
}

export function refreshDailyPlan(state, existing, now = Date.now()) {
  if (!existing) return createDailyPlan(state, now);
  const plan = structuredClone(existing);
  if (!missionById(plan.missionId)) { plan.missionId = recommendation(state, now).mission.id; plan.resourceId = ''; }
  plan.minutes = state.preferences.dailyMinutes;
  const budget = dailyPlan(plan.minutes).find(block => block.label === 'Listen & understand').minutes;
  const source = resourceById(plan.resourceId);
  const status = source ? resourceState(state, source.id) : null;
  if (!source || source.accessCheck === 'manual' || status.unavailable || status.difficulty === 'hard' || source.practiceMinutes > budget) {
    plan.resourceId = chooseResource(state, plan.missionId, { minutes: budget, stage: curriculumStage(state).number, now })?.id ?? '';
  }
  if (JSON.stringify(plan) !== JSON.stringify(existing)) plan.updatedAt = now;
  return plan;
}

export function dailyQueue(state, plan) {
  const mission = missionById(plan.missionId);
  const source = resourceById(plan.resourceId);
  const todayAttempts = state.attempts.filter(attempt => attempt.day === plan.id);
  const sessions = state.sessions.filter(session => session.kind === 'mission' && session.missionId === mission.id);
  const active = sessions.filter(session => !session.completedAt).sort((a, b) => b.updatedAt - a.updatedAt)[0];
  const missionDone = sessions.some(session => session.completedAt && dateKey(session.completedAt, state.preferences.timeZone) === plan.id);
  const allocation = dailyPlan(plan.minutes);
  const forMission = todayAttempts.filter(attempt => attempt.missionId === mission.id);
  const reviewDone = plan.reviewPhraseIds.length ? plan.reviewPhraseIds.every(id => todayAttempts.some(attempt => attempt.kind === 'recall' && attempt.phraseIds.includes(id))) : forMission.some(attempt => attempt.kind === 'recall');
  return allocation.map(block => {
    if (block.label === 'Recall aloud') return { ...block, id: 'review', done: reviewDone, title: plan.reviewPhraseIds.length ? `Recall ${plan.reviewPhraseIds.length} due phrases` : 'Warm up with the mission phrases', detail: 'Attempt from memory, then compare with a model.', action: plan.reviewPhraseIds.length ? 'review' : 'mission', target: mission.id, phraseIds: plan.reviewPhraseIds };
    if (block.label === 'Listen & understand') return { ...block, id: 'resource', done: source ? todayAttempts.some(attempt => attempt.kind === 'resource' && attempt.resourceId === source.id) : forMission.some(attempt => attempt.kind === 'listening'), title: source?.title ?? `${mission.shortTitle} · listening`, detail: source ? 'Use the source, then save your own German response here.' : 'Use the original in-app example and comprehension questions.', action: source ? 'resource' : 'mission', target: source?.id ?? mission.id };
    if (block.label === 'Shadow a short line') return { ...block, id: 'shadow', done: forMission.some(attempt => attempt.kind === 'shadow'), optional: Boolean(active?.short), title: 'Listen, repeat, and compare', detail: active?.short ? 'Optional: listen to a phrase and repeat it aloud.' : 'The mission includes a short line to record and replay.', action: active?.short ? 'phrases' : 'mission', target: mission.id };
    if (block.label === 'Practise conversations') return { ...block, id: 'mission', done: missionDone, title: mission.shortTitle, detail: mission.goal, action: 'mission', target: mission.id };
    if (block.label === 'Repeat with less help') return { ...block, id: 'retry', done: forMission.some(attempt => attempt.taskId === 'retry'), title: 'Try the same situation with fewer hints', detail: 'Finish the mission’s final speaking attempt. Replay your own answer.', action: 'mission', target: mission.id };
    return { ...block, id: 'reflection', done: Boolean(plan.reflectionAt), title: 'Save one useful takeaway', detail: 'Write what you can say now and where you will use it.', action: 'reflection', target: plan.id };
  });
}
