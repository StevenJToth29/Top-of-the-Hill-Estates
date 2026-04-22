'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  format, addMonths, subMonths, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth,
  isToday, parseISO, isBefore, isAfter, isSameDay, addDays,
} from 'date-fns'
import { XMarkIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import type { Room, Property } from '@/types'
import { OPEN_ENDED_DATE } from '@/lib/format'

interface CalendarBooking {
  id: string
  room_id: string
  check_in: string
  check_out: string
  guest_first_name: string
  guest_last_name: string
  status: string
  booking_type: string
}

interface CalendarICalBlock {
  id: string
  room_id: string
  start_date: string
  end_date: string
  summary: string
  platform: string
}

interface EventBar {
  id: string
  type: 'booking' | 'long_term' | 'ical'
  label: string
  colStart: number // 1–7
  span: number
  isStart: boolean
  isEnd: boolean
  isOpenEnded?: boolean
}

interface Props {
  room: Room & { property: Property }
  onClose: () => void
}

function getWeeks(month: Date): Date[][] {
  const weeks: Date[][] = []
  const start = startOfWeek(startOfMonth(month))
  const end = endOfWeek(endOfMonth(month))
  const days = eachDayOfInterval({ start, end })
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7))
  }
  return weeks
}

function clampToWeek(eventStart: Date, eventEnd: Date, weekDays: Date[]) {
  const weekStart = weekDays[0]
  const weekEnd = weekDays[6]
  const start = isBefore(eventStart, weekStart) ? weekStart : eventStart
  const end = isAfter(eventEnd, weekEnd) ? weekEnd : eventEnd
  const colStart = weekDays.findIndex((d) => isSameDay(d, start)) + 1
  const colEnd = weekDays.findIndex((d) => isSameDay(d, end)) + 1
  const span = colEnd - colStart + 1
  return { colStart, span, isStart: isSameDay(eventStart, start), isEnd: isSameDay(eventEnd, end) }
}

function getBarsForWeek(
  bookings: CalendarBooking[],
  icalBlocks: CalendarICalBlock[],
  weekDays: Date[],
): EventBar[][] {
  const weekStart = weekDays[0]
  const weekEnd = weekDays[6]

  const bars: EventBar[] = []

  for (const b of bookings) {
    const s = parseISO(b.check_in)
    const isOpenEnded = b.check_out === OPEN_ENDED_DATE
    // check_out is exclusive; for open-ended we use day after week end as visual cap
    const e = isOpenEnded ? addDays(weekEnd, 1) : addDays(parseISO(b.check_out), -1)
    if (isAfter(s, weekEnd) || (!isOpenEnded && isBefore(e, weekStart))) continue
    const { colStart, span, isStart, isEnd } = clampToWeek(s, e, weekDays)
    bars.push({
      id: b.id,
      type: b.booking_type === 'long_term' ? 'long_term' : 'booking',
      label: `${b.guest_first_name} ${b.guest_last_name}`,
      colStart,
      span,
      isStart,
      isEnd: isOpenEnded ? false : isEnd,
      isOpenEnded,
    })
  }

  for (const block of icalBlocks) {
    const s = parseISO(block.start_date)
    // end_date is exclusive (matches iCal DTEND convention and our availability logic)
    const e = addDays(parseISO(block.end_date), -1)
    if (isAfter(s, weekEnd) || isBefore(e, weekStart)) continue
    const { colStart, span, isStart, isEnd } = clampToWeek(s, e, weekDays)
    bars.push({
      id: block.id,
      type: 'ical',
      label: `${block.platform}: ${block.summary}`,
      colStart,
      span,
      isStart,
      isEnd,
    })
  }

  // Pack into lanes so overlapping events stack
  const lanes: EventBar[][] = []
  for (const bar of bars) {
    const barEnd = bar.colStart + bar.span - 1
    let placed = false
    for (const lane of lanes) {
      const lastInLane = lane[lane.length - 1]
      if (lastInLane.colStart + lastInLane.span - 1 < bar.colStart) {
        lane.push(bar)
        placed = true
        break
      }
    }
    if (!placed) lanes.push([bar])
  }
  return lanes
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function RoomCalendarModal({ room, onClose }: Props) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [bookings, setBookings] = useState<CalendarBooking[]>([])
  const [icalBlocks, setIcalBlocks] = useState<CalendarICalBlock[]>([])
  const [loading, setLoading] = useState(false)

  const fetchData = useCallback(async (m: Date) => {
    setLoading(true)
    const from = format(startOfWeek(startOfMonth(m)), 'yyyy-MM-dd')
    const to = format(endOfWeek(endOfMonth(m)), 'yyyy-MM-dd')
    try {
      const res = await fetch(`/api/admin/rooms/${room.id}/calendar?from=${from}&to=${to}`)
      const data = await res.json()
      setBookings(data.bookings ?? [])
      setIcalBlocks(data.icalBlocks ?? [])
    } finally {
      setLoading(false)
    }
  }, [room.id])

  useEffect(() => { fetchData(month) }, [month, fetchData])

  const weeks = getWeeks(month)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-surface-container w-full max-w-6xl max-h-[95vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/40 shrink-0">
          <div>
            <h2 className="font-display text-lg font-bold text-on-surface">{room.name}</h2>
            <p className="text-xs text-on-surface-variant mt-0.5">{room.property?.name}</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Month nav */}
            <button
              onClick={() => setMonth((m) => subMonths(m, 1))}
              className="p-1.5 rounded-lg hover:bg-surface-high text-on-surface-variant hover:text-on-surface transition-colors"
            >
              <ChevronLeftIcon className="w-5 h-5" />
            </button>
            <span className="font-display font-semibold text-on-surface min-w-[160px] text-center">
              {format(month, 'MMMM yyyy')}
            </span>
            <button
              onClick={() => setMonth((m) => addMonths(m, 1))}
              className="p-1.5 rounded-lg hover:bg-surface-high text-on-surface-variant hover:text-on-surface transition-colors"
            >
              <ChevronRightIcon className="w-5 h-5" />
            </button>
            <button
              onClick={() => setMonth(startOfMonth(new Date()))}
              className="text-xs text-secondary hover:text-on-surface border border-secondary/40 hover:border-on-surface/30 px-3 py-1.5 rounded-lg transition-colors"
            >
              Today
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-surface-high text-on-surface-variant hover:text-on-surface transition-colors ml-2"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Calendar */}
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center h-64 text-on-surface-variant text-sm">
              Loading…
            </div>
          ) : (
            <div className="p-4">
              {/* Day of week headers */}
              <div className="grid grid-cols-7 mb-1">
                {DAYS_OF_WEEK.map((d) => (
                  <div key={d} className="text-center text-xs font-medium text-on-surface-variant py-1">
                    {d}
                  </div>
                ))}
              </div>

              {/* Weeks */}
              <div className="space-y-1">
                {weeks.map((weekDays, wi) => {
                  const lanes = getBarsForWeek(bookings, icalBlocks, weekDays)
                  return (
                    <div key={wi}>
                      {/* Day number row */}
                      <div className="grid grid-cols-7">
                        {weekDays.map((day) => {
                          const inMonth = isSameMonth(day, month)
                          const today = isToday(day)
                          return (
                            <div
                              key={format(day, 'yyyy-MM-dd')}
                              className={[
                                'h-16 flex items-start justify-end pr-2 pt-1.5 text-sm border-t border-outline-variant/30',
                                !inMonth ? 'text-on-surface-variant/30' : today ? 'font-bold' : 'text-on-surface',
                              ].join(' ')}
                            >
                              {today ? (
                                <span className="w-5 h-5 flex items-center justify-center rounded-full bg-primary text-white text-[11px] font-bold">
                                  {format(day, 'd')}
                                </span>
                              ) : (
                                format(day, 'd')
                              )}
                            </div>
                          )
                        })}
                      </div>

                      {/* Event bars */}
                      {lanes.map((lane, li) => (
                        <div key={li} className="grid grid-cols-7 h-7">
                          {(() => {
                            const cells: React.ReactNode[] = []
                            let col = 1
                            const sorted = [...lane].sort((a, b) => a.colStart - b.colStart)
                            for (const bar of sorted) {
                              // fill gap before bar
                              if (bar.colStart > col) {
                                cells.push(
                                  <div
                                    key={`gap-${col}`}
                                    style={{ gridColumn: `${col} / span ${bar.colStart - col}` }}
                                  />
                                )
                              }
                              cells.push(
                                <div
                                  key={bar.id}
                                  title={bar.label}
                                  style={{
                                    gridColumn: `${bar.colStart} / span ${bar.span}`,
                                    ...(bar.type === 'long_term'
                                      ? {
                                          background:
                                            'repeating-linear-gradient(45deg, rgba(100,116,139,0.25) 0, rgba(100,116,139,0.25) 2px, transparent 2px, transparent 7px)',
                                          borderRight: bar.isOpenEnded ? '2px dashed rgba(100,116,139,0.45)' : undefined,
                                        }
                                      : {}),
                                  }}
                                  className={[
                                    'h-6 flex items-center px-2 text-xs font-medium overflow-hidden whitespace-nowrap mx-0.5',
                                    bar.isStart ? 'rounded-l-full' : '',
                                    bar.isEnd ? 'rounded-r-full' : '',
                                    bar.type === 'booking' ? 'bg-secondary/30 text-secondary' : '',
                                    bar.type === 'long_term' ? 'text-slate-500' : '',
                                    bar.type === 'ical' ? 'bg-primary/20 text-primary' : '',
                                  ].join(' ')}
                                >
                                  {bar.isStart && (
                                    <span className="truncate">{bar.label}</span>
                                  )}
                                </div>
                              )
                              col = bar.colStart + bar.span
                            }
                            // fill remaining
                            if (col <= 7) {
                              cells.push(
                                <div key="end-gap" style={{ gridColumn: `${col} / span ${8 - col}` }} />
                              )
                            }
                            return cells
                          })()}
                        </div>
                      ))}

                      {/* Empty row spacer if no events */}
                      {lanes.length === 0 && <div className="h-2" />}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 px-6 py-3 border-t border-outline-variant/40 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-secondary/50" />
            <span className="text-xs text-on-surface-variant">Booking</span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-3.5 h-3.5 rounded-sm flex-shrink-0"
              style={{
                background:
                  'repeating-linear-gradient(45deg, rgba(100,116,139,0.45) 0, rgba(100,116,139,0.45) 2px, transparent 2px, transparent 5px)',
              }}
            />
            <span className="text-xs text-on-surface-variant">Long Term</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-primary/40" />
            <span className="text-xs text-on-surface-variant">iCal Block</span>
          </div>
        </div>
      </div>
    </div>
  )
}
