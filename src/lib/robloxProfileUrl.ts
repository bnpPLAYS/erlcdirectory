/** Public Roblox profile URL from numeric user id (verified link). */
export function robloxWebProfileUrl(robloxUserId: string | number | null | undefined): string | null {
  const id = String(robloxUserId ?? '').trim();
  if (!/^\d{5,20}$/.test(id)) return null;
  return `https://www.roblox.com/users/${id}/profile`;
}
