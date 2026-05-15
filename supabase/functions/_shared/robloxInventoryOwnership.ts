/** Open Cloud inventory checks (game pass id and/or catalog asset id). */

export type InvItem = {
  gamePassDetails?: { gamePassId?: string | number }
  assetDetails?: { assetId?: string | number }
}

export type RobloxInventoryScanResult =
  | { kind: 'owns' }
  | { kind: 'not_owned' }
  | { kind: 'privacy_blocked' }
  | { kind: 'roblox_error'; status: number; snippet: string }

function normalizeListingId(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'number' && Number.isFinite(v)) return String(Math.trunc(v))
  return String(v).trim()
}

export function gamePassIdMatches(it: InvItem, listingId: string): boolean {
  return normalizeListingId(it.gamePassDetails?.gamePassId) === listingId
}

export function assetIdMatches(it: InvItem, listingId: string): boolean {
  return normalizeListingId(it.assetDetails?.assetId) === listingId
}

function classify403(body: string): RobloxInventoryScanResult {
  const low = body.toLowerCase()
  const hiddenHints = [
    'who can see my inventory',
    'inventory visibility',
    'cannot view this user',
    'cannot view this users',
    "user's inventory is hidden",
    'inventory is hidden',
    'not authorized to view this user',
    'unable to view inventory',
  ]
  const keyOrScopeHints = [
    'api key',
    'x-api-key',
    'permission denied',
    'insufficient',
    'scope',
    'credential',
    'invalid key',
    'unauthorized',
    'not allowed to',
  ]
  const looksHidden = hiddenHints.some((h) => low.includes(h))
  const looksKey = keyOrScopeHints.some((h) => low.includes(h))
  if (looksKey && !looksHidden) {
    return { kind: 'roblox_error', status: 403, snippet: body.slice(0, 240) }
  }
  return { kind: 'privacy_blocked' }
}

export async function scanInventoryFilter(params: {
  robloxUserId: number
  filter: string
  apiKey: string
  match: (it: InvItem) => boolean
  /** Max list requests (pages). */
  maxPages?: number
  /** Open Cloud allows up to 100. */
  maxPageSize?: number
}): Promise<RobloxInventoryScanResult> {
  const maxPages = Math.min(60, Math.max(1, params.maxPages ?? 25))
  const maxPageSize = Math.min(100, Math.max(1, params.maxPageSize ?? 100))
  let pageToken: string | undefined
  const userPathId = String(Math.trunc(params.robloxUserId))

  for (let page = 0; page < maxPages; page++) {
    const url = new URL(`https://apis.roblox.com/cloud/v2/users/${userPathId}/inventory-items`)
    url.searchParams.set('maxPageSize', String(maxPageSize))
    url.searchParams.set('filter', params.filter)
    if (pageToken) url.searchParams.set('pageToken', pageToken)

    const inv = await fetch(url.toString(), {
      headers: { 'x-api-key': params.apiKey },
    })

    if (!inv.ok) {
      const t = await inv.text().catch(() => '')
      if (inv.status === 403) {
        return classify403(t)
      }
      return { kind: 'roblox_error', status: inv.status, snippet: t.slice(0, 240) }
    }

    let invJson: { inventoryItems?: InvItem[]; nextPageToken?: string }
    try {
      invJson = (await inv.json()) as typeof invJson
    } catch {
      return { kind: 'roblox_error', status: 502, snippet: 'invalid_json' }
    }

    const items = Array.isArray(invJson.inventoryItems) ? invJson.inventoryItems : []
    for (const it of items) {
      if (params.match(it)) return { kind: 'owns' }
    }

    const next = invJson.nextPageToken?.trim()
    if (!next) break
    pageToken = next
  }

  return { kind: 'not_owned' }
}

/** Listing may be sold as game pass and/or catalog asset — try both filters. */
export async function userOwnsRobloxListing(params: {
  robloxUserId: number
  listingId: string
  apiKey: string
}): Promise<RobloxInventoryScanResult> {
  const id = String(params.listingId).trim()

  const asGamePassFiltered = await scanInventoryFilter({
    robloxUserId: params.robloxUserId,
    filter: `gamePassIds=${id}`,
    apiKey: params.apiKey,
    match: (it) => gamePassIdMatches(it, id),
    maxPageSize: 100,
  })
  if (asGamePassFiltered.kind === 'owns' || asGamePassFiltered.kind === 'privacy_blocked') {
    return asGamePassFiltered
  }

  const tryBroadGamePasses =
    asGamePassFiltered.kind === 'not_owned' ||
    (asGamePassFiltered.kind === 'roblox_error' &&
      (asGamePassFiltered.status === 400 ||
        asGamePassFiltered.status === 404 ||
        asGamePassFiltered.status === 422))

  let asGamePassBroad: RobloxInventoryScanResult | null = null
  if (tryBroadGamePasses) {
    asGamePassBroad = await scanInventoryFilter({
      robloxUserId: params.robloxUserId,
      filter: 'gamePasses=true',
      apiKey: params.apiKey,
      match: (it) => gamePassIdMatches(it, id),
      maxPages: 50,
      maxPageSize: 100,
    })
    if (asGamePassBroad.kind === 'owns' || asGamePassBroad.kind === 'privacy_blocked') {
      return asGamePassBroad
    }
  }

  const asAsset = await scanInventoryFilter({
    robloxUserId: params.robloxUserId,
    filter: `assetIds=${id}`,
    apiKey: params.apiKey,
    match: (it) => assetIdMatches(it, id),
    maxPageSize: 100,
  })
  if (asAsset.kind === 'owns' || asAsset.kind === 'privacy_blocked') return asAsset

  if (asGamePassFiltered.kind === 'roblox_error' && !tryBroadGamePasses) {
    return asGamePassFiltered
  }
  if (tryBroadGamePasses && asGamePassBroad?.kind === 'roblox_error') {
    return asGamePassBroad
  }
  if (asAsset.kind === 'roblox_error') {
    return asAsset
  }

  const dismissFilteredClientError =
    tryBroadGamePasses &&
    asGamePassBroad?.kind === 'not_owned' &&
    asGamePassFiltered.kind === 'roblox_error' &&
    (asGamePassFiltered.status === 400 || asGamePassFiltered.status === 404 || asGamePassFiltered.status === 422)

  if (asGamePassFiltered.kind === 'roblox_error' && !dismissFilteredClientError) {
    return asGamePassFiltered
  }

  return { kind: 'not_owned' }
}
