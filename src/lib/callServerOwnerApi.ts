import { supabase } from '@/integrations/supabase/client';

function candidateSupabaseBases(): string[] {
  const fromUrl = import.meta.env.VITE_SUPABASE_URL?.trim().replace(/\/$/, '') || '';
  const ref = import.meta.env.VITE_SUPABASE_PROJECT_ID?.trim();
  const fromRef = ref ? `https://${ref}.supabase.co` : '';
  const out: string[] = [];
  if (fromUrl) out.push(fromUrl);
  if (fromRef && !out.includes(fromRef)) out.push(fromRef);
  return out;
}

function headersJson(accessToken: string): Record<string, string> {
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!key) throw new Error('Missing VITE_SUPABASE_PUBLISHABLE_KEY');
  return {
    'Content-Type': 'application/json',
    apikey: key,
    Authorization: `Bearer ${accessToken.trim()}`,
  };
}

async function uploadServerImage(
  serverId: string,
  file: File,
  kind: 'gallery' | 'banner',
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return { ok: false, error: 'Sign in required.' };

  const fd = new FormData();
  fd.set('server_id', serverId);
  fd.set('file', file);
  fd.set('kind', kind);

  for (const base of candidateSupabaseBases()) {
    try {
      const res = await fetch(`${base.replace(/\/$/, '')}/functions/v1/upload-server-gallery`, {
        method: 'POST',
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: fd,
      });
      const j = (await res.json()) as { ok?: boolean; url?: string; error?: string };
      if (res.ok && j.ok && typeof j.url === 'string') return { ok: true, url: j.url };
      if (j.error) return { ok: false, error: j.error };
    } catch {
      /* try next */
    }
  }

  try {
    const res = await fetch('/api/upload-server-gallery', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      body: fd,
    });
    const j = (await res.json()) as { ok?: boolean; url?: string; error?: string };
    if (res.ok && j.ok && typeof j.url === 'string') return { ok: true, url: j.url };
    if (j.error) return { ok: false, error: j.error };
  } catch {
    /* */
  }

  return { ok: false, error: 'Could not upload image. Try again.' };
}

/** Upload one gallery image; returns public URL on success. */
export function uploadServerGalleryImage(
  serverId: string,
  file: File,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  return uploadServerImage(serverId, file, 'gallery');
}

/** Upload custom page banner; sets owner_banner_url on the server row. */
export function uploadServerBannerImage(
  serverId: string,
  file: File,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  return uploadServerImage(serverId, file, 'banner');
}

/** Notify Discord webhook (if configured). Errors are swallowed — best-effort. */
export async function notifyServerReview(serverId: string, reviewId: string): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return;

  const body = JSON.stringify({ server_id: serverId, review_id: reviewId });
  let h: Record<string, string>;
  try {
    h = headersJson(session.access_token);
  } catch {
    return;
  }

  for (const base of candidateSupabaseBases()) {
    try {
      const res = await fetch(`${base.replace(/\/$/, '')}/functions/v1/server-review-notify`, {
        method: 'POST',
        headers: h,
        body,
      });
      if (res.ok) return;
    } catch {
      /* */
    }
  }

  try {
    await fetch('/api/server-review-notify', { method: 'POST', headers: h, body });
  } catch {
    /* */
  }
}
