'use client'

import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isToday, parseISO, isWithinInterval } from 'date-fns'
import clsx from 'clsx'

export interface CalendarEvent {
  startDate: string // yyyy-MM-dd
  endDate: string
  color: string // Tailwind bg class
  label?: string
}

interface CalendarGridProps {
  year: number
  month: number // 0-indexed
  events: CalendarEvent[]
  onDayClick?: (date: string) => void
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function CalendarGrid({ year, month, events, onDayClick }: CalendarGridProps) {
  const monthDate = new Date(year, month, 1)
  const days = eachDayOfInterval({ start: startOfMonth(monthDate), end: endOfMonth(monthDate) })
  const startPadding = getDay(days[0]) // 0 = Sunday

  const getEventsForDay = (date: Date): CalendarEvent[] =>
    events.filter((e) => {
      try {
        return isWithinInterval(date, { start: parseISO(e.startDate), end: parseISO(e.endDate) })
      } catch {
        return false
      }
    })

  return (
    <div className="rounded-2xl bg-surface-highest/40 backdrop-blur-xl p-4">
      <h3 className="text-sm font-display font-semibold text-primary mb-3">
        {format(monthDate, 'MMMM yyyy')}
      </h3>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((day) => (
          <div key={day} className="text-center text-xs text-on-surface-variant font-medium py-1">
            {day}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-px">
        {/* Leading empty cells */}
        {Array.from({ length: startPadding }).map((_, i) => (
          <div key={`pad-${i}`} />
        ))}

        {days.map((day) => {
          const dayEvents = getEventsForDay(day)
          const dateStr = format(day, 'yyyy-MM-dd')
          const today = isToday(day)

          return (
            <button
              key={dateStr}
              onClick={() => onDayClick?.(dateStr)}
              title={dayEvents.map((e) => e.label).filter(Boolean).join(', ')}
              className={clsx(
                'relative flex flex-col items-center rounded p-0.5 min-h-[40px] text-xs text-on-surface transition-colors',
                today && 'ring-1 ring-secondary/50',
                onDayClick && 'hover:bg-surface-high cursor-pointer',
                !onDayClick && 'cursor-default',
              )}
            >
              <span className="mb-0.5 text-xs">{format(day, 'd')}</span>
              <div className="flex flex-col gap-px w-full">
                {dayEvents.slice(0, 2).map((e, idx) => (
                  <div
                    key={idx}
                    className={clsx('rounded-sm h-1.5 w-full', e.color)}
                  />
                ))}
                {dayEvents.length > 2 && (
                  <div className="text-[9px] text-on-surface-variant text-center">+{dayEvents.length - 2}</div>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
