/** Rows from `experiences` used to count directory staff per Discord guild. */
export type GuildProfileRow = {
  guild_id: string | null;
  profile_id: string | null;
};

/**
 * Distinct profiles per Discord guild_id (trimmed). Matches “people with experience here”
 * semantics used on server detail — duplicate experience rows for the same profile count once.
 */
export function distinctStaffCountByGuild(rows: GuildProfileRow[]): Map<string, number> {
  const byGuild = new Map<string, Set<string>>();
  for (const r of rows) {
    const g = r.guild_id?.trim();
    const p = r.profile_id?.trim();
    if (!g || !p) continue;
    if (!byGuild.has(g)) byGuild.set(g, new Set());
    byGuild.get(g)!.add(p);
  }
  return new Map([...byGuild.entries()].map(([g, set]) => [g, set.size]));
}
