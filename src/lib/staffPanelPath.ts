/**
 * Staff / admin panel URL segment. Not linked publicly; configure per deploy via VITE_STAFF_PANEL_PATH.
 * Default is a non-obvious path — avoid `/staff` in production (legacy route shows 404).
 */
const raw = (import.meta.env.VITE_STAFF_PANEL_PATH as string | undefined)?.trim();
const normalized = raw && raw.startsWith('/') ? raw : raw ? `/${raw}` : '/s/x7k9m2p';

export const STAFF_PANEL_PATH = normalized.split('?')[0]!;

export function staffPanelUrl(search = ''): string {
  const q = search.startsWith('?') ? search : search ? `?${search}` : '';
  return `${STAFF_PANEL_PATH}${q}`;
}

export function isStaffPanelPath(pathname: string): boolean {
  return pathname === STAFF_PANEL_PATH || pathname.startsWith(`${STAFF_PANEL_PATH}/`);
}
