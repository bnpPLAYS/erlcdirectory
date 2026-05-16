/** Parse `owner_gallery_urls` / `profile_gallery_urls` JSON arrays from the database. */
export function parseGalleryUrlList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => String(x)).filter((s) => s.startsWith('http'));
}

export const GALLERY_MAX_FREE = 6;
export const GALLERY_MAX_PRO = 12;
