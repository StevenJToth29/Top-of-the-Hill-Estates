'use client'

import { useState } from 'react'
import {
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  parseISO,
  isToday,
  isWithinInterval,
} from 'date-fns'
import clsx from 'clsx'
import type { Room, Property, Booking, ICalBlock } from '@/types'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'

interface RoomsCalendarProps {
  rooms: Array<Room & { property: Property }>
  bookings: Booking[]
  icalBlocks: ICalBlock[]
}

type DayStatus = 'available' | 'booking' | 'ical'

interface DayInfo {
  status: DayStatus
  tooltip: string
  /** First letter of guest last name, populated for booking cells */
  initial?: string
}

function getDayInfo(
  dateStr: string,
  roomId: string,
  bookings: Booking[],
  icalBlocks: ICalBlock[],
): DayInfo {
  const date = parseISO(dateStr)

  for (const booking of bookings) {
    if (booking.room_id !== roomId) continue
    try {
      if (
        isWithinInterval(date, {
          start: parseISO(booking.check_in),
          end: parseISO(booking.check_out),
        })
      ) {
        return {
          status: 'booking',
          tooltip: `${booking.guest_first_name} ${booking.guest_last_name} (${booking.check_in} – ${booking.check_out}) [${booking.status}]`,
          initial: (booking.guest_last_name[0] ?? '').toUpperCase(),
        }
      }
    } catch {
      // ignore malformed ISO dates from external sources
    }
  }

  for (const block of icalBlocks) {
    if (block.room_id !== roomId) continue
    try {
      if (
        isWithinInterval(date, {
          start: parseISO(block.start_date),
          end: parseISO(block.end_date),
        })
      ) {
        return {
          status: 'ical',
          tooltip: `${block.platform}: ${block.summary} (${block.start_date} – ${block.end_date})`,
        }
      }
    } catch {
      // ignore malformed ISO dates from external sources
    }
  }

  return { status: 'available', tooltip: 'Available' }
}

export default function RoomsCalendar({ rooms, bookings, icalBlocks }: RoomsCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()))

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(addMonths(currentMonth, 1)),
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between px-1">
        <button
          onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
          className="p-1.5 rounded-lg bg-surface-highest/40 hover:bg-surface-high text-primary transition-colors"
          aria-label="Previous month"
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </button>

        <span className="font-display text-sm font-semibold text-primary">
          {format(currentMonth, 'MMMM yyyy')}
          {' – '}
          {format(addMonths(currentMonth, 1), 'MMMM yyyy')}
        </span>

        <button
          onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
          className="p-1.5 rounded-lg bg-surface-highest/40 hover:bg-surface-high text-primary transition-colors"
          aria-label="Next month"
        >
          <ChevronRightIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="overflow-x-auto overflow-y-auto max-h-[70vh] rounded-2xl border border-outline-variant">
        <table className="border-collapse table-fixed min-w-max">
          <thead>
            <tr>
              <th
                className="sticky left-0 z-20 bg-surface-container px-3 py-2 text-left text-xs font-semibold text-on-surface-variant border-b border-r border-outline-variant min-w-[140px] max-w-[160px]"
              >
                Room
              </th>

              {days.map((day) => {
                const today = isToday(day)
                const isFirstOfMonth = day.getDate() === 1
                return (
                  <th
                    key={format(day, 'yyyy-MM-dd')}
                    className={clsx(
                      'sticky top-0 z-10 bg-surface-container w-7 min-w-[28px] text-center py-1 border-b border-outline-variant text-[10px] font-medium',
                      today ? 'text-secondary' : 'text-on-surface-variant',
                      isFirstOfMonth && 'border-l-2 border-l-secondary/30',
                    )}
                  >
                    <div className="flex flex-col items-center leading-tight">
                      {isFirstOfMonth && (
                        <span className="text-[9px] text-secondary/70 font-semibold">
                          {format(day, 'MMM')}
                        </span>
                      )}
                      <span>{format(day, 'd')}</span>
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>

          <tbody>
            {rooms.map((room) => (
              <tr key={room.id} className="group">
                <td
                  className="sticky left-0 z-10 bg-surface-container px-3 py-1.5 border-b border-r border-outline-variant min-w-[140px] max-w-[160px]"
                >
                  <div className="text-xs font-medium text-primary truncate">{room.name}</div>
                  {room.property && (
                    <div className="text-[10px] text-on-surface-variant truncate">{room.property.name}</div>
                  )}
                </td>

                {days.map((day) => {
                  const dateStr = format(day, 'yyyy-MM-dd')
                  const { status, tooltip, initial } = getDayInfo(dateStr, room.id, bookings, icalBlocks)
                  const today = isToday(day)
                  const isFirstOfMonth = day.getDate() === 1

                  return (
                    <td
                      key={dateStr}
                      title={tooltip}
                      className={clsx(
                        'w-7 h-7 min-w-[28px] border-b border-outline-variant p-0 text-center text-xs cursor-default',
                        isFirstOfMonth && 'border-l-2 border-l-secondary/30',
                        status === 'booking' && 'bg-secondary/30',
                        status === 'ical' && 'bg-primary/20',
                        status === 'available' && 'bg-surface-container hover:bg-surface-high',
                        today && 'ring-1 ring-inset ring-secondary/50 rounded',
                      )}
                    >
                      {status === 'booking' && initial && (
                        <span className="text-secondary text-[9px] font-medium leading-none select-none">
                          {initial}
                        </span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}

            {rooms.length === 0 && (
              <tr>
                <td
                  colSpan={days.length + 1}
                  className="py-12 text-center text-on-surface-variant text-sm"
                >
                  No active rooms found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-3 px-1" aria-label="Legend">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-sm bg-secondary/30" />
          <span className="text-xs text-on-surface-variant">Confirmed / Pending Booking</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-sm bg-primary/20" />
          <span className="text-xs text-on-surface-variant">iCal Block</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-sm bg-surface-container border border-outline-variant" />
          <span className="text-xs text-on-surface-variant">Available</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-sm ring-1 ring-secondary/50" />
          <span className="text-xs text-on-surface-variant">Today</span>
        </div>
      </div>
    </div>
  )
}
