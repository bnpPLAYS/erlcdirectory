/** Public Roblox profile URL from numeric user id (verified link). */
export function robloxWebProfileUrl(robloxUserId: string | number | null | undefined): string | null {
  const id = String(robloxUserId ?? '').trim();
  if (!/^\d{5,20}$/.test(id)) return null;
  return `https://www.roblox.com/users/${id}/profile`;
}

/** Square PNG headshot URL (works in `<img>` without our API). */
export function robloxHeadshotImageUrl(
  robloxUserId: string | number | null | undefined,
  size: number = 180,
): string | null {
  const id = String(robloxUserId ?? '').trim();
  if (!/^\d{5,20}$/.test(id)) return null;
  const s = Math.min(420, Math.max(48, Math.round(size)));
  return `https://www.roblox.com/headshot-thumbnail/image?userId=${id}&width=${s}&height=${s}&format=png`;
}
