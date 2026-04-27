'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addMonths,
  subMonths,
  isToday,
  isBefore,
  isAfter,
  startOfDay,
  isSameDay,
  addDays,
  differenceInDays,
} from 'date-fns'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'

interface Props {
  checkIn: string
  checkOut: string
  onCheckInChange: (d: string) => void
  onCheckOutChange: (d: string) => void
  min?: string
  max?: string
  minNights?: number
  checkOutMax?: string
  blockedDates?: string[]
}

const DAY_HEADERS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
type Selecting = 'checkin' | 'checkout'

function rangeContainsBlocked(from: string, to: string, blocked: Set<string>): boolean {
  const start = parseISO(from)
  const days = differenceInDays(parseISO(to), start)
  for (let i = 1; i < days; i++) {
    if (blocked.has(format(addDays(start, i), 'yyyy-MM-dd'))) return true
  }
  return false
}

export default function DateRangePicker({
  checkIn,
  checkOut,
  onCheckInChange,
  onCheckOutChange,
  min,
  max,
  minNights = 1,
  checkOutMax,
  blockedDates = [],
}: Props) {
  const blockedSet = useMemo(() => new Set(blockedDates), [blockedDates])
  const [open, setOpen] = useState(false)
  const [selecting, setSelecting] = useState<Selecting>('checkin')
  const [hoverDate, setHoverDate] = useState<string | null>(null)
  const [viewMonth, setViewMonth] = useState<Date>(() => {
    if (checkIn) try { return startOfMonth(parseISO(checkIn)) } catch { /* */ }
    return startOfMonth(new Date())
  })
  const [twoMonth, setTwoMonth] = useState(false)
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({})

  const containerRef = useRef<HTMLDivElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  const updatePosition = useCallback(() => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const wide = window.innerWidth >= 596
    setTwoMonth(wide)
    const popWidth = wide ? 580 : 296
    const left = Math.min(rect.left, window.innerWidth - popWidth - 8)
    setPopoverStyle({
      position: 'fixed',
      top: rect.bottom + 8,
      left: Math.max(8, left),
      width: popWidth,
      zIndex: 9999,
    })
  }, [])

  function openCalendar(field: Selecting) {
    setSelecting(field)
    setHoverDate(null)
    const anchor = field === 'checkin' ? checkIn : checkIn
    setViewMonth(() => {
      if (anchor) try { return startOfMonth(parseISO(anchor)) } catch { /* */ }
      return startOfMonth(new Date())
    })
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    updatePosition()

    function handleMouseDown(e: MouseEvent) {
      const t = e.target as Node
      if (!containerRef.current?.contains(t) && !popoverRef.current?.contains(t)) {
        setOpen(false)
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }

    window.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('keydown', handleKey)
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
    return () => {
      window.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('keydown', handleKey)
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [open, updatePosition])

  const minDate = min ? startOfDay(parseISO(min)) : null
  const maxDate = max ? startOfDay(parseISO(max)) : null
  const checkInDate = checkIn ? parseISO(checkIn) : null
  const checkOutDate = checkOut ? parseISO(checkOut) : null
  const hoverEndDate = selecting === 'checkout' && hoverDate ? parseISO(hoverDate) : null
  const effectiveEnd = checkOutDate ?? hoverEndDate

  function isDayDisabled(day: Date): boolean {
    const iso = format(day, 'yyyy-MM-dd')
    const d = startOfDay(day)
    if (minDate && isBefore(d, minDate)) return true
    if (maxDate && isAfter(d, maxDate)) return true
    if (blockedSet.has(iso)) return true
    if (selecting === 'checkout' && checkIn) {
      const ci = parseISO(checkIn)
      if (!isAfter(d, startOfDay(addDays(ci, minNights - 1)))) return true
      if (checkOutMax && isAfter(d, startOfDay(parseISO(checkOutMax)))) return true
      if (rangeContainsBlocked(checkIn, iso, blockedSet)) return true
    }
    return false
  }

  function handleDayClick(day: Date) {
    const iso = format(day, 'yyyy-MM-dd')
    if (selecting === 'checkin') {
      onCheckInChange(iso)
      onCheckOutChange('')
      setSelecting('checkout')
      setHoverDate(null)
    } else if (checkIn) {
      onCheckOutChange(iso)
      setOpen(false)
      setHoverDate(null)
    }
  }

  function renderGrid(month: Date, showPrev: boolean, showNext: boolean) {
    const gridDays = eachDayOfInterval({
      start: startOfWeek(startOfMonth(month)),
      end: endOfWeek(endOfMonth(month)),
    })
    const canPrev = !minDate || isAfter(startOfDay(month), startOfDay(startOfMonth(new Date())))

    return (
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-3">
          {showPrev ? (
            <button
              type="button"
              onClick={() => setViewMonth((m) => subMonths(m, 1))}
              disabled={!canPrev}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface transition-colors text-on-surface-variant hover:text-on-surface disabled:opacity-25 disabled:cursor-not-allowed"
              aria-label="Previous month"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </button>
          ) : (
            <div className="w-7" />
          )}
          <span className="font-display text-sm font-semibold text-on-surface">
            {format(month, 'MMMM yyyy')}
          </span>
          {showNext ? (
            <button
              type="button"
              onClick={() => setViewMonth((m) => addMonths(m, 1))}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface transition-colors text-on-surface-variant hover:text-on-surface"
              aria-label="Next month"
            >
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          ) : (
            <div className="w-7" />
          )}
        </div>

        <div className="grid grid-cols-7 mb-1">
          {DAY_HEADERS.map((d) => (
            <div key={d} className="text-center text-[10px] font-semibold text-on-surface-variant/60 uppercase py-1">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-y-0.5">
          {gridDays.map((day) => {
            const iso = format(day, 'yyyy-MM-dd')
            const inCurrentMonth = day.getMonth() === month.getMonth()
            const todayFlag = isToday(day)
            const blocked = blockedSet.has(iso)
            const disabled = isDayDisabled(day)

            const isStart = checkInDate ? isSameDay(day, checkInDate) : false
            const isEnd = checkOutDate ? isSameDay(day, checkOutDate) : false
            const isHoverEnd = hoverEndDate ? isSameDay(day, hoverEndDate) : false
            const inRange = !!(checkInDate && effectiveEnd && isAfter(day, checkInDate) && isBefore(day, effectiveEnd))

            return (
              <button
                key={day.toISOString()}
                type="button"
                aria-label={inCurrentMonth ? format(day, 'MMMM d, yyyy') : undefined}
                disabled={disabled || !inCurrentMonth}
                onClick={() => inCurrentMonth && !disabled && handleDayClick(day)}
                onMouseEnter={() => {
                  if (selecting === 'checkout' && inCurrentMonth && !disabled) setHoverDate(iso)
                }}
                onMouseLeave={() => {
                  if (selecting === 'checkout') setHoverDate(null)
                }}
                className={clsx(
                  'h-8 w-full flex items-center justify-center text-sm font-body transition-colors rounded-lg',
                  !inCurrentMonth && 'invisible',
                  // Range background (full width, no gap)
                  inCurrentMonth && inRange && 'bg-primary/10 rounded-none',
                  // Start cap
                  inCurrentMonth && isStart && inRange && 'rounded-l-lg rounded-r-none',
                  inCurrentMonth && isStart && !inRange && 'rounded-lg',
                  // End caps
                  inCurrentMonth && (isEnd || isHoverEnd) && inRange && 'rounded-r-lg rounded-l-none',
                  inCurrentMonth && (isEnd || isHoverEnd) && !inRange && 'rounded-lg',
                  // Text and fill colors
                  inCurrentMonth && (isStart || isEnd) && 'bg-primary text-white font-semibold shadow-sm',
                  inCurrentMonth && isHoverEnd && !isEnd && 'bg-primary/60 text-white',
                  inCurrentMonth && inRange && !isStart && !isEnd && !isHoverEnd && 'text-on-surface',
                  inCurrentMonth && !isStart && !isEnd && !isHoverEnd && !inRange && !disabled && !blocked && 'text-on-surface hover:bg-primary/10 hover:text-primary',
                  inCurrentMonth && blocked && 'bg-surface-low text-on-surface-variant/40 line-through cursor-not-allowed',
                  inCurrentMonth && disabled && !blocked && 'text-on-surface-variant/25 cursor-not-allowed',
                  todayFlag && inCurrentMonth && !isStart && !isEnd && !disabled && 'ring-1 ring-primary/40',
                )}
              >
                {format(day, 'd')}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  const secondMonth = addMonths(viewMonth, 1)
  const checkInDisplay = checkIn ? format(parseISO(checkIn), 'MMM d, yyyy') : ''
  const checkOutDisplay = checkOut ? format(parseISO(checkOut), 'MMM d, yyyy') : ''

  const popover = open ? (
    <div ref={popoverRef} style={popoverStyle} data-testid="date-picker-popup">
      <div className="bg-background rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.22)] border border-surface p-4">
        <p className="text-xs text-center text-on-surface-variant mb-3">
          {selecting === 'checkin' ? 'Select your check-in date' : 'Select your check-out date'}
        </p>

        <div className={clsx('flex gap-5', !twoMonth && 'flex-col')}>
          {renderGrid(viewMonth, true, !twoMonth)}
          {twoMonth && (
            <>
              <div className="w-px bg-surface self-stretch" />
              {renderGrid(secondMonth, false, true)}
            </>
          )}
        </div>

        {(checkIn || checkOut) && (
          <div className="mt-3 pt-3 border-t border-surface flex justify-end">
            <button
              type="button"
              onClick={() => {
                onCheckInChange('')
                onCheckOutChange('')
                setSelecting('checkin')
              }}
              className="text-xs text-on-surface-variant hover:text-error transition-colors"
            >
              Clear dates
            </button>
          </div>
        )}
      </div>
    </div>
  ) : null

  return (
    <div ref={containerRef} className="bg-surface-highest/40 rounded-xl overflow-hidden flex">
      <button
        type="button"
        onClick={() => {
          if (open && selecting === 'checkin') {
            setOpen(false)
          } else {
            openCalendar('checkin')
          }
        }}
        className={clsx(
          'flex-1 px-3 py-2.5 text-left transition-colors',
          open && selecting === 'checkin' ? 'bg-primary/10' : 'hover:bg-primary/5',
        )}
      >
        <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Check-in</p>
        <p className={clsx('font-body text-sm truncate', checkInDisplay ? 'text-on-surface' : 'text-on-surface-variant/50')}>
          {checkInDisplay || 'Add date'}
        </p>
      </button>

      <div className="w-px bg-surface-highest/60 self-stretch" />

      <button
        type="button"
        onClick={() => {
          if (open && selecting === 'checkout') {
            setOpen(false)
          } else {
            openCalendar(checkIn ? 'checkout' : 'checkin')
          }
        }}
        className={clsx(
          'flex-1 px-3 py-2.5 text-left transition-colors',
          open && selecting === 'checkout' ? 'bg-primary/10' : 'hover:bg-primary/5',
        )}
      >
        <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Check-out</p>
        <p className={clsx('font-body text-sm truncate', checkOutDisplay ? 'text-on-surface' : 'text-on-surface-variant/50')}>
          {checkOutDisplay || 'Add date'}
        </p>
      </button>

      {typeof document !== 'undefined' && popover && createPortal(popover, document.body)}
    </div>
  )
}
