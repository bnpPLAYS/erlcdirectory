/** Persisted UI preferences (localStorage). */

export const STAFF_BANNER_COMPACT_KEY = 'erlc-directory-staff-banner-compact';

export function readStaffBannerCompact(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(STAFF_BANNER_COMPACT_KEY) === '1';
}

export function writeStaffBannerCompact(compact: boolean): void {
  if (typeof window === 'undefined') return;
  if (compact) window.localStorage.setItem(STAFF_BANNER_COMPACT_KEY, '1');
  else window.localStorage.removeItem(STAFF_BANNER_COMPACT_KEY);
}
