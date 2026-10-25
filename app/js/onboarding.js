export const ONBOARDING_KEY = 'sprich.getting-started';

function hasMeaningfulProgress(state) {
  return Boolean(
    state.profile && Object.values(state.profile).some(value => String(value ?? '').trim())
    || state.sessions?.length
    || state.attempts?.length
    || state.activity?.length
    || state.starter?.sessions?.length
    || state.starter?.wordSessions?.length
    || state.companionNotes?.length
    || state.aiSessions?.length,
  );
}

export function shouldOfferOnboarding(state, storage = globalThis.localStorage) {
  try {
    if (storage.getItem(ONBOARDING_KEY) === 'done') return false;
    if (hasMeaningfulProgress(state)) {
      storage.setItem(ONBOARDING_KEY, 'done');
      return false;
    }
  } catch { /* A blocked localStorage should not block practice. */ }
  return true;
}

export function finishOnboarding(storage = globalThis.localStorage) {
  try { storage.setItem(ONBOARDING_KEY, 'done'); } catch { /* The guide remains reopenable from Settings. */ }
}
