// components/admin/CalendarGrid.tsx
'use client'

import React, { useRef, useCallback } from 'react'
import { format, isToday, getDay } from 'date-fns'
import { clsx } from 'clsx'
import type { Room, Booking, ICalBlock, DateOverride, CalendarTask } from '@/types'
import { CalendarTaskRow } from './CalendarTaskRow'
import type { OverrideMap } from '@/hooks/useDateOverrides'

export interface DragSelection {
  roomId: string
  startDate: string
  endDate: string
}

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
  onRoomNameClick: (room: Room) => void
  onTaskClick: (task: CalendarTask) => void
  onAddTask: (roomId: string | null, date: string) => void
}

const LABEL_COL_WIDTH = 180
const CELL_WIDTH = 38

type CellStatus = 'available' | 'booked-first' | 'booked-cont' | 'blocked' | 'ical' | 'selected'

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
    const initials = `${booking.guest_first_name[0] ?? ''}${booking.guest_last_name[0] ?? ''}`.toUpperCase()
    return (
      <span className="text-[10px] font-bold" style={{ color: '#0F766E' }}>
        {initials}
      </span>
    )
  }
  if (status === 'blocked') {
    return <span className="text-[11px] text-slate-400">–</span>
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
  onRoomNameClick,
  onTaskClick,
  onAddTask,
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
    dragging.current = false
  }, [])

  const propertyTasks = tasks.filter((t) => t.room_id === null)

  const occupancyByDate: Record<string, number> = {}
  for (const day of days) {
    const ds = format(day, 'yyyy-MM-dd')
    let count = 0
    for (const room of rooms) {
      const status = getCellStatus(room.id, ds, bookings, icalBlocks, overrideMap, null)
      if (status === 'booked-first' || status === 'booked-cont') count++
    }
    occupancyByDate[ds] = count
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
      {/* Occupancy heatbar */}
      <div className="flex sticky top-0 z-20 bg-white border-b border-slate-100" style={{ minWidth: LABEL_COL_WIDTH + days.length * CELL_WIDTH }}>
        <div style={{ width: LABEL_COL_WIDTH, minWidth: LABEL_COL_WIDTH }} />
        {days.map((day) => {
          const ds = format(day, 'yyyy-MM-dd')
          const occ = rooms.length > 0 ? (occupancyByDate[ds] ?? 0) / rooms.length : 0
          let bg = 'rgba(45,212,191,0.25)'
          if (occ >= 0.8) bg = '#EF4444'
          else if (occ >= 0.5) bg = '#F59E0B'
          return (
            <div
              key={ds}
              title={`${Math.round(occ * 100)}% occupied`}
              style={{ width: CELL_WIDTH, minWidth: CELL_WIDTH, height: 5, background: bg }}
            />
          )
        })}
      </div>

      <table
        className="border-collapse select-none"
        style={{ minWidth: LABEL_COL_WIDTH + days.length * CELL_WIDTH }}
        onMouseLeave={handleMouseLeaveTable}
      >
        {/* Header row */}
        <thead className="sticky top-5 z-20 bg-white">
          <tr>
            <th
              className="sticky left-0 z-30 bg-white border-b border-r border-slate-200 text-left px-3 py-2 text-xs font-semibold text-slate-500"
              style={{ width: LABEL_COL_WIDTH, minWidth: LABEL_COL_WIDTH }}
            >
              Room
            </th>
            {days.map((day) => {
              const ds = format(day, 'yyyy-MM-dd')
              const isSun = getDay(day) === 0
              const isFriSat = getDay(day) === 5 || getDay(day) === 6
              const todayDay = isToday(day)
              return (
                <th
                  key={ds}
                  className={clsx(
                    'border-b border-slate-100 text-center',
                    isSun && 'border-l border-slate-200',
                    isFriSat && 'bg-amber-50',
                  )}
                  style={{ width: CELL_WIDTH, minWidth: CELL_WIDTH, padding: '4px 0' }}
                >
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-[9px] text-slate-400 uppercase">
                      {format(day, 'EEE').slice(0, 2)}
                    </span>
                    <span
                      className={clsx(
                        'text-xs font-semibold w-5 h-5 flex items-center justify-center rounded-full',
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
          {/* Property tasks row */}
          <CalendarTaskRow
            label="📋 Property Tasks"
            tasks={propertyTasks}
            days={days}
            cellWidth={CELL_WIDTH}
            labelColWidth={LABEL_COL_WIDTH}
            onTaskClick={onTaskClick}
            onAddClick={() => onAddTask(null, format(days[0], 'yyyy-MM-dd'))}
          />

          {rooms.map((room) => {
            const roomTasks = tasks.filter((t) => t.room_id === room.id)

            return (
              <React.Fragment key={room.id}>
                {/* Booking / availability row */}
                <tr className="border-b border-slate-100 group">
                  {/* Room label */}
                  <td
                    className="sticky left-0 z-10 bg-white border-r border-slate-200 px-2 py-1"
                    style={{ width: LABEL_COL_WIDTH, minWidth: LABEL_COL_WIDTH }}
                  >
                    <button
                      type="button"
                      onClick={() => onRoomNameClick(room)}
                      className="text-xs font-semibold truncate block w-full text-left hover:underline"
                      style={{ color: '#2DD4BF' }}
                    >
                      {room.name}
                    </button>
                    <span className="text-[10px] text-slate-400 block truncate">
                      {room.property?.name ?? ''}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      ${room.nightly_rate}/night
                    </span>
                  </td>

                  {/* Day cells */}
                  {days.map((day) => {
                    const ds = format(day, 'yyyy-MM-dd')
                    const isFriSat = getDay(day) === 5 || getDay(day) === 6
                    const isSun = getDay(day) === 0
                    const status = getCellStatus(room.id, ds, bookings, icalBlocks, overrideMap, selection)
                    const cellStyle = getCellStyle(status)

                    return (
                      <td
                        key={ds}
                        onMouseDown={() => handleMouseDown(room.id, ds, status)}
                        onMouseEnter={() => handleMouseEnter(room.id, ds)}
                        onMouseUp={() => handleMouseUp(room.id, ds)}
                        className={clsx(
                          'border-slate-100 text-center cursor-pointer transition-colors',
                          isFriSat && status === 'available' && 'bg-amber-50/40',
                          isSun && 'border-l border-slate-200',
                        )}
                        style={{
                          width: CELL_WIDTH,
                          minWidth: CELL_WIDTH,
                          height: 36,
                          verticalAlign: 'middle',
                          ...cellStyle,
                        }}
                      >
                        <div className="flex items-center justify-center h-full">
                          <CellContent
                            status={status}
                            roomId={room.id}
                            dateStr={ds}
                            bookings={bookings}
                            room={room}
                            overrideMap={overrideMap}
                          />
                        </div>
                      </td>
                    )
                  })}
                </tr>

                {/* Task sub-row */}
                <CalendarTaskRow
                  label={`↳ ${room.name} Tasks`}
                  tasks={roomTasks}
                  days={days}
                  cellWidth={CELL_WIDTH}
                  labelColWidth={LABEL_COL_WIDTH}
                  onTaskClick={onTaskClick}
                  onAddClick={() => onAddTask(room.id, format(days[0], 'yyyy-MM-dd'))}
                />
              </React.Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
