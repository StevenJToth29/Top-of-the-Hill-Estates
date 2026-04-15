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
  startOfDay,
} from 'date-fns'
import { CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'

interface DatePickerProps {
  label: string
  value: string
  onChange: (date: string) => void
  min?: string
  placeholder?: string
  blockedDates?: string[]
}

const DAY_HEADERS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

export default function DatePicker({ label, value, onChange, min, placeholder = 'Select date', blockedDates }: DatePickerProps) {
  const blockedSet = useMemo(() => new Set(blockedDates ?? []), [blockedDates])
  const [open, setOpen] = useState(false)
  const [viewMonth, setViewMonth] = useState<Date>(() => {
    if (value) try { return startOfMonth(parseISO(value)) } catch { /* fall through */ }
    return startOfMonth(new Date())
  })
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({})

  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    setPopoverStyle({
      position: 'fixed',
      top: rect.bottom + 8,
      left: Math.min(rect.left, window.innerWidth - 296),
      width: 288,
      zIndex: 9999,
    })
  }, [])

  useEffect(() => {
    if (!open) return
    updatePosition()

    function handleMouseDown(e: MouseEvent) {
      const target = e.target as Node
      // Close only if the click is outside both the trigger wrapper and the portaled popover
      const inTrigger = triggerRef.current?.parentElement?.contains(target)
      const inPopover = popoverRef.current?.contains(target)
      if (!inTrigger && !inPopover) {
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

  const gridStart = startOfWeek(startOfMonth(viewMonth))
  const gridEnd = endOfWeek(endOfMonth(viewMonth))
  const gridDays = eachDayOfInterval({ start: gridStart, end: gridEnd })

  const minDate = min ? startOfDay(parseISO(min)) : null
  const selectedDate = value ? parseISO(value) : null

  function selectDay(day: Date) {
    const iso = format(day, 'yyyy-MM-dd')
    if (minDate && isBefore(day, minDate)) return
    if (blockedSet.has(iso)) return
    onChange(iso)
    setOpen(false)
  }

  const displayValue = value ? format(parseISO(value), 'MMM d, yyyy') : ''

  const popover = open ? (
    <div ref={popoverRef} style={popoverStyle}>
      <div className="bg-background rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.22)] border border-surface p-4">
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={() => setViewMonth((m) => subMonths(m, 1))}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface transition-colors text-on-surface-variant hover:text-on-surface"
            aria-label="Previous month"
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </button>

          <span className="font-display text-sm font-semibold text-on-surface">
            {format(viewMonth, 'MMMM yyyy')}
          </span>

          <button
            type="button"
            onClick={() => setViewMonth((m) => addMonths(m, 1))}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface transition-colors text-on-surface-variant hover:text-on-surface"
            aria-label="Next month"
          >
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 mb-1">
          {DAY_HEADERS.map((d) => (
            <div key={d} className="text-center text-[10px] font-semibold text-on-surface-variant/60 uppercase py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7 gap-y-0.5">
          {gridDays.map((day) => {
            const iso = format(day, 'yyyy-MM-dd')
            const isCurrentMonth = day.getMonth() === viewMonth.getMonth()
            const isSelected = selectedDate ? iso === format(selectedDate, 'yyyy-MM-dd') : false
            const todayFlag = isToday(day)
            const isBlocked = blockedSet.has(iso)
            const disabled = (!!minDate && isBefore(startOfDay(day), minDate)) || isBlocked

            return (
              <button
                key={day.toISOString()}
                type="button"
                disabled={disabled}
                onClick={() => selectDay(day)}
                className={clsx(
                  'h-8 w-full flex items-center justify-center rounded-lg text-sm font-body transition-colors',
                  !isCurrentMonth && 'text-on-surface-variant/30',
                  isCurrentMonth && !isSelected && !disabled && 'text-on-surface hover:bg-primary/10 hover:text-primary',
                  isSelected && 'bg-primary text-white font-semibold shadow-sm',
                  todayFlag && !isSelected && !disabled && 'ring-1 ring-primary/40 text-primary font-medium',
                  isBlocked && isCurrentMonth && 'bg-surface-low text-on-surface-variant/40 line-through cursor-not-allowed',
                  !isBlocked && disabled && 'text-on-surface-variant/25 cursor-not-allowed',
                )}
              >
                {format(day, 'd')}
              </button>
            )
          })}
        </div>

        {/* Clear */}
        {value && (
          <div className="mt-3 pt-3 border-t border-surface flex justify-end">
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false) }}
              className="text-xs text-on-surface-variant hover:text-error transition-colors"
            >
              Clear date
            </button>
          </div>
        )}
      </div>
    </div>
  ) : null

  return (
    <div>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left flex items-center gap-2 group"
      >
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1">{label}</p>
          <p className={clsx('font-body text-sm truncate', displayValue ? 'text-on-surface' : 'text-on-surface-variant/50')}>
            {displayValue || placeholder}
          </p>
        </div>
        <CalendarDaysIcon className="h-4 w-4 text-on-surface-variant/50 group-hover:text-primary transition-colors shrink-0" />
      </button>

      {typeof document !== 'undefined' && popover && createPortal(popover, document.body)}
    </div>
  )
}
