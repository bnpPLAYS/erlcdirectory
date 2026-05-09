/**
 * Resolve Discord CDN URLs and fetch public/bot metadata to populate directory `servers` rows.
 * Invite URL priority: vanity URL (bot) → new invite on first text channel (bot) → server widget (public).
 */

export function discordBannerCdnUrl(guildId: string, bannerHash: string | null | undefined): string | null {
  if (!guildId || !bannerHash) return null
  const ext = bannerHash.startsWith('a_') ? 'gif' : 'png'
  return `https://cdn.discordapp.com/banners/${guildId}/${bannerHash}.${ext}?size=1024`
}

export function discordIconCdnUrl(guildId: string, iconHash: string | null | undefined): string | null {
  if (!guildId || !iconHash) return null
  const ext = iconHash.startsWith('a_') ? 'gif' : 'png'
  return `https://cdn.discordapp.com/icons/${guildId}/${iconHash}.${ext}?size=128`
}

export type GuildDirectoryEnrichment = {
  description: string | null
  bannerUrl: string | null
  discordInvite: string | null
}

function normalizeInviteUrl(raw: string): string {
  const t = raw.trim()
  if (!t) return t
  if (t.startsWith('http://') || t.startsWith('https://')) return t
  return `https://discord.gg/${t.replace(/^\/+/, '')}`
}

/**
 * @param oauthBannerHash — optional hash from GET /users/@me/guilds (banner field when present)
 */
export async function enrichDiscordGuildForDirectory(
  guildId: string,
  oauthBannerHash?: string | null,
): Promise<GuildDirectoryEnrichment> {
  const oauthBanner = discordBannerCdnUrl(guildId, oauthBannerHash)

  let description: string | null = null
  let bannerUrl: string | null = oauthBanner
  let discordInvite: string | null = null

  const botToken = Deno.env.get('DISCORD_BOT_TOKEN')?.trim()
  const botHeaders = botToken ? ({ Authorization: `Bot ${botToken}` } as Record<string, string>) : null

  const gid = encodeURIComponent(guildId)

  if (botHeaders) {
    const gr = await fetch(`https://discord.com/api/v10/guilds/${gid}`, { headers: botHeaders })
    if (gr.ok) {
      const g = (await gr.json()) as {
        description?: string | null
        banner?: string | null
        vanity_url_code?: string | null
      }
      if (typeof g.description === 'string' && g.description.trim()) {
        description = g.description.trim()
      }
      const fromApiBanner = discordBannerCdnUrl(guildId, g.banner)
      if (fromApiBanner) bannerUrl = fromApiBanner

      const vanity = typeof g.vanity_url_code === 'string' ? g.vanity_url_code.trim() : ''
      if (vanity) {
        discordInvite = `https://discord.gg/${vanity}`
      }

      if (!discordInvite) {
        const chRes = await fetch(`https://discord.com/api/v10/guilds/${gid}/channels`, { headers: botHeaders })
        if (chRes.ok) {
          const channels = (await chRes.json()) as Array<{ id: string; type: number }>
          const textChannel = channels.find((c) => c.type === 0 || c.type === 5)
          if (textChannel?.id) {
            const invRes = await fetch(`https://discord.com/api/v10/channels/${textChannel.id}/invites`, {
              method: 'POST',
              headers: { ...botHeaders, 'Content-Type': 'application/json' },
              body: JSON.stringify({ max_age: 0, max_uses: 0 }),
            })
            if (invRes.ok) {
              const inv = (await invRes.json()) as { code?: string }
              if (inv?.code) discordInvite = `https://discord.gg/${inv.code}`
            }
          }
        }
      }
    }
  }

  if (!discordInvite) {
    const wr = await fetch(`https://discord.com/api/guilds/${gid}/widget.json`)
    if (wr.ok) {
      const w = (await wr.json()) as { instant_invite?: string | null }
      const inv = w?.instant_invite
      if (typeof inv === 'string' && inv.trim()) {
        discordInvite = normalizeInviteUrl(inv.trim())
      }
    }
  }

  if (!description || !bannerUrl) {
    const pr = await fetch(`https://discord.com/api/v10/guilds/${gid}/preview`)
    if (pr.ok) {
      const pv = (await pr.json()) as {
        description?: string | null
        splash?: string | null
        discovery_splash?: string | null
      }
      if (!description && typeof pv.description === 'string' && pv.description.trim()) {
        description = pv.description.trim()
      }
      if (!bannerUrl && pv.splash) {
        bannerUrl = `https://cdn.discordapp.com/splashes/${guildId}/${pv.splash}.png?size=1024`
      }
      if (!bannerUrl && pv.discovery_splash) {
        bannerUrl = `https://cdn.discordapp.com/discovery-splashes/${guildId}/${pv.discovery_splash}.png?size=1024`
      }
    }
  }

  return { description, bannerUrl, discordInvite }
}
