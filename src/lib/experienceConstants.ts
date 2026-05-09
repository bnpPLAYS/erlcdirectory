/** Placeholder for `experiences.role` until a server admin verifies and sets the real title. */
export const PENDING_EXPERIENCE_ROLE = 'Pending verification';

/** True when `role` is still the pre-verify placeholder (exact match after trim). */
export function isPendingPlaceholderRole(role: string | null | undefined): boolean {
  if (role == null) return false;
  return role.trim() === PENDING_EXPERIENCE_ROLE;
}
