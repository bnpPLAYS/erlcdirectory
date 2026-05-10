export const config = { runtime: 'edge' };

/**
 * Proxies Pro verification to the Supabase Edge Function `verify-roblox-pro`.
 * Only needs VITE_SUPABASE_URL (or SUPABASE_URL / project ref) + anon key on Vercel —
 * no SUPABASE_SERVICE_ROLE_KEY here. The Edge Function uses the injected service role.
 */
export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
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

  if (!supabaseUrl || !anonKey) {
    return new Response(
      JSON.stringify({
        ok: false,
        error:
          'Server missing Supabase URL or anon key. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY on Vercel.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const bodyText = await request.text();
  const incomingAuth = request.headers.get('Authorization');
  const forwardAuth =
    incomingAuth?.startsWith('Bearer ') && incomingAuth.length > 24 ? incomingAuth : `Bearer ${anonKey}`;

  const target = `${supabaseUrl}/functions/v1/verify-roblox-pro`;
  const res = await fetch(target, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: forwardAuth,
    },
    body: bodyText.length ? bodyText : '{}',
  });

  const outText = await res.text();
  return new Response(outText, {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
