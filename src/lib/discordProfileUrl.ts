/** Opens this user's Discord profile (app or web) using their snowflake ID. */
export function discordUserProfileUrl(discordId: string | null | undefined): string | null {
  if (discordId == null) return null;
  const id = String(discordId).trim();
  // Real Discord snowflakes are 17–20 digits; looser patterns often produce "Invalid Resource" pages.
  if (!id || !/^\d{17,20}$/.test(id)) return null;
  return `https://discord.com/users/${id}`;
}
