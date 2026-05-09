/** Placeholder for `experiences.role` until a server admin verifies and sets the real title. */
export const PENDING_EXPERIENCE_ROLE = 'Pending verification';

/** True when `role` is still the pre-verify placeholder (exact match after trim). */
export function isPendingPlaceholderRole(role: string | null | undefined): boolean {
  if (role == null) return false;
  return role.trim() === PENDING_EXPERIENCE_ROLE;
}

/** Headline for directory cards and profile experience rows (avoids “Pending” when verified). */
export function experienceRoleDisplay(
  role: string,
  isVerified: boolean,
): { mode: 'pending' | 'verifiedStale' | 'role'; text: string } {
  if (!isVerified && isPendingPlaceholderRole(role)) {
    return { mode: 'pending', text: 'Pending verification' };
  }
  if (isVerified && isPendingPlaceholderRole(role)) {
    return { mode: 'verifiedStale', text: 'Verified experience' };
  }
  return { mode: 'role', text: role };
}
