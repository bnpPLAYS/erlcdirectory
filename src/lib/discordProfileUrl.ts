/** Opens this user's Discord profile (app or web) using their snowflake ID. */
export function discordUserProfileUrl(discordId: string | null | undefined): string | null {
  if (discordId == null) return null;
  const id = String(discordId).trim();
  if (!id || !/^\d+$/.test(id)) return null;
  return `https://discord.com/users/${id}`;
}
