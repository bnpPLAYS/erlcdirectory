export const config = { runtime: 'edge' };

import { createClient } from '@supabase/supabase-js';

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Mirrors `public.is_site_owner()` / `src/lib/siteOwner.ts` — authorized Discord identity only. */
function isSiteOwnerDiscordUsername(username: string | null | undefined): boolean {
  if (username == null || typeof username !== 'string') return false;
  const normalized = username.trim().toLowerCase().replace(/\.+$/u, '');
  return normalized === 'pixelnovaa';
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });

  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return json(401, { ok: false, error: 'Unauthorized' });

  let body: { action?: string; target_user_id?: string };
  try {
    body = await request.json();
  } catch {
    return json(400, { ok: false, error: 'Invalid JSON body' });
  }

  const action = body.action;
  const targetUserId = body.target_user_id;
  if (action !== 'grant' && action !== 'revoke') {
    return json(400, { ok: false, error: 'Invalid action' });
  }
  if (!targetUserId || typeof targetUserId !== 'string' || !UUID_RE.test(targetUserId)) {
    return json(400, { ok: false, error: 'Invalid target_user_id' });
  }

  const ref = process.env.VITE_SUPABASE_PROJECT_ID?.trim();
  const supabaseUrl = (
    process.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    (ref ? `https://${ref}.supabase.co` : '')
  )
    .trim()
    .replace(/\/$/, '');
  const anonKey =
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !anonKey) {
    return json(500, {
      ok: false,
      error:
        'Server missing Supabase URL or anon key. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY on Vercel.',
    });
  }
  if (!serviceKey) {
    return json(500, {
      ok: false,
      error:
        'Missing SUPABASE_SERVICE_ROLE_KEY on the server. Add it in Vercel so staff changes can be applied when PostgREST RPCs are unavailable.',
    });
  }

  const token = authHeader.slice('Bearer '.length).trim();
  const anon = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: authErr } = await anon.auth.getUser(token);
  if (authErr || !userData?.user?.id) {
    return json(401, { ok: false, error: 'Invalid or expired session' });
  }
  const callerId = userData.user.id;

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: profile, error: profileErr } = await admin
    .from('profiles')
    .select('discord_username')
    .eq('user_id', callerId)
    .maybeSingle();

  if (profileErr) {
    return json(500, { ok: false, error: 'Could not verify caller profile' });
  }
  if (!isSiteOwnerDiscordUsername(profile?.discord_username)) {
    return json(403, { ok: false, error: 'Forbidden' });
  }

  if (action === 'revoke' && targetUserId === callerId) {
    return json(400, { ok: false, error: 'You cannot remove your own staff access.' });
  }

  if (action === 'grant') {
    const { error: insErr } = await admin.from('user_roles').insert({
      user_id: targetUserId,
      role: 'admin',
    });
    if (insErr) {
      if (insErr.code === '23505') {
        return json(200, { ok: true, duplicate: true });
      }
      return json(500, { ok: false, error: insErr.message });
    }
    return json(200, { ok: true });
  }

  const { error: delErr } = await admin
    .from('user_roles')
    .delete()
    .eq('user_id', targetUserId)
    .eq('role', 'admin');

  if (delErr) return json(500, { ok: false, error: delErr.message });
  return json(200, { ok: true });
}
