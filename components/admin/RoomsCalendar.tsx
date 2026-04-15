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
  isSunday,
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
      // ignore malformed ISO dates
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
      // ignore malformed ISO dates
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
    <div className="space-y-5">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
          className="flex items-center justify-center w-9 h-9 rounded-xl bg-surface-highest/40 hover:bg-surface-high text-on-surface-variant hover:text-on-surface transition-colors"
          aria-label="Previous month"
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </button>

        <h2 className="font-display text-lg font-semibold text-on-surface">
          {format(currentMonth, 'MMMM yyyy')}
          <span className="text-on-surface-variant font-normal mx-2">–</span>
          {format(addMonths(currentMonth, 1), 'MMMM yyyy')}
        </h2>

        <button
          onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
          className="flex items-center justify-center w-9 h-9 rounded-xl bg-surface-highest/40 hover:bg-surface-high text-on-surface-variant hover:text-on-surface transition-colors"
          aria-label="Next month"
        >
          <ChevronRightIcon className="h-4 w-4" />
        </button>
      </div>

      {/* Calendar card */}
      <div className="bg-surface-highest/40 backdrop-blur-xl rounded-2xl overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto max-h-[68vh]">
          <table className="border-collapse table-fixed min-w-max w-full">
            <thead>
              <tr>
                {/* Room column header */}
                <th className="sticky left-0 top-0 z-30 bg-surface-container/95 backdrop-blur-sm px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-on-surface-variant border-b border-r border-outline-variant/60 min-w-[200px]">
                  Room
                </th>

                {days.map((day) => {
                  const todayDay = isToday(day)
                  const isFirst = day.getDate() === 1
                  const isSun = isSunday(day)
                  return (
                    <th
                      key={format(day, 'yyyy-MM-dd')}
                      className={clsx(
                        'sticky top-0 z-20 bg-surface-container/95 backdrop-blur-sm w-8 min-w-[32px] py-2 border-b border-outline-variant/60 text-center',
                        isFirst && 'border-l-2 border-l-primary/25',
                        isSun && !isFirst && 'border-l border-l-outline-variant/40',
                      )}
                    >
                      <div className="flex flex-col items-center gap-0.5">
                        {isFirst && (
                          <span className="text-[9px] font-semibold text-primary/70 uppercase tracking-wide leading-none">
                            {format(day, 'MMM')}
                          </span>
                        )}
                        <span
                          className={clsx(
                            'text-[10px] font-medium leading-none',
                            todayDay
                              ? 'w-5 h-5 flex items-center justify-center rounded-full bg-primary text-white font-bold'
                              : 'text-on-surface-variant',
                          )}
                        >
                          {format(day, 'd')}
                        </span>
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>

            <tbody className="divide-y divide-outline-variant/40">
              {rooms.map((room, roomIdx) => (
                <tr
                  key={room.id}
                  className={clsx(
                    'group',
                    roomIdx % 2 === 0 ? 'bg-background/30' : 'bg-surface-highest/20',
                  )}
                >
                  {/* Room label */}
                  <td className="sticky left-0 z-10 bg-surface-container/90 backdrop-blur-sm px-4 py-2.5 border-r border-outline-variant/60 min-w-[200px]">
                    <div className="text-xs font-semibold text-on-surface whitespace-normal leading-snug">{room.name}</div>
                    {room.property && (
                      <div className="text-[10px] text-on-surface-variant/70 mt-0.5">
                        {room.property.name}
                      </div>
                    )}
                  </td>

                  {/* Day cells */}
                  {days.map((day) => {
                    const dateStr = format(day, 'yyyy-MM-dd')
                    const { status, tooltip, initial } = getDayInfo(dateStr, room.id, bookings, icalBlocks)
                    const todayDay = isToday(day)
                    const isFirst = day.getDate() === 1
                    const isSun = isSundayFn(day)

                    return (
                      <td
                        key={dateStr}
                        title={tooltip}
                        className={clsx(
                          'w-8 h-8 min-w-[32px] p-0 text-center cursor-default transition-colors',
                          isFirst && 'border-l-2 border-l-primary/25',
                          isSun && !isFirst && 'border-l border-l-outline-variant/40',
                          status === 'booking' &&
                            'bg-secondary/25 hover:bg-secondary/35',
                          status === 'ical' &&
                            'bg-primary/15 hover:bg-primary/25',
                          status === 'available' &&
                            'hover:bg-surface-high',
                          todayDay && status === 'available' && 'ring-1 ring-inset ring-primary/40',
                        )}
                      >
                        {status === 'booking' && initial && (
                          <span className="text-secondary text-[9px] font-bold leading-none select-none">
                            {initial}
                          </span>
                        )}
                        {status === 'ical' && (
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary/60" />
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
                    className="py-16 text-center text-on-surface-variant text-sm"
                  >
                    No active rooms found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 px-1">
        <span className="text-xs font-medium text-on-surface-variant uppercase tracking-wider mr-1">Legend:</span>

        <div className="flex items-center gap-2 bg-secondary/15 rounded-full px-3 py-1">
          <div className="w-2 h-2 rounded-full bg-secondary" />
          <span className="text-xs text-on-surface-variant">Booking</span>
        </div>

        <div className="flex items-center gap-2 bg-primary/10 rounded-full px-3 py-1">
          <div className="w-2 h-2 rounded-full bg-primary/60" />
          <span className="text-xs text-on-surface-variant">iCal Block</span>
        </div>

        <div className="flex items-center gap-2 bg-surface-container rounded-full px-3 py-1 border border-outline-variant/60">
          <div className="w-2 h-2 rounded-full bg-surface-high" />
          <span className="text-xs text-on-surface-variant">Available</span>
        </div>

        <div className="flex items-center gap-2 bg-surface-container rounded-full px-3 py-1 ring-1 ring-primary/40">
          <div className="w-2 h-2 rounded-full bg-primary" />
          <span className="text-xs text-on-surface-variant">Today</span>
        </div>
      </div>
    </div>
  )
}

// named alias so it doesn't shadow the import inside JSX
function isSundayFn(d: Date) {
  return isSunday(d)
}
