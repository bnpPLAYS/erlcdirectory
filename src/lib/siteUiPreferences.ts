/** Persisted UI preferences (localStorage). */

export const STAFF_BANNER_COMPACT_KEY = 'erlc-directory-staff-banner-compact';

export const SITE_CHANGELOG_VERSION = '2026-02-11-pro';

export const CHANGELOG_DISMISSED_KEY = 'erlc-directory-changelog-dismissed';

export function readStaffBannerCompact(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(STAFF_BANNER_COMPACT_KEY) === '1';
}

export function writeStaffBannerCompact(compact: boolean): void {
  if (typeof window === 'undefined') return;
  if (compact) window.localStorage.setItem(STAFF_BANNER_COMPACT_KEY, '1');
  else window.localStorage.removeItem(STAFF_BANNER_COMPACT_KEY);
}

export function readChangelogDismissedVersion(): string {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(CHANGELOG_DISMISSED_KEY) ?? '';
}

export function writeChangelogDismissed(version: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(CHANGELOG_DISMISSED_KEY, version);
}
