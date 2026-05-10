import { supabase } from '@/integrations/supabase/client';

/**
 * Grants or revokes staff (`admin` in `user_roles`) via same-origin `/api/site-owner-staff-role`.
 * Used when PostgREST returns 404 for `site_owner_*` RPCs — direct table writes hit RLS.
 */
export async function callSiteOwnerStaffRole(
  action: 'grant' | 'revoke',
  targetUserId: string,
): Promise<{ error: string | null }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return { error: 'You must be signed in.' };

  let res: Response;
  try {
    res = await fetch('/api/site-owner-staff-role', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action, target_user_id: targetUserId }),
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Network error' };
  }

  let payload: { ok?: boolean; error?: string };
  try {
    payload = await res.json();
  } catch {
    return { error: `Staff request failed (${res.status}).` };
  }

  if (!res.ok || payload.ok === false) {
    return { error: typeof payload.error === 'string' ? payload.error : `Request failed (${res.status}).` };
  }
  return { error: null };
}
