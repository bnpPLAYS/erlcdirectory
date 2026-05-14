export const config = { runtime: 'edge' };

const ADMIN = 0x8n;

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: { access_token?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const accessToken = body.access_token;
  if (!accessToken || typeof accessToken !== 'string') {
    return new Response(JSON.stringify({ error: 'Missing access_token' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const guildsRes = await fetch('https://discord.com/api/users/@me/guilds', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!guildsRes.ok) {
    const detail = await guildsRes.text();
    return new Response(
      JSON.stringify({
        error: 'Discord rejected the request. Sign out and sign in with Discord again.',
        detail: detail.slice(0, 500),
      }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const guilds = (await guildsRes.json()) as Array<{
    id: string;
    name: string;
    icon: string | null;
    owner?: boolean;
    permissions?: string;
  }>;

  const out = guilds.map((g) => {
    let perms = 0n;
    try {
      perms = BigInt(g.permissions ?? '0');
    } catch {
      /* ignore */
    }
    return {
      id: String(g.id),
      name: g.name,
      icon: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=128` : null,
      owner: !!g.owner,
      is_admin: !!g.owner || (perms & ADMIN) === ADMIN,
    };
  });

  return new Response(JSON.stringify({ guilds: out }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
