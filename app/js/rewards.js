import { progressStats, previousDay } from './model.js';
import { practisedLessons, wordProgressSummary } from './starter-progress.js';

/** A day counts towards the streak at fifteen minutes of measured practice. */
export const STREAK_FLOOR_MS = 15 * 60_000;
/** Six qualifying days in a row earn one rest day. */
export const REST_EARN_EVERY = 6;
/** At most two rest days can be banked, so a long absence still ends a streak. */
export const REST_BANK_MAX = 2;
/** Streaks are computed over a bounded window to keep this a cheap render-time call. */
export const WINDOW_DAYS = 400;

/**
 * Consecutive qualifying days, forgiving a single gap when a rest day has been earned.
 * Walks forward so a rest day is only ever spent after it was earned. Two missed days
 * in a row always end the streak, so alternating practice cannot look like a long run.
 */
export function streakInfo(days, today) {
  const qualifies = day => (days.get(day) ?? 0) >= STREAK_FLOOR_MS;
  let streak = 0;
  let run = 0;
  let bank = 0;
  let missRun = 0;
  for (let offset = WINDOW_DAYS - 1; offset >= 0; offset--) {
    const day = offset === 0 ? today : previousDay(today, offset);
    if (qualifies(day)) {
      streak += 1;
      run += 1;
      missRun = 0;
      if (run % REST_EARN_EVERY === 0 && bank < REST_BANK_MAX) bank += 1;
      continue;
    }
    // An unfinished today never breaks a streak that is already standing.
    if (day === today) break;
    missRun += 1;
    if (missRun >= 2 || bank === 0) { streak = 0; run = 0; bank = 0; missRun = 0; }
    else bank -= 1;
  }
  return { streak, restLeft: bank, qualifyingToday: qualifies(today) };
}

/** Today's measured practice against the learner's own chosen goal. */
export function goalRing(stats, goalMinutes) {
  const goalMs = Math.max(1, goalMinutes) * 60_000;
  const ms = stats.todayMs;
  return { ms, goalMs, pct: Math.min(100, Math.round(ms / goalMs * 100)), met: ms >= goalMs };
}

/** The last seven days, oldest first, for a countable week strip. */
export function weekStrip(stats) {
  return Array.from({ length: 7 }, (_, index) => {
    const day = index === 6 ? stats.today : previousDay(stats.today, 6 - index);
    const ms = stats.days.get(day) ?? 0;
    return { day, ms, qualifies: ms >= STREAK_FLOOR_MS };
  });
}

const STEPS = {
  lessons: [1, 5, 10, 25, 48],
  recalled: [10, 25, 50, 100],
  recognised: [25, 100, 250],
  spoken: [10, 50, 150],
  recordedMinutes: [10, 30, 60],
  practiceHours: [5, 20, 50],
};

/**
 * Effort milestones only. Every source is de-duplicated, so repeating a lesson or a
 * word cannot inflate a count, and no milestone reads an assessment score.
 */
export function milestones(state, stats) {
  const starter = state.starter ?? { sessions: [], reviews: [], wordSessions: [], wordMarks: [], plans: [] };
  const words = wordProgressSummary(starter);
  const spokenKeys = new Set((stats.speaking ?? []).map(attempt => `mission:${attempt.missionId}:${attempt.taskId}`));
  for (const session of starter.sessions) {
    for (const response of session.responses) {
      if (response.spoken) spokenKeys.add(`starter:${session.lessonId}:${response.taskId}`);
    }
  }
  const practiceMs = [...stats.days.values()].reduce((total, ms) => total + ms, 0);
  const raw = [
    ['lessons', 'Lessons practised', practisedLessons(starter).size, 'self-rated', 'lessons'],
    ['recalled', 'German said from memory', words.recalled, 'self-rated', 'words'],
    ['recognised', 'Meanings recalled', words.recognition, 'self-rated', 'words'],
    ['spoken', 'Spoken answers', spokenKeys.size, 'self-rated', 'answers'],
    ['recordedMinutes', 'Speaking recorded', Math.floor(stats.recordingMs / 60_000), 'measured', 'min'],
    ['practiceHours', 'Practice time', Math.floor(practiceMs / 3_600_000), 'measured', 'h'],
  ];
  return raw.map(([id, label, value, prov, unit]) => {
    const steps = STEPS[id];
    const reached = steps.filter(step => value >= step);
    const target = steps.find(step => value < step) ?? steps.at(-1);
    return { id, label, value, prov, target, unit, met: reached.length > 0,
      earned: reached.at(-1) ?? 0, display: `${value} ${unit}`, goal: `${target} ${unit}` };
  });
}

/**
 * Everything the calm progress surfaces need, derived from evidence that is already
 * stored, validated, and merged. Pure: it never writes and never mutates state.
 */
export function rewards(state, now = Date.now()) {
  const stats = progressStats(state, now);
  const ring = goalRing(stats, state.preferences.dailyMinutes);
  const streak = streakInfo(stats.days, stats.today);
  const all = milestones(state, stats);
  const pending = all.filter(item => item.value < item.target);
  return {
    stats,
    ring,
    streak,
    week: weekStrip(stats),
    milestones: all,
    earned: all.filter(item => item.met),
    next: pending.sort((a, b) => (a.target - a.value) / a.target - (b.target - b.value) / b.target)[0] ?? null,
  };
}
