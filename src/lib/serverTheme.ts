/**
 * Per-server theme stored on `servers.theme` (jsonb).
 *
 * Owner-controlled accent + secondary color + banner overlay strength.
 * Pro owners unlock additional palette presets.
 */

export const SERVER_THEME_PALETTES = [
  { id: 'indigo', label: 'Indigo', accent: '#6366f1', secondary: '#a855f7' },
  { id: 'emerald', label: 'Emerald', accent: '#10b981', secondary: '#22d3ee' },
  { id: 'amber', label: 'Amber', accent: '#f59e0b', secondary: '#fb7185' },
  { id: 'rose', label: 'Rose', accent: '#f43f5e', secondary: '#ec4899' },
  { id: 'slate', label: 'Slate', accent: '#94a3b8', secondary: '#cbd5e1' },
] as const;

export const SERVER_THEME_PRO_PALETTES = [
  { id: 'aurora', label: 'Aurora (Pro)', accent: '#22d3ee', secondary: '#a855f7' },
  { id: 'sunset', label: 'Sunset (Pro)', accent: '#fb7185', secondary: '#f59e0b' },
  { id: 'midnight', label: 'Midnight (Pro)', accent: '#1e293b', secondary: '#6366f1' },
  { id: 'gold', label: 'Royal Gold (Pro)', accent: '#eab308', secondary: '#fde68a' },
  { id: 'ocean', label: 'Deep Ocean (Pro)', accent: '#0ea5e9', secondary: '#1d4ed8' },
] as const;

export type ServerTheme = {
  accent_hex?: string;
  secondary_hex?: string;
  banner_overlay?: number; // 0..1
  font?: 'system' | 'serif' | 'mono';
  palette_id?: string;
  pro_palette?: boolean;
};

export type ServerLayout = {
  show_members?: boolean;
  show_reviews?: boolean;
  show_gallery?: boolean;
  show_long_description?: boolean;
  sections_order?: Array<'members' | 'gallery' | 'reviews' | 'description'>;
};

export type ServerGalleryItem = {
  url: string;
  caption?: string;
};

const HEX_RE = /^#[0-9a-f]{6}$/i;

export function sanitizeServerTheme(raw: unknown): ServerTheme {
  if (!raw || typeof raw !== 'object') return {};
  const r = raw as Record<string, unknown>;
  const t: ServerTheme = {};
  if (typeof r.accent_hex === 'string' && HEX_RE.test(r.accent_hex)) t.accent_hex = r.accent_hex.toLowerCase();
  if (typeof r.secondary_hex === 'string' && HEX_RE.test(r.secondary_hex)) {
    t.secondary_hex = r.secondary_hex.toLowerCase();
  }
  if (typeof r.banner_overlay === 'number' && Number.isFinite(r.banner_overlay)) {
    t.banner_overlay = Math.max(0, Math.min(1, r.banner_overlay));
  }
  if (r.font === 'system' || r.font === 'serif' || r.font === 'mono') t.font = r.font;
  if (typeof r.palette_id === 'string' && r.palette_id.length <= 32) t.palette_id = r.palette_id;
  if (typeof r.pro_palette === 'boolean') t.pro_palette = r.pro_palette;
  return t;
}

export function sanitizeServerLayout(raw: unknown): ServerLayout {
  if (!raw || typeof raw !== 'object') return {};
  const r = raw as Record<string, unknown>;
  const out: ServerLayout = {};
  if (typeof r.show_members === 'boolean') out.show_members = r.show_members;
  if (typeof r.show_reviews === 'boolean') out.show_reviews = r.show_reviews;
  if (typeof r.show_gallery === 'boolean') out.show_gallery = r.show_gallery;
  if (typeof r.show_long_description === 'boolean') out.show_long_description = r.show_long_description;
  if (Array.isArray(r.sections_order)) {
    const valid = new Set(['members', 'gallery', 'reviews', 'description']);
    const arr = (r.sections_order as unknown[]).filter(
      (x) => typeof x === 'string' && valid.has(x),
    ) as ServerLayout['sections_order'];
    if (arr && arr.length) out.sections_order = Array.from(new Set(arr));
  }
  return out;
}

export function sanitizeServerGallery(raw: unknown, maxItems = 4): ServerGalleryItem[] {
  if (!Array.isArray(raw)) return [];
  const out: ServerGalleryItem[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const url = typeof o.url === 'string' ? o.url.trim() : '';
    if (!url) continue;
    // Allow https URLs and base64 data: URLs (used for client-side cropped uploads).
    if (!/^https:\/\//i.test(url) && !/^data:image\//i.test(url)) continue;
    if (url.length > 6_000_000) continue;
    const caption =
      typeof o.caption === 'string' ? o.caption.trim().slice(0, 240) : '';
    out.push({ url, caption: caption || undefined });
    if (out.length >= maxItems) break;
  }
  return out;
}

export function isValidDiscordWebhookUrl(raw: string | null | undefined): boolean {
  if (!raw) return false;
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:') return false;
    if (u.hostname !== 'discord.com' && u.hostname !== 'discordapp.com') return false;
    return u.pathname.startsWith('/api/webhooks/');
  } catch {
    return false;
  }
}

/** CSS variables to set on a server detail page when theme is configured. */
export function serverThemeStyleVars(theme: ServerTheme): React.CSSProperties {
  const vars: Record<string, string> = {};
  if (theme.accent_hex) vars['--server-accent'] = theme.accent_hex;
  if (theme.secondary_hex) vars['--server-secondary'] = theme.secondary_hex;
  if (typeof theme.banner_overlay === 'number') {
    vars['--server-banner-overlay'] = theme.banner_overlay.toFixed(2);
  }
  return vars as unknown as React.CSSProperties;
}

export function presetById(
  id: string | undefined,
  proUnlocked: boolean,
): (typeof SERVER_THEME_PALETTES)[number] | (typeof SERVER_THEME_PRO_PALETTES)[number] | undefined {
  if (!id) return undefined;
  const std = SERVER_THEME_PALETTES.find((p) => p.id === id);
  if (std) return std;
  if (!proUnlocked) return undefined;
  return SERVER_THEME_PRO_PALETTES.find((p) => p.id === id);
}

export const DEFAULT_LAYOUT: Required<ServerLayout> = {
  show_members: true,
  show_reviews: true,
  show_gallery: true,
  show_long_description: true,
  sections_order: ['description', 'gallery', 'members', 'reviews'],
};

export const MAX_GALLERY_STANDARD = 4;
export const MAX_GALLERY_PRO = 10;
