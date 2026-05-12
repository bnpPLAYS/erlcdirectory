/** sessionStorage key for signed canary pass (from Edge Function). */
export const CANARY_PASS_STORAGE_KEY = 'erlc_canary_pass_v1';

/**
 * True when this build should enforce the canary gate (test code + staff session).
 * - Production: https://canary.erlc.directory
 * - Optional: VITE_FORCE_CANARY_GATE=true to test the gate on any host (e.g. local).
 */
export function isCanarySiteHost(): boolean {
  if (import.meta.env.VITE_FORCE_CANARY_GATE === 'true') return true;
  if (typeof window === 'undefined') return false;
  return window.location.hostname.toLowerCase() === 'canary.erlc.directory';
}
