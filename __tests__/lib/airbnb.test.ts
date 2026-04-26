import { extractAirbnbListingId, buildAirbnbUrl } from '@/lib/airbnb'

describe('extractAirbnbListingId', () => {
  it('extracts ID from a full Airbnb URL with query params', () => {
    expect(
      extractAirbnbListingId('https://www.airbnb.com/rooms/1234804626518653126?check_in=2026-04-26&guests=2')
    ).toBe('1234804626518653126')
  })

  it('extracts ID from a bare Airbnb URL', () => {
    expect(extractAirbnbListingId('https://www.airbnb.com/rooms/9876543210')).toBe('9876543210')
  })

  it('returns a bare numeric string as-is', () => {
    expect(extractAirbnbListingId('1234804626518653126')).toBe('1234804626518653126')
  })

  it('returns null for an empty string', () => {
    expect(extractAirbnbListingId('')).toBeNull()
  })

  it('returns null for whitespace-only input', () => {
    expect(extractAirbnbListingId('   ')).toBeNull()
  })

  it('returns null for a non-Airbnb URL', () => {
    expect(extractAirbnbListingId('https://www.vrbo.com/rooms/123')).toBeNull()
  })

  it('returns null for a non-numeric string', () => {
    expect(extractAirbnbListingId('not-a-listing')).toBeNull()
  })

  it('trims whitespace before parsing', () => {
    expect(extractAirbnbListingId('  1234804626518653126  ')).toBe('1234804626518653126')
  })
})

describe('buildAirbnbUrl', () => {
  it('builds a bare listing URL when no params given', () => {
    expect(buildAirbnbUrl('12345')).toBe('https://www.airbnb.com/rooms/12345')
  })

  it('includes check_in and check_out when provided', () => {
    const url = buildAirbnbUrl('12345', { checkIn: '2026-04-26', checkOut: '2026-04-29' })
    expect(url).toContain('check_in=2026-04-26')
    expect(url).toContain('check_out=2026-04-29')
  })

  it('includes guests and adults when guests provided', () => {
    const url = buildAirbnbUrl('12345', { guests: 2 })
    expect(url).toContain('guests=2')
    expect(url).toContain('adults=2')
  })

  it('omits date params when only guests provided', () => {
    const url = buildAirbnbUrl('12345', { guests: 1 })
    expect(url).not.toContain('check_in')
    expect(url).not.toContain('check_out')
  })

  it('omits guest params when guests is 0 or undefined', () => {
    const url = buildAirbnbUrl('12345', { checkIn: '2026-04-26', checkOut: '2026-04-29', guests: 0 })
    expect(url).not.toContain('guests')
    expect(url).not.toContain('adults')
  })

  it('handles only checkIn with no checkout (long-term move-in)', () => {
    const url = buildAirbnbUrl('12345', { checkIn: '2026-05-01', guests: 2 })
    expect(url).toContain('check_in=2026-05-01')
    expect(url).not.toContain('check_out')
    expect(url).toContain('guests=2')
  })
})
