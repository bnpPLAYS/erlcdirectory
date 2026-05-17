/** Theme presets for claimed server pages (matches ServerOwnerPanel options). */
export const SERVER_THEME_PRESETS = {
  zinc: { accent: '#a1a1aa', surface: 'from-zinc-500/18 via-zinc-500/6' },
  slate: { accent: '#94a3b8', surface: 'from-slate-500/18 via-slate-500/6' },
  neutral: { accent: '#a3a3a3', surface: 'from-neutral-500/18 via-neutral-500/6' },
  rose: { accent: '#fb7185', surface: 'from-rose-500/22 via-rose-500/8' },
  cyan: { accent: '#22d3ee', surface: 'from-cyan-500/22 via-cyan-500/8' },
  amber: { accent: '#fbbf24', surface: 'from-amber-500/22 via-amber-500/8' },
  violet: { accent: '#a78bfa', surface: 'from-violet-500/22 via-violet-500/8' },
} as const;

export type ServerThemePreset = keyof typeof SERVER_THEME_PRESETS;

export function normalizeServerAccentHex(raw: string | null | undefined): string | null {
  const t = (raw ?? '').trim();
  if (!t) return null;
  const withHash = t.startsWith('#') ? t : `#${t}`;
  return /^#[0-9A-Fa-f]{6}$/.test(withHash) ? withHash : null;
}

/** Claimed servers use owner accent + preset on the public page. */
export function resolveServerAccent(server: {
  owner_id?: string | null;
  owner_accent_hex?: string | null;
  owner_theme_preset?: string | null;
}): string | null {
  if (!server.owner_id) return null;
  const custom = normalizeServerAccentHex(server.owner_accent_hex);
  if (custom) return custom;
  const preset = (server.owner_theme_preset || 'zinc') as ServerThemePreset;
  return SERVER_THEME_PRESETS[preset]?.accent ?? SERVER_THEME_PRESETS.zinc.accent;
}

export function resolveServerPresetSurface(server: {
  owner_id?: string | null;
  owner_theme_preset?: string | null;
}): string {
  if (!server.owner_id) return SERVER_THEME_PRESETS.zinc.surface;
  const preset = (server.owner_theme_preset || 'zinc') as ServerThemePreset;
  return SERVER_THEME_PRESETS[preset]?.surface ?? SERVER_THEME_PRESETS.zinc.surface;
}

export function resolveServerBannerUrl(server: {
  owner_banner_url?: string | null;
  banner?: string | null;
}): string | null {
  const custom = server.owner_banner_url?.trim();
  if (custom) return custom;
  const discord = server.banner?.trim();
  return discord || null;
}
