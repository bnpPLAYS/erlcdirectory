/**
 * Discord returns `avatar: null` for the default (non-uploaded) avatar. CDN URL is derived from user id.
 * @see https://discord.com/developers/docs/reference#image-formatting-cdn-endpoints
 */
export function discordDefaultAvatarCdnUrl(discordUserId: string): string {
  const id = String(discordUserId || '').trim();
  if (!/^\d+$/.test(id)) return 'https://cdn.discordapp.com/embed/avatars/0.png';
  try {
    const n = BigInt(id);
    const idx = Number((n >> 22n) % 6n);
    return `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
  } catch {
    return 'https://cdn.discordapp.com/embed/avatars/0.png';
  }
}
