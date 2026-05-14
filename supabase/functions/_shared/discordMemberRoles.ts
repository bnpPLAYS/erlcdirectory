/**
 * Resolve a member's role names in a guild using the bot token.
 * Requires the bot to be in the server with Guild Members intent enabled.
 */
export async function fetchMemberDiscordRolesForGuild(
  botToken: string,
  guildId: string,
  memberDiscordId: string,
): Promise<{ roles: { id: string; name: string }[] }> {
  const headers = { Authorization: `Bot ${botToken.trim()}` }

  const [memRes, rolesRes] = await Promise.all([
    fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${memberDiscordId}`, { headers }),
    fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, { headers }),
  ])

  if (!memRes.ok || !rolesRes.ok) {
    return { roles: [] }
  }

  const member = (await memRes.json()) as { roles?: string[] }
  const allRoles = (await rolesRes.json()) as Array<{ id: string; name: string; position: number }>

  const roleMap = new Map(allRoles.map((r) => [r.id, r]))
  const everyoneRoleId = guildId
  const ids = (member.roles ?? []).filter((id) => id !== everyoneRoleId)

  const enriched = ids
    .map((id) => roleMap.get(id))
    .filter((r): r is NonNullable<typeof r> => !!r)
    .sort((a, b) => b.position - a.position)
    .map((r) => ({ id: r.id, name: r.name }))

  return { roles: enriched }
}
