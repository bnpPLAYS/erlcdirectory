export const config = { runtime: 'edge' };

/**
 * Proxies POSTs to Supabase canary-session when the browser cannot reach Supabase directly.
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
          'Server missing Supabase URL or anon key. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to Vercel.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const bodyText = await request.text();
  const incomingAuth = request.headers.get('Authorization');
  const forwardAuth =
    incomingAuth?.startsWith('Bearer ') && incomingAuth.length > 24 ? incomingAuth : `Bearer ${anonKey}`;

  const target = `${supabaseUrl}/functions/v1/canary-session`;
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
