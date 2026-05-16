/**
 * Pro server owners: customizable Discord review webhook message + embed templates.
 * Shared by the server-review-notify Edge Function and the web app (relative import).
 */

export const OWNER_REVIEW_EMBED_PLACEHOLDERS_CHEAT_SHEET = `Placeholders (type braces exactly):

• {server_name} · {server_url} · {reviews_url}
• {intro} — long or short listing blurb (sanitized)
• {bullets} — stat lines (avg rating, member count, verified, hiring, etc.)
• {review_snippet} — review text or “no comment”
• {review_about} — optional “review about …” suffix (may be empty)
• {reviewer_lead} — Discord ping or bold name, with trailing space
• {reviewer_name}
• {avg_rating} · {review_count} · {review_stars} · {review_rating}
• {member_count} · {staff_count}`

export const DEFAULT_ACTIVITY_TEMPLATE =
  `{reviewer_lead}left a **{review_rating}/5** review on **{server_name}** on **ERLC Directory.**`

export const DEFAULT_AUTHOR_NAME_TEMPLATE = `ERLC Directory`

export const DEFAULT_TITLE_TEMPLATE = `{server_name} | ERLC Directory`

export const DEFAULT_DESCRIPTION_TEMPLATE = `{intro}

{bullets}

**Latest review**
{review_snippet}{review_about}`

export const DEFAULT_BUTTON_VIEW_SERVER = `View server`
export const DEFAULT_BUTTON_WRITE_REVIEW = `Write a review`

export type OwnerReviewEmbedConfig = {
  enabled: boolean
  activity_template: string
  author_name_template: string
  title_template: string
  description_template: string
  webhook_username: string | null
  webhook_avatar_url: string | null
  show_thumbnail: boolean
  show_banner_image: boolean
  show_buttons: boolean
  button_view_server: string | null
  button_write_review: string | null
}

const MAX_JSON_BYTES = 16_384

const LIMITS = {
  activity: 2000,
  author_name: 256,
  title: 256,
  description: 4096,
  webhook_username: 80,
  webhook_avatar_url: 2048,
  button_label: 80,
} as const

export type ReviewEmbedPlaceholderInput = {
  serverName: string
  serverPageUrl: string
  reviewsUrl: string
  intro: string
  bullets: string
  reviewSnippet: string
  reviewAbout: string
  reviewerLead: string
  reviewerName: string
  avgDisplay: string
  reviewCount: string
  stars: string
  rating: number
  memberStr: string
  staffStr: string
}

export function buildPlaceholderContext(i: ReviewEmbedPlaceholderInput): Record<string, string> {
  return {
    server_name: i.serverName,
    server_url: i.serverPageUrl,
    reviews_url: i.reviewsUrl,
    intro: i.intro,
    bullets: i.bullets,
    review_snippet: i.reviewSnippet,
    review_about: i.reviewAbout,
    reviewer_lead: i.reviewerLead,
    reviewer_name: i.reviewerName,
    avg_rating: i.avgDisplay,
    review_count: i.reviewCount,
    review_stars: i.stars,
    review_rating: String(i.rating),
    member_count: i.memberStr,
    staff_count: i.staffStr,
  }
}

export function applyReviewEmbedPlaceholders(template: string, ctx: Record<string, string>): string {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key: string) => ctx[key] ?? '')
}

export function clampDiscordUtf16(s: string, max: number): string {
  if (s.length <= max) return s
  return s.slice(0, max)
}

function trimStr(v: unknown, max: number): string {
  if (v == null || typeof v !== 'string') return ''
  return v.trim().slice(0, max)
}

function optHttpsUrl(v: unknown, max: number): string | null {
  const t = trimStr(v, max)
  if (!t.startsWith('https://')) return null
  return t || null
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback
}

/** Parse JSON from DB / client; returns null if disabled or invalid. */
export function parseOwnerReviewEmbedConfig(raw: unknown): OwnerReviewEmbedConfig | null {
  if (raw == null) return null
  if (typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  if (!bool(o.enabled, false)) return null

  const cfg: OwnerReviewEmbedConfig = {
    enabled: true,
    activity_template: trimStr(o.activity_template, LIMITS.activity) || DEFAULT_ACTIVITY_TEMPLATE,
    author_name_template: trimStr(o.author_name_template, LIMITS.author_name) || DEFAULT_AUTHOR_NAME_TEMPLATE,
    title_template: trimStr(o.title_template, LIMITS.title) || DEFAULT_TITLE_TEMPLATE,
    description_template: trimStr(o.description_template, LIMITS.description) || DEFAULT_DESCRIPTION_TEMPLATE,
    webhook_username: (() => {
      const u = trimStr(o.webhook_username, LIMITS.webhook_username)
      return u ? u : null
    })(),
    webhook_avatar_url: optHttpsUrl(o.webhook_avatar_url, LIMITS.webhook_avatar_url),
    show_thumbnail: bool(o.show_thumbnail, true),
    show_banner_image: bool(o.show_banner_image, true),
    show_buttons: bool(o.show_buttons, true),
    button_view_server: (() => {
      const b = trimStr(o.button_view_server, LIMITS.button_label)
      return b ? b : null
    })(),
    button_write_review: (() => {
      const b = trimStr(o.button_write_review, LIMITS.button_label)
      return b ? b : null
    })(),
  }
  return cfg
}

export function ownerReviewEmbedConfigJsonSizeOk(raw: unknown): boolean {
  try {
    const s = JSON.stringify(raw ?? null)
    return new TextEncoder().encode(s).byteLength <= MAX_JSON_BYTES
  } catch {
    return false
  }
}

export function defaultOwnerReviewEmbedConfig(): OwnerReviewEmbedConfig {
  return {
    enabled: true,
    activity_template: DEFAULT_ACTIVITY_TEMPLATE,
    author_name_template: DEFAULT_AUTHOR_NAME_TEMPLATE,
    title_template: DEFAULT_TITLE_TEMPLATE,
    description_template: DEFAULT_DESCRIPTION_TEMPLATE,
    webhook_username: null,
    webhook_avatar_url: null,
    show_thumbnail: true,
    show_banner_image: true,
    show_buttons: true,
    button_view_server: null,
    button_write_review: null,
  }
}

/** Serialize for DB PATCH (omit defaults footprint optional — store full object). */
export function serializeOwnerReviewEmbedConfig(cfg: OwnerReviewEmbedConfig): Record<string, unknown> {
  return {
    enabled: cfg.enabled,
    activity_template: cfg.activity_template,
    author_name_template: cfg.author_name_template,
    title_template: cfg.title_template,
    description_template: cfg.description_template,
    webhook_username: cfg.webhook_username,
    webhook_avatar_url: cfg.webhook_avatar_url,
    show_thumbnail: cfg.show_thumbnail,
    show_banner_image: cfg.show_banner_image,
    show_buttons: cfg.show_buttons,
    button_view_server: cfg.button_view_server,
    button_write_review: cfg.button_write_review,
  }
}
