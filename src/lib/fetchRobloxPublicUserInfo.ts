export type RobloxPublicUserInfo = {
  id: number;
  name: string;
  displayName: string;
};

/** Loads public Roblox username/display name via our API (Roblox JSON is not browser-CORS friendly). */
export async function fetchRobloxPublicUserInfo(
  userId: string,
  signal?: AbortSignal,
): Promise<RobloxPublicUserInfo | null> {
  const id = String(userId).trim();
  if (!/^\d{5,20}$/.test(id)) return null;
  const res = await fetch(`/api/roblox-user-public?userId=${encodeURIComponent(id)}`, { signal });
  if (!res.ok) return null;
  const j = (await res.json()) as { ok?: boolean; id?: number; name?: string; displayName?: string };
  if (j.ok !== true || typeof j.name !== 'string' || typeof j.displayName !== 'string' || typeof j.id !== 'number') {
    return null;
  }
  return { id: j.id, name: j.name, displayName: j.displayName };
}
