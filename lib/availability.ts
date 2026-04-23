import { createServiceRoleClient } from '@/lib/supabase'
import { addDays } from 'date-fns/addDays'
import { eachDayOfInterval } from 'date-fns/eachDayOfInterval'
import { format } from 'date-fns/format'
import { parseISO } from 'date-fns/parseISO'
import { OPEN_ENDED_DATE } from '@/lib/format'

function addDateRangeToSet(
  set: Set<string>,
  startIso: string,
  endIso: string,
  capIso?: string,
): void {
  // Cap open-ended bookings to avoid generating an enormous date range.
  const effectiveEnd = endIso === OPEN_ENDED_DATE ? (capIso ?? endIso) : endIso
  // Checkout day is exclusive — it's the first available day for the next guest.
  const days = eachDayOfInterval({
    start: parseISO(startIso),
    end: addDays(parseISO(effectiveEnd), -1),
  })
  for (const day of days) {
    set.add(format(day, 'yyyy-MM-dd'))
  }
}

/**
 * Returns an array of ISO date strings (YYYY-MM-DD) that are blocked
 * for a given room within the specified date range.
 *
 * Blocked dates come from confirmed/pending bookings and iCal blocks.
 */
export async function getBlockedDatesForRoom(
  roomId: string,
  startDate: string,
  endDate: string,
): Promise<string[]> {
  const supabase = createServiceRoleClient()

  const [{ data: bookings, error: bookingsError }, { data: icalBlocks, error: icalError }] =
    await Promise.all([
      supabase
        .from('bookings')
        .select('check_in, check_out')
        .eq('room_id', roomId)
        .in('status', ['confirmed', 'pending'])
        .lt('check_in', endDate)
        .gte('check_out', startDate),
      supabase
        .from('ical_blocks')
        .select('start_date, end_date')
        .eq('room_id', roomId)
        .lt('start_date', endDate)
        .gte('end_date', startDate),
    ])

  if (bookingsError) console.error('Error fetching bookings for availability:', bookingsError)
  if (icalError) console.error('Error fetching iCal blocks for availability:', icalError)

  const blocked = new Set<string>()
  for (const booking of bookings ?? []) addDateRangeToSet(blocked, booking.check_in, booking.check_out, endDate)
  for (const block of icalBlocks ?? []) addDateRangeToSet(blocked, block.start_date, block.end_date, endDate)

  return Array.from(blocked).sort()
}

/**
 * Returns true if ALL dates in the check-in to check-out range are available.
 */
export async function isRoomAvailable(
  roomId: string,
  checkIn: string,
  checkOut: string,
): Promise<boolean> {
  const blocked = new Set(await getBlockedDatesForRoom(roomId, checkIn, checkOut))
  if (blocked.size === 0) return true

  const checkOutCapped =
    checkOut >= OPEN_ENDED_DATE
      ? (() => {
          const cap = new Date()
          cap.setUTCDate(cap.getUTCDate() + 730)
          return cap.toISOString().split('T')[0]
        })()
      : checkOut

  return eachDayOfInterval({
    start: parseISO(checkIn),
    end: addDays(parseISO(checkOutCapped), -1),
  }).every((day) => !blocked.has(format(day, 'yyyy-MM-dd')))
}

/**
 * Batch version of isRoomAvailable. Fetches all bookings and iCal blocks for
 * every room in a single pair of queries instead of 2 queries per room.
 * Returns the subset of roomIds that are fully available for the date range.
 */
export async function getAvailableRoomIds(
  roomIds: string[],
  checkIn: string,
  checkOut: string,
): Promise<Set<string>> {
  if (roomIds.length === 0) return new Set()

  const supabase = createServiceRoleClient()

  const [{ data: bookings }, { data: icalBlocks }] = await Promise.all([
    supabase
      .from('bookings')
      .select('room_id, check_in, check_out')
      .in('room_id', roomIds)
      .in('status', ['confirmed', 'pending'])
      .lt('check_in', checkOut)
      .gte('check_out', checkIn),
    supabase
      .from('ical_blocks')
      .select('room_id, start_date, end_date')
      .in('room_id', roomIds)
      .lt('start_date', checkOut)
      .gte('end_date', checkIn),
  ])

  // Build per-room blocked-date sets
  const blockedByRoom = new Map<string, Set<string>>()
  for (const id of roomIds) blockedByRoom.set(id, new Set())

  for (const b of bookings ?? []) {
    const set = blockedByRoom.get(b.room_id)!
    addDateRangeToSet(set, b.check_in, b.check_out, checkOut)
  }
  for (const b of icalBlocks ?? []) {
    const set = blockedByRoom.get(b.room_id)!
    addDateRangeToSet(set, b.start_date, b.end_date, checkOut)
  }

  const requestedDays = eachDayOfInterval({
    start: parseISO(checkIn),
    end: addDays(parseISO(checkOut), -1),
  }).map((day) => format(day, 'yyyy-MM-dd'))

  const available = new Set<string>()
  for (const id of roomIds) {
    const blocked = blockedByRoom.get(id)!
    if (requestedDays.every((day) => !blocked.has(day))) available.add(id)
  }
  return available
}

/**
 * Same as isRoomAvailable but excludes one booking from the blocked set.
 * Use this when checking availability for a modification of an existing booking
 * so the guest's own dates are not counted as blocked.
 */
export async function isRoomAvailableExcluding(
  roomId: string,
  checkIn: string,
  checkOut: string,
  excludeBookingId: string,
): Promise<boolean> {
  const supabase = createServiceRoleClient()

  const [{ data: bookings, error: bookingsError }, { data: icalBlocks, error: icalError }] =
    await Promise.all([
      supabase
        .from('bookings')
        .select('check_in, check_out')
        .eq('room_id', roomId)
        .in('status', ['confirmed', 'pending'])
        .neq('id', excludeBookingId)
        .lt('check_in', checkOut)
        .gte('check_out', checkIn),
      supabase
        .from('ical_blocks')
        .select('start_date, end_date')
        .eq('room_id', roomId)
        .lt('start_date', checkOut)
        .gte('end_date', checkIn),
    ])

  if (bookingsError) console.error('Error fetching bookings for availability:', bookingsError)
  if (icalError) console.error('Error fetching iCal blocks for availability:', icalError)

  const blocked = new Set<string>()
  for (const booking of bookings ?? []) addDateRangeToSet(blocked, booking.check_in, booking.check_out, checkOut)
  for (const block of icalBlocks ?? []) addDateRangeToSet(blocked, block.start_date, block.end_date, checkOut)

  if (blocked.size === 0) return true

  const checkOutCapped =
    checkOut >= OPEN_ENDED_DATE
      ? (() => {
          const cap = new Date()
          cap.setUTCDate(cap.getUTCDate() + 730)
          return cap.toISOString().split('T')[0]
        })()
      : checkOut

  return eachDayOfInterval({
    start: parseISO(checkIn),
    end: addDays(parseISO(checkOutCapped), -1),
  }).every((day) => !blocked.has(format(day, 'yyyy-MM-dd')))
}
