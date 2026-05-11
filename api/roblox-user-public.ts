export const config = { runtime: 'edge' };

const ID_RE = /^\d{5,20}$/;

const jsonHeaders = {
  'Content-Type': 'application/json',
  'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=86400',
};

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ ok: false, error: 'Method not allowed' }), {
      status: 405,
      headers: jsonHeaders,
    });
  }

  const url = new URL(request.url);
  const userId = (url.searchParams.get('userId') ?? '').trim();
  if (!ID_RE.test(userId)) {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid user id' }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  const robloxRes = await fetch(`https://users.roblox.com/v1/users/${userId}`);
  if (!robloxRes.ok) {
    return new Response(JSON.stringify({ ok: false, error: 'User not found' }), {
      status: 404,
      headers: jsonHeaders,
    });
  }

  const body = (await robloxRes.json()) as { id?: number; name?: string; displayName?: string };
  if (typeof body?.name !== 'string' || typeof body?.displayName !== 'string' || typeof body?.id !== 'number') {
    return new Response(JSON.stringify({ ok: false, error: 'Unexpected Roblox response' }), {
      status: 502,
      headers: jsonHeaders,
    });
  }

  return new Response(
    JSON.stringify({
      ok: true,
      id: body.id,
      name: body.name,
      displayName: body.displayName,
    }),
    { status: 200, headers: jsonHeaders },
  );
}
