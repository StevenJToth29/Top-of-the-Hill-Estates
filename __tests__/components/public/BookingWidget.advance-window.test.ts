/** @jest-environment node */
/**
 * Tests for the advance booking window logic in BookingWidget.
 *
 * The window end date and blocked state are computed from:
 *   - max_advance_booking_days  (null → no limit; 0 → blocks all; N → today + N days)
 *   - max_advance_booking_applies_to ('both' | 'short_term' | 'long_term')
 *
 * These functions mirror the useMemo logic in BookingWidget.tsx.
 */

import { format, addDays, startOfDay } from 'date-fns'

type BookingType = 'short_term' | 'long_term'
type AppliesTo = 'both' | 'short_term' | 'long_term'

function computeWindowEnd(
  maxDays: number | null | undefined,
  appliesTo: AppliesTo | undefined,
  bookingType: BookingType,
  todayDate: Date,
): string | undefined {
  const applies = appliesTo ?? 'both'
  if (bookingType === 'short_term' && applies === 'long_term') return undefined
  if (bookingType === 'long_term' && applies === 'short_term') return undefined
  if (maxDays == null) return undefined
  if (maxDays === 0) return format(addDays(todayDate, -1), 'yyyy-MM-dd')
  return format(addDays(todayDate, maxDays), 'yyyy-MM-dd')
}

function isWindowBlocked(windowEnd: string | undefined, today: string): boolean {
  return windowEnd !== undefined && windowEnd < today
}

const TODAY = startOfDay(new Date())
const TODAY_STR = format(TODAY, 'yyyy-MM-dd')

describe('computeWindowEnd — short_term bookings', () => {
  it('returns undefined when max_advance_booking_days is null (no limit)', () => {
    expect(computeWindowEnd(null, 'both', 'short_term', TODAY)).toBeUndefined()
  })

  it('returns undefined when max_advance_booking_days is undefined', () => {
    expect(computeWindowEnd(undefined, 'both', 'short_term', TODAY)).toBeUndefined()
  })

  it('returns undefined when applies_to is "long_term" (short_term not restricted)', () => {
    expect(computeWindowEnd(90, 'long_term', 'short_term', TODAY)).toBeUndefined()
  })

  it('returns today + N days when days > 0 and applies_to is "both"', () => {
    const expected = format(addDays(TODAY, 90), 'yyyy-MM-dd')
    expect(computeWindowEnd(90, 'both', 'short_term', TODAY)).toBe(expected)
  })

  it('returns today + N days when applies_to is "short_term"', () => {
    const expected = format(addDays(TODAY, 30), 'yyyy-MM-dd')
    expect(computeWindowEnd(30, 'short_term', 'short_term', TODAY)).toBe(expected)
  })

  it('returns yesterday when days = 0 (blocks all short_term advance bookings)', () => {
    const yesterday = format(addDays(TODAY, -1), 'yyyy-MM-dd')
    expect(computeWindowEnd(0, 'both', 'short_term', TODAY)).toBe(yesterday)
  })

  it('returns yesterday when days = 0 and applies_to is "short_term"', () => {
    const yesterday = format(addDays(TODAY, -1), 'yyyy-MM-dd')
    expect(computeWindowEnd(0, 'short_term', 'short_term', TODAY)).toBe(yesterday)
  })
})

describe('computeWindowEnd — long_term bookings', () => {
  it('returns undefined when max_advance_booking_days is null (no limit)', () => {
    expect(computeWindowEnd(null, 'both', 'long_term', TODAY)).toBeUndefined()
  })

  it('returns undefined when applies_to is "short_term" (long_term not restricted)', () => {
    expect(computeWindowEnd(90, 'short_term', 'long_term', TODAY)).toBeUndefined()
  })

  it('returns today + N days when applies_to is "both"', () => {
    const expected = format(addDays(TODAY, 180), 'yyyy-MM-dd')
    expect(computeWindowEnd(180, 'both', 'long_term', TODAY)).toBe(expected)
  })

  it('returns today + N days when applies_to is "long_term"', () => {
    const expected = format(addDays(TODAY, 60), 'yyyy-MM-dd')
    expect(computeWindowEnd(60, 'long_term', 'long_term', TODAY)).toBe(expected)
  })

  it('returns yesterday when days = 0 (blocks all long_term advance bookings)', () => {
    const yesterday = format(addDays(TODAY, -1), 'yyyy-MM-dd')
    expect(computeWindowEnd(0, 'both', 'long_term', TODAY)).toBe(yesterday)
  })
})

describe('isWindowBlocked', () => {
  it('returns false when windowEnd is undefined (no limit set)', () => {
    expect(isWindowBlocked(undefined, TODAY_STR)).toBe(false)
  })

  it('returns false when windowEnd is in the future', () => {
    const future = format(addDays(TODAY, 30), 'yyyy-MM-dd')
    expect(isWindowBlocked(future, TODAY_STR)).toBe(false)
  })

  it('returns false when windowEnd equals today (same-day booking still allowed)', () => {
    expect(isWindowBlocked(TODAY_STR, TODAY_STR)).toBe(false)
  })

  it('returns true when windowEnd is yesterday (days=0 case — all bookings blocked)', () => {
    const yesterday = format(addDays(TODAY, -1), 'yyyy-MM-dd')
    expect(isWindowBlocked(yesterday, TODAY_STR)).toBe(true)
  })

  it('returns true when windowEnd is in the past', () => {
    const past = format(addDays(TODAY, -10), 'yyyy-MM-dd')
    expect(isWindowBlocked(past, TODAY_STR)).toBe(true)
  })
})

describe('combined: window blocked state for each booking type', () => {
  it('blocks short_term but not long_term when applies_to="short_term" and days=0', () => {
    const stEnd = computeWindowEnd(0, 'short_term', 'short_term', TODAY)
    const ltEnd = computeWindowEnd(0, 'short_term', 'long_term', TODAY)

    expect(isWindowBlocked(stEnd, TODAY_STR)).toBe(true)
    expect(isWindowBlocked(ltEnd, TODAY_STR)).toBe(false)
  })

  it('blocks long_term but not short_term when applies_to="long_term" and days=0', () => {
    const stEnd = computeWindowEnd(0, 'long_term', 'short_term', TODAY)
    const ltEnd = computeWindowEnd(0, 'long_term', 'long_term', TODAY)

    expect(isWindowBlocked(stEnd, TODAY_STR)).toBe(false)
    expect(isWindowBlocked(ltEnd, TODAY_STR)).toBe(true)
  })

  it('blocks both when applies_to="both" and days=0', () => {
    const stEnd = computeWindowEnd(0, 'both', 'short_term', TODAY)
    const ltEnd = computeWindowEnd(0, 'both', 'long_term', TODAY)

    expect(isWindowBlocked(stEnd, TODAY_STR)).toBe(true)
    expect(isWindowBlocked(ltEnd, TODAY_STR)).toBe(true)
  })

  it('blocks neither when max_advance_booking_days is null', () => {
    const stEnd = computeWindowEnd(null, 'both', 'short_term', TODAY)
    const ltEnd = computeWindowEnd(null, 'both', 'long_term', TODAY)

    expect(isWindowBlocked(stEnd, TODAY_STR)).toBe(false)
    expect(isWindowBlocked(ltEnd, TODAY_STR)).toBe(false)
  })
})
