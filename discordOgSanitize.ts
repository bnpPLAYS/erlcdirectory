/**
 * Plain-text OG / Discord unfurl hardening (Edge-safe, no framework deps).
 */

/** Break Discord mention / ping tokens in plain-text OG titles and descriptions (embed previews). */
export function sanitizeDiscordOgPlaintext(input: string): string {
  const zw = '\u200b';
  let s = input;
  s = s.replace(/<@!?[0-9]{5,25}>/g, `${zw}user`);
  s = s.replace(/<@&[0-9]{5,25}>/g, `${zw}role`);
  s = s.replace(/<#[0-9]{5,25}>/g, `${zw}channel`);
  s = s.replace(/@everyone\b/gi, `@${zw}everyone`);
  s = s.replace(/@here\b/gi, `@${zw}here`);
  s = s.replace(/@channel\b/gi, `@${zw}channel`);
  return s;
}
