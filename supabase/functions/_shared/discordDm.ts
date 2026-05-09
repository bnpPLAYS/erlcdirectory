/**
 * Send a DM as a Discord bot. Users must share a server with the bot (or have an open DM channel).
 * https://discord.com/developers/docs/resources/user#create-dm
 */
export async function sendDiscordUserDm(
  botToken: string,
  recipientDiscordId: string,
  content: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const text = content.trim().slice(0, 2000)
  if (!text) return { ok: false, error: 'empty_message' }

  const chRes = await fetch('https://discord.com/api/v10/users/@me/channels', {
    method: 'POST',
    headers: {
      Authorization: `Bot ${botToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ recipient_id: recipientDiscordId }),
  })

  if (!chRes.ok) {
    const err = await chRes.text()
    return { ok: false, error: `dm_channel:${chRes.status}:${err.slice(0, 240)}` }
  }

  const ch = (await chRes.json()) as { id?: string }
  if (!ch.id) return { ok: false, error: 'dm_channel_missing_id' }

  const msgRes = await fetch(`https://discord.com/api/v10/channels/${ch.id}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bot ${botToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content: text }),
  })

  if (!msgRes.ok) {
    const err = await msgRes.text()
    return { ok: false, error: `dm_send:${msgRes.status}:${err.slice(0, 240)}` }
  }

  return { ok: true }
}
