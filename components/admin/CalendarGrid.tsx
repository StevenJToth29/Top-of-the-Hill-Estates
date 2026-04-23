// components/admin/CalendarGrid.tsx
'use client'

import React, { useRef, useCallback, useMemo, useEffect } from 'react'
import { format, isToday, getDay } from 'date-fns'
import { clsx } from 'clsx'
import { HomeIcon } from '@heroicons/react/16/solid'
import type { Room, Booking, ICalBlock, CalendarTask } from '@/types'
import { CalendarTaskRow } from './CalendarTaskRow'
import type { OverrideMap } from '@/hooks/useDateOverrides'

export interface DragSelection {
  roomId: string
  startDate: string
  endDate: string
}

export const DAY_COL_WIDTH = 36
export const LABEL_COL_WIDTH = 200

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
}

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
    return (
      <span className="text-[10px] font-semibold max-w-full truncate" style={{ color: '#0F766E' }}>
        {booking.guest_first_name} {booking.guest_last_name}
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
  onBookingClick,
  onTaskClick,
  onAddTask,
  onAddPropertyTask,
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
    const map: Record<string, number> = {}
    for (const day of days) {
      const ds = format(day, 'yyyy-MM-dd')
      let count = 0
      for (const room of rooms) {
        const status = getCellStatus(room.id, ds, bookings, icalBlocks, overrideMap, null)
        if (status === 'booked-first' || status === 'booked-cont') count++
      }
      map[ds] = count
    }
    return map
  }, [days, rooms, bookings, icalBlocks, overrideMap])

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

  const tableWidth = LABEL_COL_WIDTH + days.length * DAY_COL_WIDTH

  return (
    <table
      className="border-collapse select-none"
      style={{ tableLayout: 'fixed', width: tableWidth, minWidth: tableWidth }}
      onMouseLeave={handleMouseLeaveTable}
    >
      <colgroup>
        <col style={{ width: LABEL_COL_WIDTH }} />
        {days.map((_, i) => <col key={i} style={{ width: DAY_COL_WIDTH }} />)}
      </colgroup>

      <thead className="sticky top-0 z-20 bg-white">
        {/* Month group header */}
        <tr>
          <th
            className="sticky left-0 z-30 bg-white border-b border-r border-slate-200"
            style={{ width: LABEL_COL_WIDTH, padding: 0 }}
          />
          {monthGroups.map(({ yearMonth, count }) => (
            <th
              key={yearMonth}
              colSpan={count}
              className="border-b border-l-2 border-slate-300 bg-slate-50 text-left text-[11px] font-semibold text-slate-500 px-2 py-1 whitespace-nowrap overflow-hidden"
              style={{ position: 'sticky', left: LABEL_COL_WIDTH, zIndex: 19 }}
            >
              {format(new Date(yearMonth + '-01T00:00:00'), 'MMMM yyyy')}
            </th>
          ))}
        </tr>

        {/* Occupancy heatbar */}
        <tr>
          <td style={{ width: LABEL_COL_WIDTH, height: 4, padding: 0 }} />
          {days.map((day) => {
            const ds = format(day, 'yyyy-MM-dd')
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
            className="sticky left-0 z-30 bg-white border-b border-r border-slate-200 text-left px-3 py-2 text-xs font-semibold text-slate-500"
            style={{ width: LABEL_COL_WIDTH }}
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
                  'border-b border-slate-200 text-center',
                  isSun && 'border-l-2 border-slate-300',
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
            {/* Property-level task row */}
            <CalendarTaskRow
              label={`🏠 ${propName}`}
              tasks={tasks.filter((t) => t.property_id === propId && !t.room_id)}
              days={days}
              onTaskClick={onTaskClick}
              onAddClick={(date) => onAddPropertyTask(propId, date)}
              isPropertyRow
            />

            {propRooms.map((room) => {
              const roomTasks = tasks.filter((t) => t.room_id === room.id)

              return (
                <React.Fragment key={room.id}>
                  <tr className="border-b border-slate-200 group">
                    <td
                      className="sticky left-0 z-10 bg-white border-r border-slate-200 px-2 py-1"
                      style={{ width: LABEL_COL_WIDTH }}
                    >
                      <span
                        className="flex items-center gap-1 text-xs font-semibold truncate w-full text-left"
                        style={{ color: '#2DD4BF' }}
                      >
                        <HomeIcon className="shrink-0 w-3 h-3" />
                        {room.name}
                      </span>
                      <span className="text-[10px] text-slate-400 block truncate">
                        {room.property?.name ?? ''}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        ${room.nightly_rate}/night
                      </span>
                    </td>

                    {(() => {
                      const cells: React.ReactNode[] = []
                      let i = 0
                      while (i < days.length) {
                        const day = days[i]
                        const ds = format(day, 'yyyy-MM-dd')
                        const isFriSat = getDay(day) === 5 || getDay(day) === 6
                        const isSun = getDay(day) === 0
                        const todayCell = isToday(day)
                        const status = getCellStatus(room.id, ds, bookings, icalBlocks, overrideMap, selection)

                        if (status === 'booked-first') {
                          const booking = bookings.find(
                            (b) =>
                              b.room_id === room.id &&
                              b.check_in === ds &&
                              (b.status === 'confirmed' || b.status === 'pending'),
                          )
                          if (booking) {
                            let span = 0
                            for (let j = i; j < days.length; j++) {
                              if (format(days[j], 'yyyy-MM-dd') < booking.check_out) span++
                              else break
                            }
                            cells.push(
                              <td
                                key={ds}
                                colSpan={span}
                                onClick={() => onBookingClick(booking)}
                                className={clsx(
                                  'cursor-pointer transition-colors overflow-hidden',
                                  isSun && 'border-l-2 border-slate-300',
                                )}
                                style={{
                                  height: 36,
                                  verticalAlign: 'middle',
                                  background: 'rgba(45,212,191,0.14)',
                                  borderTop: '2px solid #2DD4BF',
                                }}
                              >
                                <div className="flex items-center h-full px-1.5 overflow-hidden">
                                  <span className="text-[10px] font-semibold truncate" style={{ color: '#0F766E' }}>
                                    {booking.guest_first_name} {booking.guest_last_name}
                                  </span>
                                </div>
                              </td>,
                            )
                            i += span
                            continue
                          }
                        }

                        const cellStyle = getCellStyle(status)
                        cells.push(
                          <td
                            key={ds}
                            onMouseDown={() => handleMouseDown(room.id, ds, status)}
                            onMouseEnter={() => handleMouseEnter(room.id, ds)}
                            onMouseUp={() => handleMouseUp(room.id, ds)}
                            className={clsx(
                              'border-slate-200 text-center cursor-pointer transition-colors',
                              isFriSat && status === 'available' && 'bg-amber-50/40',
                              isSun && 'border-l-2 border-slate-300',
                              todayCell && status === 'available' && 'bg-teal-100/60',
                            )}
                            style={{
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
                          </td>,
                        )
                        i++
                      }
                      return cells
                    })()}
                  </tr>

                  <CalendarTaskRow
                    label={`${room.name} Tasks`}
                    tasks={roomTasks}
                    days={days}
                    onTaskClick={onTaskClick}
                    onAddClick={(date) => onAddTask(room.id, date)}
                  />
                </React.Fragment>
              )
            })}
          </React.Fragment>
        ))}
      </tbody>
    </table>
  )
}
