import type { SupabaseClient } from '@supabase/supabase-js';

export type StaffGate = {
  canModerate: boolean;
  isSiteOwner: boolean;
};

type GateFallback = {
  userId: string;
  /** Ignored — kept for call-site compatibility; staff is server-RPC only. */
  discordUsername?: string | null;
};

/**
 * Staff panel gate: SECURITY DEFINER RPCs only. Never infer staff from client-readable
 * profile fields or `user_roles` SELECT (prevents DevTools / spoofed username bypass).
 */
export async function fetchStaffGate(client: SupabaseClient, _fallback: GateFallback): Promise<StaffGate> {
  const [ownerRes, staffRes] = await Promise.all([
    client.rpc('is_site_owner'),
    client.rpc('is_staff'),
  ]);

  if (ownerRes.error || staffRes.error) {
    return { canModerate: false, isSiteOwner: false };
  }

  const isSiteOwner = ownerRes.data === true;
  const canModerate = staffRes.data === true;

  return {
    isSiteOwner,
    canModerate,
  };
}
