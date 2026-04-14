'use client'

import { useEffect, useRef, useState } from 'react'
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
  value: string          // 'yyyy-MM-dd' or ''
  onChange: (date: string) => void
  min?: string           // 'yyyy-MM-dd' — dates before this are disabled
  placeholder?: string
}

const DAY_HEADERS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

export default function DatePicker({ label, value, onChange, min, placeholder = 'Select date' }: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const [viewMonth, setViewMonth] = useState<Date>(() => {
    if (value) try { return startOfMonth(parseISO(value)) } catch { /* fall through */ }
    return startOfMonth(new Date())
  })
  const containerRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  // Build the 6-row day grid for the current view month
  const gridStart = startOfWeek(startOfMonth(viewMonth))
  const gridEnd = endOfWeek(endOfMonth(viewMonth))
  const gridDays = eachDayOfInterval({ start: gridStart, end: gridEnd })

  const minDate = min ? startOfDay(parseISO(min)) : null
  const selectedDate = value ? parseISO(value) : null

  function selectDay(day: Date) {
    if (minDate && isBefore(day, minDate)) return
    onChange(format(day, 'yyyy-MM-dd'))
    setOpen(false)
  }

  const displayValue = value
    ? format(parseISO(value), 'MMM d, yyyy')
    : ''

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
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

      {/* Popover */}
      {open && (
        <div className="absolute left-0 top-full mt-3 z-50 w-72 bg-background rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.18)] border border-surface p-4">
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
              const isCurrentMonth = day.getMonth() === viewMonth.getMonth()
              const isSelected = selectedDate && format(day, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd')
              const todayFlag = isToday(day)
              const disabled = !!minDate && isBefore(startOfDay(day), minDate)

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
                    todayFlag && !isSelected && 'ring-1 ring-primary/40 text-primary font-medium',
                    disabled && 'text-on-surface-variant/25 cursor-not-allowed',
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
      )}
    </div>
  )
}
