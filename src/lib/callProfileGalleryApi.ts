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

/** Upload one profile gallery image; returns public URL on success. */
export async function uploadProfileGalleryImage(
  profileId: string,
  file: File,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return { ok: false, error: 'Sign in required.' };

  const fd = new FormData();
  fd.set('profile_id', profileId);
  fd.set('file', file);

  for (const base of candidateSupabaseBases()) {
    try {
      const res = await fetch(`${base.replace(/\/$/, '')}/functions/v1/upload-profile-gallery`, {
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
    const res = await fetch('/api/upload-profile-gallery', {
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
