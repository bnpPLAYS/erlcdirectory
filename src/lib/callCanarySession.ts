function candidateSupabaseBases(): string[] {
  const fromUrl = import.meta.env.VITE_SUPABASE_URL?.trim().replace(/\/$/, '') || '';
  const ref = import.meta.env.VITE_SUPABASE_PROJECT_ID?.trim();
  const fromRef = ref ? `https://${ref}.supabase.co` : '';
  const out: string[] = [];
  if (fromUrl) out.push(fromUrl);
  if (fromRef && !out.includes(fromRef)) out.push(fromRef);
  if (out.length === 0) {
    throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PROJECT_ID');
  }
  return out;
}

function anonHeaders(): Record<string, string> {
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!key) throw new Error('Missing VITE_SUPABASE_PUBLISHABLE_KEY');
  return {
    'Content-Type': 'application/json',
    apikey: key,
    Authorization: `Bearer ${key}`,
  };
}

function authHeaders(accessToken: string): Record<string, string> {
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!key) throw new Error('Missing VITE_SUPABASE_PUBLISHABLE_KEY');
  return {
    'Content-Type': 'application/json',
    apikey: key,
    Authorization: `Bearer ${accessToken.trim()}`,
  };
}

async function parseJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { ok: false, error: `Non-JSON response (${res.status})` };
  }
}

async function postDirect(
  body: Record<string, unknown>,
  headers: Record<string, string>,
): Promise<Record<string, unknown>> {
  let last: Record<string, unknown> = { ok: false, error: 'Unreachable' };
  for (const base of candidateSupabaseBases()) {
    const url = `${base.replace(/\/$/, '')}/functions/v1/canary-session`;
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    const j = await parseJson(res);
    if (j.ok === true) return j;
    last = j;
  }
  return last;
}

async function postProxy(
  body: Record<string, unknown>,
  headers: Record<string, string>,
): Promise<Record<string, unknown>> {
  const res = await fetch('/api/canary-session', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  return parseJson(res);
}

async function postCanary(
  body: Record<string, unknown>,
  headers: Record<string, string>,
): Promise<Record<string, unknown>> {
  try {
    const r1 = await postDirect(body, headers);
    if (r1.ok === true) return r1;
  } catch {
    /* try proxy */
  }
  return postProxy(body, headers);
}

export async function canaryPublicStatus(): Promise<{ gate_required: boolean; error?: string }> {
  const j = await postCanary({ action: 'public_status' }, anonHeaders());
  if (j.ok === true && typeof j.gate_required === 'boolean') {
    return { gate_required: j.gate_required };
  }
  return { gate_required: false, error: typeof j.error === 'string' ? j.error : 'Status unavailable' };
}

export async function canaryVerifyToken(token: string): Promise<boolean> {
  const j = await postCanary({ action: 'verify_token', token }, anonHeaders());
  return j.ok === true && j.valid === true;
}

export async function canaryValidateCode(
  code: string,
): Promise<{ ok: true; access_token: string } | { ok: false; error: string }> {
  const j = await postCanary({ action: 'validate_code', code }, anonHeaders());
  if (j.ok === true && typeof j.access_token === 'string') {
    return { ok: true, access_token: j.access_token };
  }
  return { ok: false, error: typeof j.error === 'string' ? j.error : 'Could not validate code.' };
}

export async function canaryStaffStatus(
  accessToken: string,
): Promise<{ ok: true; active: boolean; started_at: string | null } | { ok: false; error: string }> {
  const j = await postCanary({ action: 'staff_status' }, authHeaders(accessToken));
  if (j.ok === true && typeof j.active === 'boolean') {
    return { ok: true, active: j.active, started_at: typeof j.started_at === 'string' ? j.started_at : null };
  }
  return { ok: false, error: typeof j.error === 'string' ? j.error : 'Request failed' };
}

export async function canaryStaffStart(
  accessToken: string,
): Promise<{ ok: true; test_code: string; hint?: string } | { ok: false; error: string }> {
  const j = await postCanary({ action: 'staff_start' }, authHeaders(accessToken));
  if (j.ok === true && typeof j.test_code === 'string') {
    return { ok: true, test_code: j.test_code, hint: typeof j.hint === 'string' ? j.hint : undefined };
  }
  return { ok: false, error: typeof j.error === 'string' ? j.error : 'Request failed' };
}

export async function canaryStaffStop(accessToken: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const j = await postCanary({ action: 'staff_stop' }, authHeaders(accessToken));
  if (j.ok === true) return { ok: true };
  return { ok: false, error: typeof j.error === 'string' ? j.error : 'Request failed' };
}
