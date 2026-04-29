// components/admin/CalendarGrid.tsx
'use client'

import React, { useRef, useCallback, useMemo, useEffect } from 'react'
import { format, getDay } from 'date-fns'
import { clsx } from 'clsx'
import { HomeIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/16/solid'
import type { Room, Booking, ICalBlock, CalendarTask } from '@/types'
import { CalendarTaskRow } from './CalendarTaskRow'
import type { OverrideMap } from '@/hooks/useDateOverrides'

export interface DragSelection {
  roomId: string
  startDate: string
  endDate: string
}

export const DAY_COL_WIDTH = 36
export const LABEL_COL_WIDTH = 240
export const LABEL_COL_COLLAPSED = 40

interface CalendarGridProps {
  rooms: Room[]
  days: Date[]
  bookings: Booking[]
  icalBlocks: ICalBlock[]
  overrideMap: OverrideMap
  tasks: CalendarTask[]
  selection: DragSelection | null
  onSelectionChange: (sel: DragSelection | null) => void
  onCellClick: (roomId: string, date: string) => void
  onBookingClick: (booking: Booking) => void
  onTaskClick: (task: CalendarTask) => void
  onAddTask: (roomId: string | null, date: string) => void
  onAddPropertyTask: (propertyId: string, date: string) => void
  onSmartPricingClick?: (roomId: string) => void
  viewMode?: 'bookings' | 'tasks'
  labelCollapsed?: boolean
  onToggleLabelCollapse?: () => void
  today: string
}

type CellStatus = 'available' | 'booked-first' | 'booked-cont' | 'blocked' | 'ical' | 'selected' | 'advance-blocked'

function isAdvanceBlocked(room: Room, dateStr: string, todayStr: string): boolean {
  const maxDays = room.max_advance_booking_days
  if (maxDays == null) return false
  const today = new Date(todayStr + 'T00:00:00')
  today.setDate(today.getDate() + maxDays)
  return dateStr > format(today, 'yyyy-MM-dd')
}

function getCellStatus(
  roomId: string,
  dateStr: string,
  bookings: Booking[],
  icalBlocks: ICalBlock[],
  overrideMap: OverrideMap,
  selection: DragSelection | null,
): CellStatus {
  if (
    selection &&
    selection.roomId === roomId &&
    dateStr >= selection.startDate &&
    dateStr <= selection.endDate
  ) {
    return 'selected'
  }

  const booking = bookings.find(
    (b) =>
      b.room_id === roomId &&
      dateStr >= b.check_in &&
      dateStr < b.check_out &&
      (b.status === 'confirmed' || b.status === 'pending'),
  )
  if (booking) {
    return dateStr === booking.check_in ? 'booked-first' : 'booked-cont'
  }

  const ical = icalBlocks.find(
    (b) => b.room_id === roomId && dateStr >= b.start_date && dateStr < b.end_date,
  )
  if (ical) return 'ical'

  const override = overrideMap[roomId]?.[dateStr]
  if (override?.is_blocked) return 'blocked'

  return 'available'
}

function getCellStyle(status: CellStatus): React.CSSProperties {
  switch (status) {
    case 'booked-first':
    case 'booked-cont':
      return {
        background: 'rgba(45,212,191,0.14)',
        borderTop: status === 'booked-first' ? '2px solid #2DD4BF' : '2px solid rgba(45,212,191,0.4)',
      }
    case 'blocked':
      return { background: 'rgba(100,116,139,0.10)', borderTop: '2px solid #CBD5E1' }
    case 'advance-blocked':
      return {
        background: 'repeating-linear-gradient(-45deg, rgba(148,163,184,0.10), rgba(148,163,184,0.10) 3px, rgba(203,213,225,0.18) 3px, rgba(203,213,225,0.18) 7px)',
      }
    case 'ical':
      return { background: 'rgba(45,212,191,0.07)' }
    case 'selected':
      return {
        background: 'rgba(45,212,191,0.28)',
        outline: '2px solid #2DD4BF',
        outlineOffset: '-2px',
      }
    default:
      return {}
  }
}

function CellContent({
  status,
  roomId,
  dateStr,
  bookings,
  room,
  overrideMap,
}: {
  status: CellStatus
  roomId: string
  dateStr: string
  bookings: Booking[]
  room: Room
  overrideMap: OverrideMap
}) {
  if (status === 'booked-first') {
    const booking = bookings.find(
      (b) => b.room_id === roomId && b.check_in === dateStr,
    )
    if (!booking) return null
    return (
      <span className="text-[10px] font-semibold max-w-full truncate" style={{ color: '#0F766E' }}>
        {booking.guest_first_name} {booking.guest_last_name}
      </span>
    )
  }
  if (status === 'blocked') {
    return <span className="text-[11px] text-slate-400">–</span>
  }
  if (status === 'advance-blocked') {
    const override = overrideMap[roomId]?.[dateStr]
    const price = override?.price_override ?? room.nightly_rate
    const isFriSat = getDay(new Date(dateStr + 'T00:00:00')) === 5 || getDay(new Date(dateStr + 'T00:00:00')) === 6
    return (
      <span
        className="text-[9px] font-semibold leading-none"
        style={{ color: '#0F172A' }}
      >
        ${price}
      </span>
    )
  }
  if (status === 'ical') {
    return <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: '#2DD4BF' }} />
  }
  if (status === 'available' || status === 'selected') {
    const override = overrideMap[roomId]?.[dateStr]
    const price = override?.price_override ?? room.nightly_rate
    const isFriSat = getDay(new Date(dateStr + 'T00:00:00')) === 5 || getDay(new Date(dateStr + 'T00:00:00')) === 6
    return (
      <span
        className="text-[9px] font-semibold leading-none"
        style={{ color: isFriSat ? '#D97706' : '#0F766E' }}
      >
        ${price}
      </span>
    )
  }
  return null
}

export function CalendarGrid({
  rooms,
  days,
  bookings,
  icalBlocks,
  overrideMap,
  tasks,
  selection,
  onSelectionChange,
  onCellClick,
  onBookingClick,
  onTaskClick,
  onAddTask,
  onAddPropertyTask,
  onSmartPricingClick,
  viewMode = 'bookings',
  labelCollapsed = false,
  onToggleLabelCollapse,
  today,
}: CalendarGridProps) {
  const dragging = useRef(false)
  const dragStartDate = useRef<string | null>(null)
  const dragRoomId = useRef<string | null>(null)

  const handleMouseDown = useCallback(
    (roomId: string, dateStr: string, status: CellStatus) => {
      if (status === 'booked-first' || status === 'booked-cont' || status === 'ical') return
      dragging.current = true
      dragStartDate.current = dateStr
      dragRoomId.current = roomId
      onSelectionChange({ roomId, startDate: dateStr, endDate: dateStr })
    },
    [onSelectionChange],
  )

  const handleMouseEnter = useCallback(
    (roomId: string, dateStr: string) => {
      if (!dragging.current || dragRoomId.current !== roomId) return
      const start = dragStartDate.current!
      const [s, e] = start <= dateStr ? [start, dateStr] : [dateStr, start]
      onSelectionChange({ roomId, startDate: s, endDate: e })
    },
    [onSelectionChange],
  )

  const handleMouseUp = useCallback(
    (roomId: string, dateStr: string) => {
      if (!dragging.current) return
      const wasDrag =
        selection &&
        (selection.startDate !== selection.endDate || selection.startDate !== dateStr)
      dragging.current = false
      if (!wasDrag) {
        onSelectionChange(null)
        onCellClick(roomId, dateStr)
      }
    },
    [selection, onSelectionChange, onCellClick],
  )

  const handleMouseLeaveTable = useCallback(() => {
    if (dragging.current) {
      dragging.current = false
      onSelectionChange(null)
    }
  }, [onSelectionChange])

  useEffect(() => {
    const cancel = () => {
      if (dragging.current) {
        dragging.current = false
        onSelectionChange(null)
      }
    }
    window.addEventListener('mouseup', cancel)
    return () => window.removeEventListener('mouseup', cancel)
  }, [onSelectionChange])

  const propertiesWithRooms = useMemo(() => {
    const map = new Map<string, { id: string; name: string; rooms: Room[] }>()
    for (const room of rooms) {
      const pid = room.property?.id ?? '__none__'
      const pname = room.property?.name ?? 'Property'
      if (!map.has(pid)) map.set(pid, { id: pid, name: pname, rooms: [] })
      map.get(pid)!.rooms.push(room)
    }
    return Array.from(map.values())
  }, [rooms])

  const occupancyByDate = useMemo(() => {
    if (viewMode === 'tasks') return {} as Record<string, number>
    const map: Record<string, number> = {}
    for (const day of days) {
      const ds = format(day, 'yyyy-MM-dd')
      let count = 0
      for (const room of rooms) {
        const status = getCellStatus(room.id, ds, bookings, icalBlocks, overrideMap, null)
        if (status === 'booked-first' || status === 'booked-cont' || status === 'ical') count++
      }
      map[ds] = count
    }
    return map
  }, [days, rooms, bookings, icalBlocks, overrideMap, viewMode])

  const monthGroups = useMemo(() => {
    const groups: { yearMonth: string; count: number }[] = []
    for (const day of days) {
      const ym = format(day, 'yyyy-MM')
      const last = groups[groups.length - 1]
      if (last?.yearMonth === ym) {
        last.count++
      } else {
        groups.push({ yearMonth: ym, count: 1 })
      }
    }
    return groups
  }, [days])

  const todayStr = today
  const todayIdx = days.findIndex(d => format(d, 'yyyy-MM-dd') === todayStr)
  const labelWidth = labelCollapsed ? LABEL_COL_COLLAPSED : LABEL_COL_WIDTH
  const tableWidth = labelWidth + days.length * DAY_COL_WIDTH

  return (
    <table
      className="border-collapse select-none"
      style={{ tableLayout: 'fixed', width: tableWidth, minWidth: tableWidth }}
      onMouseLeave={handleMouseLeaveTable}
    >
      <colgroup>
        <col style={{ width: labelWidth }} />
        {days.map((_, i) => <col key={i} style={{ width: DAY_COL_WIDTH }} />)}
      </colgroup>

      <thead className="sticky top-0 z-30 bg-white">
        {/* Month group header */}
        <tr>
          <th
            className="sticky left-0 z-40 bg-white border-b border-r border-slate-200"
            style={{ width: labelWidth, padding: 0 }}
          />
          {monthGroups.map(({ yearMonth, count }) => (
            <th
              key={yearMonth}
              colSpan={count}
              className="border-b border-l border-slate-200 bg-slate-50 text-left text-[11px] font-semibold text-slate-500 px-2 py-1 whitespace-nowrap overflow-hidden"
              style={{ position: 'sticky', left: labelWidth, zIndex: 19 }}
            >
              {format(new Date(yearMonth + '-01T00:00:00'), 'MMMM yyyy')}
            </th>
          ))}
        </tr>

        {/* Occupancy heatbar — hidden in task view */}
        <tr>
          <td className="sticky left-0 z-40 bg-white" style={{ width: labelWidth, height: 4, padding: 0 }} />
          {days.map((day) => {
            const ds = format(day, 'yyyy-MM-dd')
            if (viewMode === 'tasks') {
              return <td key={ds} style={{ height: 4, padding: 0, background: 'white' }} />
            }
            const occ = rooms.length > 0 ? (occupancyByDate[ds] ?? 0) / rooms.length : 0
            let bg = 'rgba(45,212,191,0.25)'
            if (occ >= 0.8) bg = '#EF4444'
            else if (occ >= 0.5) bg = '#F59E0B'
            return (
              <td
                key={ds}
                title={`${Math.round(occ * 100)}% occupied`}
                style={{ height: 4, padding: 0, background: bg }}
              />
            )
          })}
        </tr>

        {/* Day header */}
        <tr>
          <th
            className="sticky left-0 z-40 bg-white border-b border-r border-slate-200"
            style={{ width: labelWidth, padding: 0 }}
          >
            <button
              type="button"
              onClick={onToggleLabelCollapse}
              className="w-full h-full flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-500 hover:text-teal-600 transition-colors"
              title={labelCollapsed ? 'Expand room column' : 'Collapse room column'}
            >
              {labelCollapsed ? (
                <ChevronRightIcon className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <>
                  <ChevronLeftIcon className="w-3 h-3 shrink-0" />
                  <span>Room</span>
                </>
              )}
            </button>
          </th>
          {days.map((day) => {
            const ds = format(day, 'yyyy-MM-dd')
            const isSun = getDay(day) === 0
            const isFriSat = getDay(day) === 5 || getDay(day) === 6
            const todayDay = ds === todayStr
            return (
              <th
                key={ds}
                className={clsx(
                  'border-b border-slate-200 text-center',
                  isSun && 'border-l border-slate-200',
                  !isFriSat && !todayDay && 'bg-white',
                  isFriSat && 'bg-amber-50',
                  todayDay && 'bg-teal-100',
                )}
                style={{ padding: '3px 0', width: DAY_COL_WIDTH }}
              >
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-[8px] text-slate-400 uppercase leading-none">
                    {format(day, 'EEE').slice(0, 2)}
                  </span>
                  <span
                    className={clsx(
                      'text-[11px] font-semibold w-5 h-5 flex items-center justify-center rounded-full leading-none',
                      todayDay ? 'text-white' : 'text-slate-700',
                    )}
                    style={todayDay ? { background: '#2DD4BF' } : {}}
                  >
                    {format(day, 'd')}
                  </span>
                </div>
              </th>
            )
          })}
        </tr>
      </thead>

      <tbody>
        {propertiesWithRooms.map(({ id: propId, name: propName, rooms: propRooms }) => (
          <React.Fragment key={propId}>
            {/* Property header row — always visible */}
            <CalendarTaskRow
              label={`🏠 ${propName}`}
              tasks={tasks.filter((t) => t.property_id === propId && !t.room_id)}
              days={days}
              onTaskClick={onTaskClick}
              onAddClick={(date) => onAddPropertyTask(propId, date)}
              isPropertyRow
              labelWidth={labelWidth}
            />

            {propRooms.map((room) => {
              const roomTasks = tasks.filter((t) => t.room_id === room.id)

              return (
                <React.Fragment key={room.id}>
                  <tr className="border-b border-slate-100 group">
                    {/* Label cell */}
                    <td
                      className="sticky left-0 z-20 border-r border-slate-200"
                      style={{ width: labelWidth, background: '#ffffff', padding: labelCollapsed ? 0 : '4px 8px' }}
                    >
                      {labelCollapsed ? (
                        <div className="flex items-center justify-center h-full py-1">
                          <span
                            className="text-[11px] font-bold leading-none"
                            style={{ color: '#2DD4BF' }}
                            title={room.name}
                          >
                            {room.name.match(/\d+/)?.[0] ?? room.name.slice(0, 3).toUpperCase()}
                          </span>
                        </div>
                      ) : (
                        <>
                          <span
                            className="flex items-center gap-1 text-xs font-semibold truncate w-full text-left"
                            style={{ color: '#2DD4BF' }}
                            title={room.name}
                          >
                            <HomeIcon className="shrink-0 w-3 h-3" />
                            {room.name}
                            {room.smart_pricing_enabled && (
                              <span title="Smart Pricing enabled" className="text-amber-500 shrink-0">⚡</span>
                            )}
                          </span>
                          <span className="text-[10px] text-slate-400 block truncate" title={room.property?.name ?? ''}>
                            {room.property?.name ?? ''}
                          </span>
                          {viewMode === 'bookings' && (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] text-slate-400">
                                ${room.nightly_rate}/night
                              </span>
                              {onSmartPricingClick && (
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); onSmartPricingClick(room.id) }}
                                  className="text-[10px] text-teal-500 hover:text-teal-700 font-medium transition-colors"
                                  title="Smart Pricing settings"
                                >
                                  ⚡ Pricing
                                </button>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </td>

                    {/* Task view cells */}
                    {viewMode === 'tasks' && days.map((day) => {
                      const ds = format(day, 'yyyy-MM-dd')
                      const isSun = getDay(day) === 0
                      const todayCell = ds === todayStr
                      const dayTasks = roomTasks.filter((t) => t.due_date === ds)

                      if (dayTasks.length > 0) {
                        const firstTask = dayTasks[0]
                        const taskColor = firstTask.color ?? '#6366F1'
                        return (
                          <td
                            key={ds}
                            onClick={() => onTaskClick(firstTask)}
                            className={clsx(
                              'group/cell relative cursor-pointer',
                              isSun && 'border-l border-slate-200',
                            )}
                            title={dayTasks.map((t) => t.title).join(', ')}
                            style={{
                              height: 36,
                              verticalAlign: 'middle',
                              background: `${taskColor}22`,
                              borderTop: `2px solid ${taskColor}`,
                              padding: 0,
                            }}
                          >
                            <div
                              className="absolute inset-0 opacity-0 group-hover/cell:opacity-100 transition-opacity duration-100 pointer-events-none"
                              style={{ background: 'rgba(45,212,191,0.18)' }}
                            />
                            <div className="relative z-10 flex flex-col items-center justify-center h-full gap-0.5 px-0.5">
                              {dayTasks.length === 1 ? (
                                <span className="block w-2 h-2 rounded-full" style={{ background: taskColor }} />
                              ) : dayTasks.length === 2 ? (
                                <>
                                  <span className="block w-2 h-2 rounded-full" style={{ background: dayTasks[0].color ?? '#6366F1' }} />
                                  <span className="block w-2 h-2 rounded-full" style={{ background: dayTasks[1].color ?? '#6366F1' }} />
                                </>
                              ) : (
                                <>
                                  <span className="block w-2 h-2 rounded-full" style={{ background: taskColor }} />
                                  <span className="text-[8px] font-bold leading-none" style={{ color: taskColor }}>
                                    +{dayTasks.length - 1}
                                  </span>
                                </>
                              )}
                            </div>
                          </td>
                        )
                      }

                      return (
                        <td
                          key={ds}
                          onClick={() => onAddTask(room.id, ds)}
                          className={clsx(
                            'group/cell relative cursor-cell',
                            isSun && 'border-l border-slate-200',
                            todayCell && 'bg-teal-100',
                          )}
                          style={{ height: 36, verticalAlign: 'middle' }}
                        >
                          <div
                            className="absolute inset-0 opacity-0 group-hover/cell:opacity-100 transition-opacity duration-100 pointer-events-none"
                            style={{ background: 'rgba(45,212,191,0.18)' }}
                          />
                          <div className="relative z-10 flex items-center justify-center h-full opacity-0 group-hover/cell:opacity-100 transition-opacity duration-100">
                            <span className="text-[13px] text-slate-400 font-light leading-none">+</span>
                          </div>
                        </td>
                      )
                    })}

                    {/* Booking view cells */}
                    {viewMode === 'bookings' && (() => {
                      const cells: React.ReactNode[] = []
                      let i = 0
                      while (i < days.length) {
                        const day = days[i]
                        const ds = format(day, 'yyyy-MM-dd')
                        const isFriSat = getDay(day) === 5 || getDay(day) === 6
                        const isSun = getDay(day) === 0
                        const todayCell = ds === todayStr
                        const isPastDate = ds < todayStr
                        const status = getCellStatus(room.id, ds, bookings, icalBlocks, overrideMap, selection)
                        const effectiveStatus: CellStatus =
                          status === 'available' && isAdvanceBlocked(room, ds, todayStr)
                            ? 'advance-blocked'
                            : status

                        if (
                          status === 'booked-first' ||
                          (status === 'booked-cont' && i === 0)
                        ) {
                          const booking = bookings.find(
                            (b) =>
                              b.room_id === room.id &&
                              (status === 'booked-first'
                                ? b.check_in === ds
                                : ds >= b.check_in && ds < b.check_out) &&
                              (b.status === 'confirmed' || b.status === 'pending'),
                          )
                          if (booking) {
                            let span = 0
                            for (let j = i; j < days.length; j++) {
                              if (format(days[j], 'yyyy-MM-dd') < booking.check_out) span++
                              else break
                            }
                            const isPending = booking.status === 'pending'
                            const isLongTerm = booking.booking_type === 'long_term'
                            const isActive = !isLongTerm && booking.check_in <= todayStr && booking.check_out > todayStr
                            const isPast = booking.check_out <= todayStr
                            const pillBg = isPending
                              ? 'linear-gradient(135deg, #FCD34D 0%, #F59E0B 100%)'
                              : isActive
                                ? 'linear-gradient(135deg, #86EFAC 0%, #22C55E 100%)'
                                : isPast
                                  ? 'linear-gradient(135deg, #94A3B8 0%, #64748B 100%)'
                                  : 'linear-gradient(135deg, #2DD4BF 0%, #14B8A6 50%, #0F766E 100%)'
                            const pillShadow = isPending
                              ? '0 2px 8px rgba(245,158,11,0.45), 0 1px 3px rgba(0,0,0,0.1)'
                              : isActive
                                ? '0 2px 8px rgba(34,197,94,0.4), 0 1px 3px rgba(0,0,0,0.1)'
                                : isPast
                                  ? 'none'
                                  : '0 2px 8px rgba(45,212,191,0.5), 0 1px 3px rgba(0,0,0,0.1)'
                            const labelColor = (isPast && !isActive) || isPending ? '#1E293B' : '#fff'
                            cells.push(
                              <td
                                key={ds}
                                colSpan={span}
                                onClick={() => onBookingClick(booking)}
                                className={clsx(
                                  'group/pill cursor-pointer',
                                  isSun && 'border-l border-slate-200',
                                )}
                                style={{
                                  height: 36,
                                  verticalAlign: 'middle',
                                  position: 'relative',
                                  clipPath: 'inset(0)',
                                  background: 'transparent',
                                  padding: 0,
                                }}
                              >
                                {/* Pill background */}
                                <div style={{
                                  position: 'absolute',
                                  inset: '4px 2px',
                                  borderRadius: 9999,
                                  background: pillBg,
                                  boxShadow: pillShadow,
                                  pointerEvents: 'none',
                                  transition: 'filter 120ms ease',
                                }} className="group-hover/pill:brightness-110" />
                                {/* Hover sheen */}
                                <div
                                  className="absolute opacity-0 group-hover/pill:opacity-100 transition-opacity duration-100 pointer-events-none"
                                  style={{ inset: '4px 2px', borderRadius: 9999, background: 'rgba(255,255,255,0.14)' }}
                                />
                                {/* Today marker */}
                                {todayIdx >= 0 && todayIdx >= i && todayIdx < i + span && (
                                  <div
                                    aria-hidden
                                    style={{
                                      position: 'absolute',
                                      top: 4,
                                      bottom: 4,
                                      left: (todayIdx - i) * DAY_COL_WIDTH + DAY_COL_WIDTH / 2 - 1,
                                      width: 2,
                                      background: 'rgba(255,255,255,0.65)',
                                      borderRadius: 1,
                                      zIndex: 1,
                                      pointerEvents: 'none',
                                    }}
                                  />
                                )}
                                {/* Task dots */}
                                {Array.from({ length: span }, (_, offset) => {
                                  const colDate = format(days[i + offset], 'yyyy-MM-dd')
                                  const dateTasks = roomTasks.filter(t => t.due_date === colDate)
                                  if (dateTasks.length === 0) return null
                                  const firstTask = dateTasks[0]
                                  const tooltip = dateTasks.map(t => t.title).join('\n')
                                  return (
                                    <div
                                      key={offset}
                                      role="button"
                                      title={tooltip}
                                      onClick={(e) => { e.stopPropagation(); onTaskClick(firstTask) }}
                                      style={{
                                        position: 'absolute',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        left: offset * DAY_COL_WIDTH + (DAY_COL_WIDTH - 16) / 2,
                                        width: 16,
                                        height: 16,
                                        borderRadius: '50%',
                                        background: '#EF4444',
                                        zIndex: 4,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                      }}
                                    >
                                      <span style={{ color: '#fff', fontSize: 9, fontWeight: 700, lineHeight: 1, pointerEvents: 'none' }}>
                                        {dateTasks.length > 9 ? '9+' : dateTasks.length}
                                      </span>
                                    </div>
                                  )
                                })}
                                {/* Sticky name */}
                                <div style={{
                                  position: 'sticky',
                                  left: labelWidth + 6,
                                  width: 'max-content',
                                  maxWidth: 180,
                                  height: '100%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  paddingLeft: 6,
                                  zIndex: 2,
                                  pointerEvents: 'none',
                                }}>
                                  <span style={{
                                    color: labelColor,
                                    fontSize: 10,
                                    fontWeight: 700,
                                    fontFamily: 'var(--font-manrope, sans-serif)',
                                    maxWidth: 160,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    display: 'block',
                                    textShadow: isPastDate || isPending ? 'none' : '0 1px 2px rgba(0,0,0,0.15)',
                                  }}>
                                    {booking.guest_first_name} {booking.guest_last_name}
                                  </span>
                                </div>
                              </td>,
                            )
                            i += span
                            continue
                          }
                        }

                        if (status === 'ical') {
                          const block = icalBlocks.find(
                            (b) =>
                              b.room_id === room.id &&
                              (b.start_date === ds || (i === 0 && ds >= b.start_date && ds < b.end_date)),
                          )
                          if (block) {
                            let span = 0
                            for (let j = i; j < days.length; j++) {
                              if (format(days[j], 'yyyy-MM-dd') < block.end_date) span++
                              else break
                            }
                            const isICalActive = block.start_date <= todayStr && block.end_date > todayStr
                            const isICalPast = block.end_date <= todayStr
                            const icalPillBg = isICalActive
                              ? 'linear-gradient(135deg, #86EFAC 0%, #22C55E 100%)'
                              : isICalPast
                                ? 'linear-gradient(135deg, #CBD5E1 0%, #94A3B8 100%)'
                                : 'linear-gradient(135deg, #A5B4FC 0%, #6366F1 100%)'
                            const icalShadow = isICalActive
                              ? '0 2px 8px rgba(34,197,94,0.4), 0 1px 3px rgba(0,0,0,0.1)'
                              : isICalPast
                                ? 'none'
                                : '0 2px 8px rgba(99,102,241,0.4), 0 1px 3px rgba(0,0,0,0.1)'
                            const icalLabelColor = isICalPast ? '#475569' : '#fff'
                            cells.push(
                              <td
                                key={ds}
                                colSpan={span}
                                className={clsx(
                                  'group/pill',
                                  isSun && 'border-l border-slate-200',
                                )}
                                style={{
                                  height: 36,
                                  verticalAlign: 'middle',
                                  position: 'relative',
                                  clipPath: 'inset(0)',
                                  background: 'transparent',
                                  padding: 0,
                                }}
                              >
                                {/* Pill background */}
                                <div style={{
                                  position: 'absolute',
                                  inset: '4px 2px',
                                  borderRadius: 9999,
                                  background: icalPillBg,
                                  boxShadow: icalShadow,
                                  pointerEvents: 'none',
                                  transition: 'filter 120ms ease',
                                }} className="group-hover/pill:brightness-110" />
                                {/* Hover sheen */}
                                <div
                                  className="absolute opacity-0 group-hover/pill:opacity-100 transition-opacity duration-100 pointer-events-none"
                                  style={{ inset: '4px 2px', borderRadius: 9999, background: 'rgba(255,255,255,0.14)' }}
                                />
                                {/* Today marker */}
                                {todayIdx >= 0 && todayIdx >= i && todayIdx < i + span && (
                                  <div
                                    aria-hidden
                                    style={{
                                      position: 'absolute',
                                      top: 4,
                                      bottom: 4,
                                      left: (todayIdx - i) * DAY_COL_WIDTH + DAY_COL_WIDTH / 2 - 1,
                                      width: 2,
                                      background: 'rgba(255,255,255,0.65)',
                                      borderRadius: 1,
                                      zIndex: 1,
                                      pointerEvents: 'none',
                                    }}
                                  />
                                )}
                                {/* Task dots */}
                                {Array.from({ length: span }, (_, offset) => {
                                  const colDate = format(days[i + offset], 'yyyy-MM-dd')
                                  const dateTasks = roomTasks.filter(t => t.due_date === colDate)
                                  if (dateTasks.length === 0) return null
                                  const firstTask = dateTasks[0]
                                  const tooltip = dateTasks.map(t => t.title).join('\n')
                                  return (
                                    <div
                                      key={offset}
                                      role="button"
                                      title={tooltip}
                                      onClick={(e) => { e.stopPropagation(); onTaskClick(firstTask) }}
                                      style={{
                                        position: 'absolute',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        left: offset * DAY_COL_WIDTH + (DAY_COL_WIDTH - 16) / 2,
                                        width: 16,
                                        height: 16,
                                        borderRadius: '50%',
                                        background: '#EF4444',
                                        zIndex: 4,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                      }}
                                    >
                                      <span style={{ color: '#fff', fontSize: 9, fontWeight: 700, lineHeight: 1, pointerEvents: 'none' }}>
                                        {dateTasks.length > 9 ? '9+' : dateTasks.length}
                                      </span>
                                    </div>
                                  )
                                })}
                                {/* Label */}
                                <div style={{
                                  position: 'sticky',
                                  left: labelWidth + 6,
                                  width: 'max-content',
                                  maxWidth: 180,
                                  height: '100%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  paddingLeft: 6,
                                  gap: 4,
                                  zIndex: 2,
                                  pointerEvents: 'none',
                                }}>
                                  <span style={{
                                    color: icalLabelColor,
                                    fontSize: 10,
                                    fontWeight: 700,
                                    fontFamily: 'var(--font-manrope, sans-serif)',
                                    maxWidth: 160,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    display: 'block',
                                    textShadow: isPastDate ? 'none' : '0 1px 2px rgba(0,0,0,0.15)',
                                  }}>
                                    {block.summary || block.platform}
                                  </span>
                                </div>
                              </td>,
                            )
                            i += span
                            continue
                          }
                        }

                        const cellStyle = getCellStyle(effectiveStatus)
                        cells.push(
                          <td
                            key={ds}
                            onMouseDown={() => handleMouseDown(room.id, ds, effectiveStatus)}
                            onMouseEnter={() => handleMouseEnter(room.id, ds)}
                            onMouseUp={() => handleMouseUp(room.id, ds)}
                            className={clsx(
                              'group/cell relative border-r border-slate-100 text-center cursor-pointer transition-colors',
                              isFriSat && effectiveStatus === 'available' && 'bg-amber-50/40',
                              isSun && 'border-l border-slate-200',
                              todayCell && effectiveStatus === 'available' && 'bg-teal-100',
                            )}
                            style={{
                              height: 36,
                              verticalAlign: 'middle',
                              ...cellStyle,
                              ...(isPastDate && effectiveStatus === 'available'
                                ? { background: 'rgba(203,213,225,0.25)' }
                                : {}),
                            }}
                          >
                            {/* Full-cell teal overlay on hover */}
                            <div
                              className="absolute inset-0 opacity-0 group-hover/cell:opacity-100 transition-opacity duration-100 pointer-events-none"
                              style={{ background: 'rgba(45,212,191,0.18)' }}
                            />
                            {/* Task dot */}
                            {(() => {
                              const dateTasks = roomTasks.filter(t => t.due_date === ds)
                              if (dateTasks.length === 0) return null
                              const firstTask = dateTasks[0]
                              const tooltip = dateTasks.map(t => t.title).join('\n')
                              return (
                                <div
                                  role="button"
                                  title={tooltip}
                                  onClick={(e) => { e.stopPropagation(); onTaskClick(firstTask) }}
                                  style={{
                                    position: 'absolute',
                                    top: '50%',
                                    left: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    width: 16,
                                    height: 16,
                                    borderRadius: '50%',
                                    background: '#EF4444',
                                    zIndex: 4,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  <span style={{ color: '#fff', fontSize: 9, fontWeight: 700, lineHeight: 1, pointerEvents: 'none' }}>
                                    {dateTasks.length > 9 ? '9+' : dateTasks.length}
                                  </span>
                                </div>
                              )
                            })()}
                            <div className="relative z-10 flex items-center justify-center h-full">
                              <CellContent
                                status={effectiveStatus}
                                roomId={room.id}
                                dateStr={ds}
                                bookings={bookings}
                                room={room}
                                overrideMap={overrideMap}
                              />
                            </div>
                          </td>,
                        )
                        i++
                      }
                      return cells
                    })()}
                  </tr>

                  {/* Room task sub-row removed — task view shows chips in main row; booking view shows no tasks */}
                </React.Fragment>
              )
            })}
          </React.Fragment>
        ))}
      </tbody>
    </table>
  )
}
