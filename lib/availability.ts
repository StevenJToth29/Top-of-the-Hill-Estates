import { createServiceRoleClient } from '@/lib/supabase'
import { addDays, eachDayOfInterval, format, parseISO } from 'date-fns'

function addDateRangeToSet(
  set: Set<string>,
  startIso: string,
  endIso: string,
): void {
  const days = eachDayOfInterval({
    start: parseISO(startIso),
    end: addDays(parseISO(endIso), -1),
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
        .gt('check_out', startDate),
      supabase
        .from('ical_blocks')
        .select('start_date, end_date')
        .eq('room_id', roomId)
        .lt('start_date', endDate)
        .gt('end_date', startDate),
    ])

  if (bookingsError) console.error('Error fetching bookings for availability:', bookingsError)
  if (icalError) console.error('Error fetching iCal blocks for availability:', icalError)

  const blocked = new Set<string>()
  for (const booking of bookings ?? []) addDateRangeToSet(blocked, booking.check_in, booking.check_out)
  for (const block of icalBlocks ?? []) addDateRangeToSet(blocked, block.start_date, block.end_date)

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

  return eachDayOfInterval({
    start: parseISO(checkIn),
    end: addDays(parseISO(checkOut), -1),
  }).every((day) => !blocked.has(format(day, 'yyyy-MM-dd')))
}
