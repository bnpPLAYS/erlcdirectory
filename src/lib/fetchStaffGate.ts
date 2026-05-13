import type { SupabaseClient } from '@supabase/supabase-js';
import { isSiteOwnerDiscordUsername } from '@/lib/siteOwner';

export type StaffGate = {
  canModerate: boolean;
  isSiteOwner: boolean;
};

type GateFallback = {
  userId: string;
  /** From `useAuth().profile` or a profiles row — only used if RPCs fail. */
  discordUsername: string | null | undefined;
};

/**
 * Staff panel gate: use SECURITY DEFINER `is_staff` / `is_site_owner` RPCs first so admins are
 * recognized even when RLS blocks direct `SELECT` on `user_roles` (common after owner-only FOR ALL policies).
 */
export async function fetchStaffGate(client: SupabaseClient, fallback: GateFallback): Promise<StaffGate> {
  const [ownerRes, staffRes] = await Promise.all([
    client.rpc('is_site_owner'),
    client.rpc('is_staff'),
  ]);

  if (
    !ownerRes.error &&
    !staffRes.error &&
    typeof ownerRes.data === 'boolean' &&
    typeof staffRes.data === 'boolean'
  ) {
    return {
      isSiteOwner: ownerRes.data,
      canModerate: staffRes.data,
    };
  }

  const owner = isSiteOwnerDiscordUsername(fallback.discordUsername ?? null);
  if (owner) return { canModerate: true, isSiteOwner: true };

  const { data: roleRow } = await client
    .from('user_roles')
    .select('id')
    .eq('user_id', fallback.userId)
    .eq('role', 'admin')
    .maybeSingle();

  return { canModerate: !!roleRow, isSiteOwner: false };
}
