export const config = { runtime: 'edge' };

import { createClient } from '@supabase/supabase-js';

/**
 * Verifies the signed-in member owns the ERLC Directory Pro Roblox game pass via Open Cloud,
 * then sets profiles.is_pro (service role).
 *
 * ## Vercel env
 * - ROBLOX_OPEN_CLOUD_API_KEY — Creator Dashboard → Credentials → API Keys. Enable **Inventory** (user.inventory-item:read) or equivalent for inventory filters.
 * - ROBLOX_PRO_GAME_PASS_ID — optional; defaults to catalog pass id `76823573023998`.
 * - SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_URL (or SUPABASE_URL), VITE_SUPABASE_PUBLISHABLE_KEY (or SUPABASE_ANON_KEY)
 *
 * ## Roblox (player-facing)
 * Purchasers should set **Settings → Privacy → Who can see my inventory?** to **Everyone**
 * so Open Cloud can confirm game pass ownership. Otherwise verification may return 403.
 *
 * ## API reference
 * https://create.roblox.com/docs/cloud/guides/inventory — filter `gamePassIds=...`
 */
function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });

  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return json(401, { ok: false, error: 'Unauthorized' });

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
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';
  const robloxKey = process.env.ROBLOX_OPEN_CLOUD_API_KEY?.trim() || '';
  const gamePassId = (process.env.ROBLOX_PRO_GAME_PASS_ID || '76823573023998').trim();

  if (!supabaseUrl || !anonKey || !serviceKey) {
    const missing: string[] = [];
    if (!supabaseUrl) missing.push('VITE_SUPABASE_URL or SUPABASE_URL (or VITE_SUPABASE_PROJECT_ID)');
    if (!anonKey) missing.push('VITE_SUPABASE_PUBLISHABLE_KEY or SUPABASE_ANON_KEY');
    if (!serviceKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
    return json(500, {
      ok: false,
      error: `Server missing Supabase configuration (${missing.join(', ')}). Add these in Vercel → Project → Settings → Environment Variables for Production (and Preview if you test there), then redeploy. Supabase Dashboard secrets do not apply to this route.`,
    });
  }
  if (!robloxKey) {
    return json(500, {
      ok: false,
      error:
        'ROBLOX_OPEN_CLOUD_API_KEY is not set. Create an API key in Roblox Creator Dashboard (Inventory read) and add it to Vercel.',
    });
  }

  let body: { roblox_username?: string; roblox_user_id?: string };
  try {
    body = await request.json();
  } catch {
    return json(400, { ok: false, error: 'Invalid JSON' });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser();
  if (userErr || !user) return json(401, { ok: false, error: 'Invalid session' });

  let robloxUserId: number;
  const rawId = (body.roblox_user_id ?? '').toString().trim();
  const username = (body.roblox_username ?? '').trim();

  if (rawId && /^\d+$/.test(rawId)) {
    robloxUserId = parseInt(rawId, 10);
  } else if (username.length >= 3 && username.length <= 64) {
    const ur = await fetch('https://users.roblox.com/v1/usernames/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernames: [username], excludeBannedUsers: true }),
    });
    if (!ur.ok) {
      return json(502, { ok: false, error: 'Could not reach Roblox to resolve username.' });
    }
    const uj = (await ur.json()) as { data?: Array<{ id: number; name: string }> };
    const row = uj.data?.[0];
    if (!row?.id) {
      return json(400, { ok: false, error: 'Roblox username not found. Check spelling and try again.' });
    }
    robloxUserId = row.id;
  } else {
    return json(400, {
      ok: false,
      error: 'Provide roblox_username (3–64 chars) or roblox_user_id (numeric).',
    });
  }

  const filter = encodeURIComponent(`gamePassIds=${gamePassId}`);
  const invUrl = `https://apis.roblox.com/cloud/v2/users/${robloxUserId}/inventory-items?maxPageSize=10&filter=${filter}`;

  const inv = await fetch(invUrl, {
    headers: { 'x-api-key': robloxKey },
  });

  if (inv.status === 403) {
    return json(403, {
      ok: false,
      error:
        'Roblox blocked inventory check. On Roblox: Settings → Privacy → set “Who can see my inventory?” to Everyone, then try again.',
    });
  }

  if (!inv.ok) {
    const t = await inv.text().catch(() => '');
    return json(502, {
      ok: false,
      error: `Roblox Open Cloud error (${inv.status}). Check API key permissions and game pass id. ${t.slice(0, 200)}`,
    });
  }

  let invJson: { inventoryItems?: unknown[] };
  try {
    invJson = (await inv.json()) as { inventoryItems?: unknown[] };
  } catch {
    return json(502, { ok: false, error: 'Invalid response from Roblox.' });
  }

  const owns = Array.isArray(invJson.inventoryItems) && invJson.inventoryItems.length > 0;
  if (!owns) {
    return json(400, {
      ok: false,
      error:
        'This Roblox account does not own ERLC Directory Pro yet, or the pass id does not match. Buy the pass, wait a minute, then verify again.',
    });
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: profile, error: pErr } = await admin
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (pErr || !profile?.id) {
    return json(400, { ok: false, error: 'Profile not found. Sign in once to create your profile.' });
  }

  const now = new Date().toISOString();
  const { error: upErr } = await admin
    .from('profiles')
    .update({
      is_pro: true,
      roblox_user_id: String(robloxUserId),
      pro_verified_at: now,
    })
    .eq('id', profile.id);

  if (upErr) {
    return json(500, { ok: false, error: upErr.message || 'Could not update profile.' });
  }

  return json(200, { ok: true, roblox_user_id: robloxUserId, pro_verified_at: now });
}
