export const config = { runtime: 'edge' };

/**
 * Proxies POSTs to Supabase experience-verify when the browser cannot reach Supabase directly
 * (CORS, ad blockers, or network quirks). Requires the same env vars as the Vite client.
 */
export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const anonKey =
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || '';

  if (!supabaseUrl || !anonKey) {
    return new Response(
      JSON.stringify({
        error:
          'Server missing Supabase URL or anon key. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to Vercel.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const reqUrl = new URL(request.url);
  const action = reqUrl.searchParams.get('action') || 'lookup';
  const bodyText = await request.text();

  const target = `${supabaseUrl}/functions/v1/experience-verify?action=${encodeURIComponent(action)}`;
  const res = await fetch(target, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    body: bodyText.length ? bodyText : '{}',
  });

  const outText = await res.text();
  return new Response(outText, {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
