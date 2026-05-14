/** Open Cloud inventory checks (game pass id and/or catalog asset id). */

export type InvItem = {
  gamePassDetails?: { gamePassId?: string }
  assetDetails?: { assetId?: string }
}

export type RobloxInventoryScanResult =
  | { kind: 'owns' }
  | { kind: 'not_owned' }
  | { kind: 'privacy_blocked' }
  | { kind: 'roblox_error'; status: number; snippet: string }

export async function scanInventoryFilter(params: {
  robloxUserId: number
  filter: string
  apiKey: string
  match: (it: InvItem) => boolean
}): Promise<RobloxInventoryScanResult> {
  let pageToken: string | undefined

  for (let page = 0; page < 25; page++) {
    const url = new URL(`https://apis.roblox.com/cloud/v2/users/${params.robloxUserId}/inventory-items`)
    url.searchParams.set('maxPageSize', '50')
    url.searchParams.set('filter', params.filter)
    if (pageToken) url.searchParams.set('pageToken', pageToken)

    const inv = await fetch(url.toString(), {
      headers: { 'x-api-key': params.apiKey },
    })

    if (inv.status === 403) {
      return { kind: 'privacy_blocked' }
    }

    if (!inv.ok) {
      const t = await inv.text().catch(() => '')
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

  const asGamePass = await scanInventoryFilter({
    robloxUserId: params.robloxUserId,
    filter: `gamePassIds=${id}`,
    apiKey: params.apiKey,
    match: (it) => String(it.gamePassDetails?.gamePassId ?? '') === id,
  })
  if (asGamePass.kind === 'owns' || asGamePass.kind === 'privacy_blocked') return asGamePass

  const asAsset = await scanInventoryFilter({
    robloxUserId: params.robloxUserId,
    filter: `assetIds=${id}`,
    apiKey: params.apiKey,
    match: (it) => String(it.assetDetails?.assetId ?? '') === id,
  })
  if (asAsset.kind === 'owns' || asAsset.kind === 'privacy_blocked') return asAsset

  if (asGamePass.kind === 'roblox_error' && asGamePass.status !== 400) return asGamePass
  if (asAsset.kind === 'roblox_error') return asAsset
  if (asGamePass.kind === 'roblox_error') return asGamePass

  return { kind: 'not_owned' }
}
