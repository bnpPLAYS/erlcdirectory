export const config = { runtime: 'edge' };

/**
 * Proxies authenticated POSTs to Supabase `discord-profile-media` when the browser
 * cannot use `supabase.functions.invoke` (common production error).
 * Forwards the caller's JWT — the Edge Function requires verify_jwt.
 */
export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
      status: 401,
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

  let forwardBody = '{}';
  try {
    const t = await request.text();
    if (t?.trim()) forwardBody = t;
  } catch {
    forwardBody = '{}';
  }

  const target = `${supabaseUrl}/functions/v1/discord-profile-media`;
  const res = await fetch(target, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: auth,
    },
    body: forwardBody,
  });

  const outText = await res.text();
  return new Response(outText, {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
