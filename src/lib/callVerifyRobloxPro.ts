import { supabase } from '@/integrations/supabase/client';

export async function invokeVerifyRobloxPro(opts: {
  roblox_username?: string;
  roblox_user_id?: string;
}): Promise<{ ok: true; roblox_user_id: number; pro_verified_at: string } | { ok: false; error: string }> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return { ok: false, error: 'Sign in required.' };
  }
  const r = await fetch('/api/verify-roblox-pro', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(opts),
  });
  let j: { ok?: boolean; error?: string; roblox_user_id?: number; pro_verified_at?: string };
  try {
    j = (await r.json()) as typeof j;
  } catch {
    return { ok: false, error: 'Invalid server response.' };
  }
  if (!r.ok || !j.ok) {
    return { ok: false, error: j.error || `Verification failed (${r.status}).` };
  }
  if (j.roblox_user_id == null || !j.pro_verified_at) {
    return { ok: false, error: 'Incomplete verification response.' };
  }
  return { ok: true, roblox_user_id: j.roblox_user_id, pro_verified_at: j.pro_verified_at };
}
