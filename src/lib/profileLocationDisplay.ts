/**
 * Map stored profile location strings (see profileLocations.ts) to a short region code + flag.
 */

const CP = 0x1f1e6;

function flagEmojiFromIso2(cc: string): string {
  const u = cc.toUpperCase();
  if (u.length !== 2) return '';
  const a = u.codePointAt(0);
  const b = u.codePointAt(1);
  if (!a || !b || a < 65 || a > 90 || b < 65 || b > 90) return '';
  return String.fromCodePoint(CP + a - 65, CP + b - 65);
}

export type ProfileLocationDisplay = {
  /** Short label, e.g. US, MX, UK */
  code: string;
  /** Regional-indicator flag emoji */
  flag: string;
  /** Full stored value for tooltip */
  fullLabel: string;
};

/**
 * Returns display info for the profile header, or null if unknown / empty.
 */
export function getProfileLocationDisplay(stored: string | null | undefined): ProfileLocationDisplay | null {
  const t = stored?.trim();
  if (!t) return null;

  if (t.startsWith('United States — ')) {
    return { code: 'US', flag: flagEmojiFromIso2('US'), fullLabel: t };
  }
  if (t.startsWith('Mexico — ')) {
    return { code: 'MX', flag: flagEmojiFromIso2('MX'), fullLabel: t };
  }
  if (t === 'Australia') {
    return { code: 'AU', flag: flagEmojiFromIso2('AU'), fullLabel: t };
  }
  if (t === 'Canada') {
    return { code: 'CA', flag: flagEmojiFromIso2('CA'), fullLabel: t };
  }
  if (t === 'Republic of Ireland') {
    return { code: 'IE', flag: flagEmojiFromIso2('IE'), fullLabel: t };
  }
  if (t === 'Outside UK & Ireland') {
    return { code: '—', flag: '🌍', fullLabel: t };
  }

  return { code: 'UK', flag: flagEmojiFromIso2('GB'), fullLabel: t };
}
