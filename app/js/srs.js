import { DAY } from './model.js';

const INTERVALS = [1, 3, 7, 14, 30, 60];
const MIN_SPACING = 20 * 3_600_000;

function emptyMemory() {
  return { dueAt: null, successes: [], lastSuccess: null, lastDay: null, lastOutcome: null, lapses: 0 };
}

function apply(memory, attempt) {
  const next = { ...memory, successes: [...memory.successes], lastOutcome: attempt.outcome };
  if (attempt.outcome === 'again' || attempt.outcome === 'incorrect') {
    next.dueAt = attempt.completedAt + 4 * 3_600_000;
    next.successes = [];
    next.lastSuccess = null;
    next.lastDay = null;
    next.lapses++;
  } else if (attempt.outcome === 'helped' || attempt.hintUsed) {
    next.dueAt = next.dueAt !== null && next.dueAt > attempt.completedAt
      ? Math.min(next.dueAt, attempt.completedAt + DAY) : attempt.completedAt + DAY;
    next.successes = [];
    next.lastSuccess = null;
    next.lastDay = null;
  } else if (attempt.outcome === 'independent') {
    const spaced = next.lastSuccess === null ||
      (attempt.day !== next.lastDay && attempt.completedAt - next.lastSuccess >= MIN_SPACING);
    const due = next.dueAt === null || attempt.completedAt >= next.dueAt;
    if (spaced && due) {
      next.successes.push(attempt.day);
      next.lastSuccess = attempt.completedAt;
      next.lastDay = attempt.day;
      const interval = INTERVALS[Math.min(next.successes.length - 1, INTERVALS.length - 1)];
      next.dueAt = attempt.completedAt + interval * DAY;
    }
    // Extra same-day/early successes are practice; they do not postpone a due review.
  }
  return next;
}

/** Rebuild memory from immutable evidence so importing a file cannot duplicate grades. */
export function reviewStates(attempts) {
  const states = new Map();
  const unique = [...new Map(attempts.map(attempt => [attempt.id, attempt])).values()]
    .sort((a, b) => a.completedAt - b.completedAt || a.id.localeCompare(b.id));
  for (const attempt of unique) {
    const recall = attempt.kind === 'recall';
    const production = attempt.kind === 'speaking' && attempt.inputMode !== 'typed';
    if (!recall && !production) continue;
    for (const id of attempt.phraseIds) {
      const state = states.get(id) ?? { id, recall: emptyMemory(), production: emptyMemory() };
      const type = recall ? 'recall' : 'production';
      state[type] = apply(state[type], attempt);
      states.set(id, state);
    }
  }
  return states;
}

export function retained(state) {
  return Boolean(state && state.production.successes.length >= 2 && state.production.lastOutcome === 'independent');
}

export function nextDue(state) {
  if (!state) return null;
  // The review deck schedules recall. Production is practised inside conversations;
  // it must not leave a card permanently overdue after a completed recall review.
  return state.recall.dueAt ?? state.production.dueAt;
}

export function duePhrases(phrases, attempts, now = Date.now()) {
  const states = reviewStates(attempts);
  return phrases.filter(phrase => nextDue(states.get(phrase.id)) !== null && nextDue(states.get(phrase.id)) <= now)
    .sort((a, b) => nextDue(states.get(a.id)) - nextDue(states.get(b.id)));
}

export function choosePhrases(phraseIds, attempts, max = 6, now = Date.now()) {
  const states = reviewStates(attempts);
  const due = phraseIds.filter(id => nextDue(states.get(id)) !== null && nextDue(states.get(id)) <= now)
    .sort((a, b) => nextDue(states.get(a)) - nextDue(states.get(b)));
  const fresh = phraseIds.filter(id => !states.has(id));
  const extra = phraseIds.filter(id => !due.includes(id) && !fresh.includes(id))
    .sort((a, b) => (nextDue(states.get(a)) ?? Infinity) - (nextDue(states.get(b)) ?? Infinity));
  return [...due, ...fresh, ...extra].slice(0, max);
}
