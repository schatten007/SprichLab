import { RESOURCES, resourceById } from '../data/resources.js';
import { phraseIdentity } from '../data/phrases.js';
import { missionById, CONTENT_VERSION } from '../data/missions.js';
import { assert, dateKey, validateAttempt, validatePhrase, safeSourceURL } from './model.js';

export function resourceState(state, id) {
  return state.resourceStates.find(item => item.id === id) ?? { id, bookmarked: false, difficulty: 'unrated', unavailable: false, updatedAt: 0 };
}

export function filterResources(state, filters = {}) {
  const query = (filters.query ?? '').trim().toLocaleLowerCase('de');
  return RESOURCES.filter(resource => {
    const saved = resourceState(state, resource.id);
    return (!query || `${resource.title} ${resource.titleEn} ${resource.summaryDe} ${resource.summaryEn} ${resource.provider}`.toLocaleLowerCase('de').includes(query)) &&
      (!filters.level || filters.level === 'all' || resource.band === filters.level) &&
      (!filters.format || filters.format === 'all' || resource.formats.includes(filters.format)) &&
      (!filters.maxMinutes || resource.practiceMinutes <= Number(filters.maxMinutes)) &&
      (!filters.noRegistration || resource.registration !== 'required') &&
      (!filters.textSupport || resource.transcript !== 'none') &&
      (!filters.bookmarked || saved.bookmarked);
  });
}

export function alternativesFor(state, resource) {
  return RESOURCES.filter(item => item.id !== resource.id && item.accessCheck !== 'manual' && !resourceState(state, item.id).unavailable && resourceState(state, item.id).difficulty !== 'hard' &&
    (resource.band === 'B1' || item.band === 'A2') && item.missionIds.some(id => resource.missionIds.includes(id)))
    .sort((a, b) => a.stage - b.stage || a.practiceMinutes - b.practiceMinutes).slice(0, 3);
}

export function chooseResource(state, missionId, { minutes = 15, stage = 1, now = Date.now() } = {}) {
  const candidates = RESOURCES.filter(resource => resource.missionIds.includes(missionId) && resource.practiceMinutes <= minutes && resource.stage <= stage &&
    resource.registration !== 'required' && resource.accessCheck !== 'manual' && !resourceState(state, resource.id).unavailable && resourceState(state, resource.id).difficulty !== 'hard');
  const lastUsed = id => state.attempts.filter(attempt => attempt.kind === 'resource' && attempt.resourceId === id)
    .reduce((latest, attempt) => Math.max(latest, attempt.completedAt), 0);
  return candidates.sort((a, b) => {
    const aRecent = now - lastUsed(a.id) < 3 * 86_400_000;
    const bRecent = now - lastUsed(b.id) < 3 * 86_400_000;
    return Number(aRecent) - Number(bRecent) || lastUsed(a.id) - lastUsed(b.id) || a.stage - b.stage;
  })[0] ?? null;
}

export function createResourceSession(state, resourceId, { id = crypto.randomUUID(), now = Date.now(), missionId = null } = {}) {
  const resource = resourceById(resourceId);
  assert(resource, 'Choose a resource from the catalog.');
  const mission = missionById(missionId ?? resource.missionIds[0]) ?? missionById('first-interview');
  return {
    id, kind: 'resource', resourceId: resource.id, missionId: mission.id,
    createdAt: now, updatedAt: now, completedAt: null, cursor: 0, variant: 0,
    phraseIds: [], short: true, profile: structuredClone(state.profile), drafts: {},
    content: structuredClone({
      version: CONTENT_VERSION, phrases: [], resource,
      mission: { id: mission.id, shortTitle: mission.shortTitle, icon: mission.icon, goal: mission.goal, register: mission.register, resources: [resource.id] },
      tasks: [{ id: 'resource-response', kind: 'resource', prompt: resource.taskDe, promptEn: resource.taskEn }],
    }),
  };
}

export function resourceAttempt(session, draft, timeZone, now = Date.now()) {
  assert(draft.recordingMs > 0 || draft.text.trim(), 'Save a written response or a recording before completing this resource activity.');
  return validateAttempt({
    id: `${session.id}:resource-response`, sessionId: session.id, taskId: 'resource-response', missionId: session.missionId,
    kind: 'resource', resourceId: session.resourceId, source: 'practice', outcome: 'unscored',
    completedAt: now, day: dateKey(now, timeZone), answer: draft.text.trim(),
    inputMode: draft.recordingMs > 0 ? 'recording' : 'typed', recordingMs: draft.recordingMs || 0,
    hintUsed: false, phraseIds: [], criteria: [], focus: '', intent: '', externalMinutes: Number(draft.externalMinutes ?? 0),
  });
}

export async function createPersonalPhrase(values, now = Date.now()) {
  const de = String(values.de ?? '').trim();
  const en = String(values.en ?? '').trim();
  assert(de && en, 'Add the German phrase and its English meaning.');
  assert(de.length <= 500 && en.length <= 1000, 'Keep the phrase and meaning short.');
  const sourceUrl = String(values.sourceUrl ?? '').trim();
  assert(!sourceUrl || safeSourceURL(sourceUrl), 'Use a complete HTTPS source link.');
  const identity = new TextEncoder().encode(phraseIdentity(de, en));
  const digest = await crypto.subtle.digest('SHA-256', identity);
  const hash = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('').slice(0, 32);
  return validatePhrase({
    id: `personal-${hash}`, de, en,
    cueDe: 'Wie sagst du das auf Deutsch?', cue: 'Say this meaning in German, then use it in your own situation.',
    example: String(values.example ?? '').trim().slice(0, 1500), note: 'Your own saved phrase. Check its wording against the source or with a speaker.',
    noteDe: 'Deine eigene Wendung. Prüfe die Formulierung anhand der Quelle oder mit einer anderen Person.',
    tags: ['personal'], sourceUrl, sourceId: String(values.sourceId ?? '').slice(0, 200), sourceTitle: String(values.sourceTitle ?? '').slice(0, 500), createdAt: now,
  }, true);
}
