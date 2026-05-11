/** Optional marketing URL for the free “link account” Roblox catalog item (Vite env). */
export const ROBLOX_ACCOUNT_LINK_ITEM_URL =
  (import.meta.env.VITE_ROBLOX_ACCOUNT_LINK_ITEM_URL as string | undefined)?.trim() || '';
