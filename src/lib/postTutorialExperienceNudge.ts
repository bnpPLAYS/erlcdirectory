import { supabase } from '@/integrations/supabase/client';

function pendingKey(profileId: string): string {
  return `erlc-dir-experience-nudge-pending:${profileId}`;
}

function dismissedKey(profileId: string): string {
  return `erlc-dir-experience-nudge-dismissed:${profileId}`;
}

export function isExperienceNudgeDismissed(profileId: string): boolean {
  try {
    return localStorage.getItem(dismissedKey(profileId)) === '1';
  } catch {
    return false;
  }
}

export function isExperienceNudgePending(profileId: string): boolean {
  try {
    return localStorage.getItem(pendingKey(profileId)) === '1';
  } catch {
    return false;
  }
}

export function setExperienceNudgePending(profileId: string): void {
  try {
    localStorage.setItem(pendingKey(profileId), '1');
  } catch {
    /* ignore */
  }
}

export function clearExperienceNudgePending(profileId: string): void {
  try {
    localStorage.removeItem(pendingKey(profileId));
  } catch {
    /* ignore */
  }
}

/** User closed the reminder — do not show again for this profile in this browser. */
export function dismissExperienceNudgePermanently(profileId: string): void {
  try {
    localStorage.setItem(dismissedKey(profileId), '1');
    localStorage.removeItem(pendingKey(profileId));
  } catch {
    /* ignore */
  }
}

export const EXPERIENCE_NUDGE_UPDATE_EVENT = 'erlc-experience-nudge-update';

export function emitExperienceNudgeUpdate(): void {
  try {
    window.dispatchEvent(new CustomEvent(EXPERIENCE_NUDGE_UPDATE_EVENT));
  } catch {
    /* ignore */
  }
}

/**
 * After the profile editor tutorial ends: if they still have zero experiences,
 * set a persistent “add first experience” nudge (until dismissed or they add one).
 */
export async function maybePromptFirstExperienceAfterTutorial(profileId: string): Promise<void> {
  if (typeof window === 'undefined') return;
  if (isExperienceNudgeDismissed(profileId)) return;
  try {
    const { count, error } = await supabase
      .from('experiences')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', profileId);
    if (error) return;
    if ((count ?? 0) > 0) return;
    setExperienceNudgePending(profileId);
    emitExperienceNudgeUpdate();
  } catch {
    /* ignore */
  }
}
