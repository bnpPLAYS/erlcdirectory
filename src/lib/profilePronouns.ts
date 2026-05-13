/** Only these pronoun strings may be stored or shown on profiles. */
export const PROFILE_PRONOUN_OPTIONS = ['he/him', 'she/her'] as const;
export type ProfilePronounId = (typeof PROFILE_PRONOUN_OPTIONS)[number];

/** Normalize free text to an allowed value, or null (do not display / do not store). */
export function sanitizeProfilePronouns(raw: string | null | undefined): ProfilePronounId | null {
  const s = (raw ?? '').trim().toLowerCase();
  if (!s) return null;
  if (s === 'he/him') return 'he/him';
  if (s === 'she/her') return 'she/her';
  return null;
}
