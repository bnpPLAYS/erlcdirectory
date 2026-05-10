/**
 * Resolve Discord CDN URLs and fetch guild metadata for directory `servers` rows.
 *
 * Priority for metadata (description / banner / vanity invite):
 * 1) OAuth user Bearer (verifier just approved — works even if bot is not in the guild)
 * 2) Bot token (if configured and bot is in the guild)
 * 3) Guild preview (discoverable communities)
 * Invite fallback: bot-created invite → server widget `instant_invite`
 */

export function discordBannerCdnUrl(guildId: string, bannerHash: string | null | undefined): string | null {
  if (!guildId || !bannerHash) return null
  const ext = String(bannerHash).startsWith('a_') ? 'gif' : 'png'
  return `https://cdn.discordapp.com/banners/${guildId}/${bannerHash}.${ext}?size=1024`
}

export function discordIconCdnUrl(guildId: string, iconHash: string | null | undefined): string | null {
  if (!guildId || !iconHash) return null
  const ext = String(iconHash).startsWith('a_') ? 'gif' : 'png'
  return `https://cdn.discordapp.com/icons/${guildId}/${iconHash}.${ext}?size=128`
}

export type GuildDirectoryEnrichment = {
  description: string | null
  bannerUrl: string | null
  discordInvite: string | null
}

export type EnrichGuildOptions = {
  /** From Discord OAuth token exchange — enables GET /guilds/{id} without bot in server */
  userAccessToken?: string | null
}

function normalizeInviteUrl(raw: string): string {
  const t = raw.trim()
  if (!t) return t
  if (t.startsWith('http://') || t.startsWith('https://')) return t
  return `https://discord.gg/${t.replace(/^\/+/, '')}`
}

function patchFromGuildJson(
  guildId: string,
  g: Record<string, unknown>,
  into: GuildDirectoryEnrichment,
): void {
  const desc = g.description
  if (!into.description && typeof desc === 'string' && desc.trim()) {
    into.description = desc.trim()
  }
  const ban = g.banner
  if (!into.bannerUrl && ban != null && String(ban).length > 0) {
    const u = discordBannerCdnUrl(guildId, String(ban))
    if (u) into.bannerUrl = u
  }
  const vanity = g.vanity_url_code
  if (!into.discordInvite && typeof vanity === 'string' && vanity.trim()) {
    into.discordInvite = `https://discord.gg/${vanity.trim()}`
  }
}

export async function enrichDiscordGuildForDirectory(
  guildId: string,
  oauthBannerHash?: string | null,
  options?: EnrichGuildOptions,
): Promise<GuildDirectoryEnrichment> {
  const oauthBanner = discordBannerCdnUrl(guildId, oauthBannerHash)

  const out: GuildDirectoryEnrichment = {
    description: null,
    bannerUrl: oauthBanner,
    discordInvite: null,
  }

  const gid = encodeURIComponent(guildId)
  const userToken = options?.userAccessToken?.trim()

  // 1) User OAuth — Discord returns full guild for members (guilds scope)
  if (userToken) {
    const ur = await fetch(`https://discord.com/api/v10/guilds/${gid}`, {
      headers: { Authorization: `Bearer ${userToken}` },
    })
    if (ur.ok) {
      try {
        patchFromGuildJson(guildId, (await ur.json()) as Record<string, unknown>, out)
      } catch {
        /* ignore JSON errors */
      }
    }
  }

  const botToken = Deno.env.get('DISCORD_BOT_TOKEN')?.trim()
  const botHeaders = botToken ? ({ Authorization: `Bot ${botToken}` } as Record<string, string>) : null

  // 2) Bot — fills gaps when user call failed or bot has richer data
  if (botHeaders) {
    const gr = await fetch(`https://discord.com/api/v10/guilds/${gid}`, { headers: botHeaders })
    if (gr.ok) {
      try {
        patchFromGuildJson(guildId, (await gr.json()) as Record<string, unknown>, out)
      } catch {
        /* ignore */
      }
    }

    // Prefer an existing invite (no new invite spam) — needs MANAGE_GUILD on the bot.
    if (!out.discordInvite) {
      const invListRes = await fetch(`https://discord.com/api/v10/guilds/${gid}/invites`, { headers: botHeaders })
      if (invListRes.ok) {
        try {
          const list = (await invListRes.json()) as Array<{
            code?: string
            max_age?: number
            expires_at?: string | null
          }>
          const withCode = list.filter((i) => typeof i.code === 'string' && i.code.length > 0)
          if (withCode.length) {
            const neverExpires = withCode.filter((i) => i.max_age === 0 && !i.expires_at)
            const pool = neverExpires.length ? neverExpires : withCode
            const pick = [...pool].sort((a, b) => {
              const ae = a.expires_at ? new Date(a.expires_at).getTime() : Number.POSITIVE_INFINITY
              const be = b.expires_at ? new Date(b.expires_at).getTime() : Number.POSITIVE_INFINITY
              return be - ae
            })[0]
            if (pick?.code) out.discordInvite = `https://discord.gg/${pick.code}`
          }
        } catch {
          /* ignore */
        }
      }
    }

    if (!out.discordInvite) {
      const chRes = await fetch(`https://discord.com/api/v10/guilds/${gid}/channels`, { headers: botHeaders })
      if (chRes.ok) {
        try {
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
              if (inv?.code) out.discordInvite = `https://discord.gg/${inv.code}`
            }
          }
        } catch {
          /* ignore */
        }
      }
    }
  }

  if (!out.discordInvite) {
    const wr = await fetch(`https://discord.com/api/v10/guilds/${gid}/widget.json`)
    if (wr.ok) {
      try {
        const w = (await wr.json()) as { instant_invite?: string | null }
        const inv = w?.instant_invite
        if (typeof inv === 'string' && inv.trim()) {
          out.discordInvite = normalizeInviteUrl(inv.trim())
        }
      } catch {
        /* ignore */
      }
    }
  }

  if (!out.description || !out.bannerUrl) {
    const pr = await fetch(`https://discord.com/api/v10/guilds/${gid}/preview`)
    if (pr.ok) {
      try {
        const pv = (await pr.json()) as {
          description?: string | null
          splash?: string | null
          discovery_splash?: string | null
        }
        if (!out.description && typeof pv.description === 'string' && pv.description.trim()) {
          out.description = pv.description.trim()
        }
        if (!out.bannerUrl && pv.splash) {
          out.bannerUrl = `https://cdn.discordapp.com/splashes/${guildId}/${pv.splash}.png?size=1024`
        }
        if (!out.bannerUrl && pv.discovery_splash) {
          out.bannerUrl = `https://cdn.discordapp.com/discovery-splashes/${guildId}/${pv.discovery_splash}.png?size=1024`
        }
      } catch {
        /* ignore */
      }
    }
  }

  return out
}
