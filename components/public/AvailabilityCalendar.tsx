'use client'

import { useState, useCallback, useMemo } from 'react'
import {
  format,
  addMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isBefore,
  isAfter,
  isSameDay,
  isSameMonth,
  parseISO,
} from 'date-fns'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'

interface Props {
  blockedDates: string[]
  selectedCheckIn?: string | null
  selectedCheckOut?: string | null
  onDateSelect?: (date: string) => void
}

const DAYS_OF_WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function MonthGrid({
  month,
  today,
  blockedSet,
  selectedCheckIn,
  selectedCheckOut,
  onDateSelect,
}: {
  month: Date
  today: Date
  blockedSet: Set<string>
  selectedCheckIn?: string | null
  selectedCheckOut?: string | null
  onDateSelect?: (date: string) => void
}) {
  const monthStart = startOfMonth(month)
  const monthEnd = endOfMonth(month)
  const calStart = startOfWeek(monthStart)
  const calEnd = endOfWeek(monthEnd)
  const days = eachDayOfInterval({ start: calStart, end: calEnd })

  const checkInDate = selectedCheckIn ? parseISO(selectedCheckIn) : null
  const checkOutDate = selectedCheckOut ? parseISO(selectedCheckOut) : null

  return (
    <div className="flex-1 min-w-0">
      <h3 className="font-display font-semibold text-on-surface text-center mb-3">
        {format(month, 'MMMM yyyy')}
      </h3>
      <div className="grid grid-cols-7 mb-1">
        {DAYS_OF_WEEK.map((d) => (
          <div key={d} className="text-center text-xs text-on-surface-variant pb-1">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {days.map((day) => {
          const iso = format(day, 'yyyy-MM-dd')
          const isCurrentMonth = isSameMonth(day, month)
          const isToday = isSameDay(day, today)
          const isPast = isBefore(day, today) && !isToday
          const isBlocked = blockedSet.has(iso)
          const isDisabled = isPast || isBlocked || !isCurrentMonth

          const isCheckIn = checkInDate && isSameDay(day, checkInDate)
          const isCheckOut = checkOutDate && isSameDay(day, checkOutDate)
          const isInRange =
            checkInDate &&
            checkOutDate &&
            isAfter(day, checkInDate) &&
            isBefore(day, checkOutDate)

          let cellClass =
            'relative flex items-center justify-center h-8 w-full text-sm rounded-lg select-none '

          if (!isCurrentMonth) {
            cellClass += 'invisible '
          } else if (isBlocked || isPast) {
            cellClass +=
              'bg-surface-low text-on-surface-variant/50 line-through cursor-not-allowed '
          } else if (isCheckIn || isCheckOut) {
            cellClass += 'bg-secondary text-background font-semibold cursor-pointer '
          } else if (isInRange) {
            cellClass += 'bg-secondary/20 text-on-surface cursor-pointer '
          } else {
            cellClass +=
              'text-on-surface cursor-pointer hover:bg-surface-container transition-colors '
          }

          if (isToday && !isBlocked && !isPast) {
            cellClass += 'ring-1 ring-secondary/50 '
          }

          return (
            <button
              key={iso}
              disabled={isDisabled}
              onClick={() => !isDisabled && onDateSelect?.(iso)}
              className={cellClass}
              aria-label={format(day, 'MMMM d, yyyy')}
            >
              {format(day, 'd')}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function getTodayMidnight() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

const TODAY = getTodayMidnight()
const THIS_MONTH = startOfMonth(TODAY)

export default function AvailabilityCalendar({
  blockedDates,
  selectedCheckIn,
  selectedCheckOut,
  onDateSelect,
}: Props) {
  const [startMonth, setStartMonth] = useState(() => THIS_MONTH)

  const blockedSet = useMemo(() => new Set(blockedDates), [blockedDates])
  const secondMonth = addMonths(startMonth, 1)

  const goPrev = useCallback(() => {
    setStartMonth((m) => {
      const prev = addMonths(m, -1)
      return isBefore(prev, THIS_MONTH) ? m : prev
    })
  }, [])

  const goNext = useCallback(() => {
    setStartMonth((m) => addMonths(m, 1))
  }, [])

  const atMin = isSameDay(startMonth, THIS_MONTH)

  const sharedProps = { today: TODAY, blockedSet, selectedCheckIn, selectedCheckOut, onDateSelect }

  return (
    <div className="bg-surface-highest/40 backdrop-blur-xl shadow-[0_8px_40px_rgba(175,201,234,0.06)] rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={goPrev}
          disabled={atMin}
          className="p-1.5 rounded-lg text-secondary hover:bg-surface-container disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeftIcon className="w-5 h-5" />
        </button>
        <span className="text-xs uppercase tracking-widest text-on-surface-variant font-body">
          Availability
        </span>
        <button
          onClick={goNext}
          className="p-1.5 rounded-lg text-secondary hover:bg-surface-container transition-colors"
        >
          <ChevronRightIcon className="w-5 h-5" />
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-6">
        <MonthGrid month={startMonth} {...sharedProps} />
        <div className="hidden sm:block w-px bg-outline-variant" />
        <MonthGrid month={secondMonth} {...sharedProps} />
      </div>

      <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-outline-variant text-xs text-on-surface-variant">
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded-full bg-secondary/20 ring-1 ring-secondary/50" />
          Available
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded-full bg-surface-low line-through" />
          Unavailable
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded-full bg-secondary" />
          Selected
        </span>
      </div>
    </div>
  )
}
