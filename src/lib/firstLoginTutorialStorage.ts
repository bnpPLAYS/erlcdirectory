/** localStorage key per profile — tutorial is one-time per account per browser. */
const KEY_PREFIX = 'erlc-dir-tutorial-v1:';

/** New accounts (by `created_at`) are offered the tour once. */
const MAX_PROFILE_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function tutorialStorageKey(profileId: string): string {
  return `${KEY_PREFIX}${profileId}`;
}

export function hasCompletedTutorial(profileId: string): boolean {
  try {
    return localStorage.getItem(tutorialStorageKey(profileId)) === '1';
  } catch {
    return false;
  }
}

export function markTutorialCompleted(profileId: string): void {
  try {
    localStorage.setItem(tutorialStorageKey(profileId), '1');
  } catch {
    /* ignore */
  }
}

export function shouldOfferTutorial(profile: {
  id: string;
  created_at: string;
  terms_accepted_at?: string | null;
}): boolean {
  if (hasCompletedTutorial(profile.id)) return false;
  /** Terms gate still blocking — tutorial runs after acceptance. */
  if (profile.terms_accepted_at === null) return false;
  try {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  } catch {
    /* ignore */
  }
  const created = new Date(profile.created_at).getTime();
  if (Number.isNaN(created)) return false;
  const age = Date.now() - created;
  return age >= 0 && age <= MAX_PROFILE_AGE_MS;
}

export const TUTORIAL_RESUME_EDITOR = 'erlc-dir-tutorial-resume-editor';
