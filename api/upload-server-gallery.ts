export const config = { runtime: 'edge' };

/** Proxies multipart POST to Supabase upload-server-gallery Edge Function. */
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
    return new Response(JSON.stringify({ ok: false, error: 'Server missing Supabase URL or anon key.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const incomingAuth = request.headers.get('Authorization');
  const forwardAuth =
    incomingAuth?.startsWith('Bearer ') && incomingAuth.length > 24 ? incomingAuth : `Bearer ${anonKey}`;

  const ct = request.headers.get('Content-Type') || 'multipart/form-data';
  const body = await request.arrayBuffer();

  const target = `${supabaseUrl}/functions/v1/upload-server-gallery`;
  const res = await fetch(target, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: forwardAuth,
      'Content-Type': ct,
    },
    body,
  });

  const outText = await res.text();
  return new Response(outText, {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
