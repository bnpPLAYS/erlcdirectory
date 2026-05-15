/** Extract YouTube video id for /embed/ URLs. */
export function extractYouTubeId(raw: string | null | undefined): string | null {
  const s = raw?.trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    const h = u.hostname.toLowerCase();
    if (h === 'youtu.be') {
      const id = u.pathname.replace(/^\//, '').split('/')[0];
      return id && /^[\w-]{6,}$/.test(id) ? id : null;
    }
    if (h === 'www.youtube.com' || h === 'youtube.com' || h === 'm.youtube.com') {
      if (u.pathname === '/watch') {
        const v = u.searchParams.get('v');
        return v && /^[\w-]{6,}$/.test(v) ? v : null;
      }
      const m = u.pathname.match(/^\/embed\/([\w-]+)/);
      if (m?.[1]) return m[1];
    }
  } catch {
    return null;
  }
  return null;
}

export function youtubeEmbedSrc(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}`;
}
