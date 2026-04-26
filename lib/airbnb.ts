export function extractAirbnbListingId(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  // Only extract from Airbnb URLs
  const urlMatch = trimmed.match(/^https?:\/\/(?:www\.)?airbnb\.[a-z.]+\/rooms\/(\d+)/)
  if (urlMatch) return urlMatch[1]
  // Bare numeric string — treat as a listing ID directly
  if (/^\d+$/.test(trimmed)) return trimmed
  return null
}

export function buildAirbnbUrl(
  listingId: string,
  params?: { checkIn?: string; checkOut?: string; guests?: number },
): string {
  const url = new URL(`https://www.airbnb.com/rooms/${listingId}`)
  if (params?.checkIn) url.searchParams.set('check_in', params.checkIn)
  if (params?.checkOut) url.searchParams.set('check_out', params.checkOut)
  if (params?.guests && params.guests > 0) {
    url.searchParams.set('guests', String(params.guests))
    url.searchParams.set('adults', String(params.guests))
  }
  return url.toString()
}
