/**
 * Client-side text moderation for user-authored fields (bios, posts, messages, etc.).
 * Replaces whole-word matches with asterisks. Extend BLOCKED_TERMS as needed.
 */

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Lowercase tokens matched as \\b ... \\b (ASCII letters/digits boundaries). */
const BLOCKED_TERMS: string[] = [
  'fuck',
  'shit',
  'bitch',
  'asshole',
  'bastard',
  'cunt',
  'dick',
  'cock',
  'pussy',
  'slut',
  'whore',
  'rape',
  'nazi',
];

const ZERO_WIDTH = /[\u200b\u200c\u200d\u2060\ufeff]/g;

/** Collapse exaggerated character spam (e.g. fuuuuck) before scanning. */
function collapseRepeats(input: string): string {
  return input.replace(/(.)\1{4,}/gi, '$1$1$1');
}

export interface FilterResult {
  text: string;
  blockedHits: number;
}

/**
 * Returns sanitized text and count of blocked tokens replaced.
 */
export function filterPlaintext(input: string): FilterResult {
  if (!input || typeof input !== 'string') return { text: '', blockedHits: 0 };
  let text = input.replace(ZERO_WIDTH, '');
  text = collapseRepeats(text);
  let blockedHits = 0;
  for (const raw of BLOCKED_TERMS) {
    const word = raw.toLowerCase();
    const re = new RegExp(`\\b${escapeRegex(word)}\\b`, 'gi');
    const matches = text.match(re);
    if (matches?.length) {
      blockedHits += matches.length;
      text = text.replace(re, (m) => '*'.repeat(Math.min(m.length, 12)));
    }
  }
  return { text, blockedHits };
}

/** Quick check without allocating replacement string twice. */
export function containsBlockedLanguage(input: string): boolean {
  return filterPlaintext(input).blockedHits > 0;
}

/** Filter optional/nullable DB fields */
export function filterNullablePlaintext(input: string | null | undefined): string | null {
  if (input == null) return null;
  const { text } = filterPlaintext(input);
  const t = text.trim();
  return t.length ? t : null;
}
