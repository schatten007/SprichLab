import { splitActivity } from './model.js';

/** Counts visible, recently active practice only. Recording time is measured separately. */
export function createPracticeClock({ onSegments, onTick, timeZone, sessionId }) {
  let timer = null;
  let start = null;
  let lastInteraction = Date.now();
  let manuallyPaused = false;
  let pending = Promise.resolve();
  let stopped = false;
  let runId = crypto.randomUUID();

  function checkpoint() {
    const now = Date.now();
    if (start !== null) {
      // Long suspended/background intervals must never be credited after waking up.
      const end = Math.min(now, start + 10_000, lastInteraction + 60_000);
      if (end > start) {
        const segments = [];
        let cursor = start;
        while (cursor < end) {
          const minute = Math.floor(cursor / 60_000);
          const boundary = Math.min(end, (minute + 1) * 60_000);
          segments.push(...splitActivity(cursor, boundary, timeZone, `${runId}:${minute}`, sessionId));
          cursor = boundary;
        }
        pending = pending.then(() => onSegments(segments));
      }
    }
    const running = !stopped && !manuallyPaused && !document.hidden && now - lastInteraction < 60_000;
    if (running && start === null) runId = crypto.randomUUID();
    start = running ? now : null;
    onTick?.({ paused: start === null, manual: manuallyPaused });
  }

  function interact() {
    if (Date.now() - lastInteraction >= 60_000) checkpoint();
    lastInteraction = Date.now();
    if (start === null && !manuallyPaused && !document.hidden) { runId = crypto.randomUUID(); start = lastInteraction; }
  }
  function visibility() { checkpoint(); }

  return {
    start() {
      start = document.hidden ? null : Date.now();
      timer = setInterval(checkpoint, 5000);
      document.addEventListener('visibilitychange', visibility);
      document.addEventListener('pointerdown', interact);
      document.addEventListener('keydown', interact);
    },
    interact,
    setPaused(paused) { checkpoint(); manuallyPaused = paused; start = null; if (!paused) interact(); checkpoint(); },
    async flush() { checkpoint(); await pending; },
    async stop() {
      stopped = true;
      checkpoint();
      clearInterval(timer);
      document.removeEventListener('visibilitychange', visibility);
      document.removeEventListener('pointerdown', interact);
      document.removeEventListener('keydown', interact);
      await pending;
    },
  };
}
