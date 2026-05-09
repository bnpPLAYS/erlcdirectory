export const config = { runtime: 'edge' };

/**
 * Proxies POSTs to Supabase `experience-verify` so the app still works when the browser
 * cannot use `supabase.functions.invoke` (network/CORS/deploy issues). Uses anon key only;
 * the Edge Function continues to use the service role server-side.
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
          'Server is missing Supabase URL or anon/publishable key. Add them to Vercel environment variables.',
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
