# Enhanced Admin Calendar — Plan 5: CalendarGrid & Page Rebuild

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `CalendarGrid` (the interactive timeline table with drag selection and cell rendering) and fully rebuild the calendar page at `app/admin/(protected)/calendar/page.tsx`.

**Architecture:** The page is a server component that fetches initial data and passes it to a `CalendarClient` component (client). `CalendarClient` owns the month navigation, drag-selection state, and modal state. `CalendarGrid` is a pure display table that fires callbacks on drag/click events. All modals from Plan 4 are wired in here.

**Tech Stack:** React 18, Next.js App Router, TypeScript, Tailwind CSS, date-fns

**Dependency:** ALL of Plans 1–4 must be complete before this plan starts:
- Types: `DateOverride`, `CalendarTask`, `CalendarData`, `Room` (with `price_min`/`price_max`)
- API: `GET /api/admin/calendar`, `PUT /api/admin/date-overrides`, calendar-tasks CRUD
- Hooks: `useDateOverrides`
- Components: `OccupancyBar`, `CalendarLegend`, `SelectionBar`, `CalendarTaskRow`, all modals

---

### Task 1: CalendarGrid component

**Files:**
- Create: `components/admin/CalendarGrid.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/admin/CalendarGrid.tsx
'use client'

import { useRef, useCallback } from 'react'
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
              <>
                {/* Booking / availability row */}
                <tr key={room.id} className="border-b border-slate-100 group">
                  {/* Room label */}
                  <td
                    className="sticky left-0 z-10 bg-white border-r border-slate-200 px-2 py-1"
                    style={{ width: LABEL_COL_WIDTH, minWidth: LABEL_COL_WIDTH }}
                  >
                    <button
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
                  key={`tasks-${room.id}`}
                  label={`↳ ${room.name} Tasks`}
                  tasks={roomTasks}
                  days={days}
                  cellWidth={CELL_WIDTH}
                  labelColWidth={LABEL_COL_WIDTH}
                  onTaskClick={onTaskClick}
                  onAddClick={() => onAddTask(room.id, format(days[0], 'yyyy-MM-dd'))}
                />
              </>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/admin/CalendarGrid.tsx
git commit -m "feat: add CalendarGrid interactive timeline component with drag selection"
```

---

### Task 2: CalendarClient component

**Files:**
- Create: `components/admin/CalendarClient.tsx`

- [ ] **Step 1: Create the client wrapper**

```tsx
// components/admin/CalendarClient.tsx
'use client'

import { useState, useCallback, useMemo } from 'react'
import { format, addMonths, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns'
import { useRouter } from 'next/navigation'
import { CalendarGrid, type DragSelection } from './CalendarGrid'
import { CalendarLegend } from './CalendarLegend'
import { SelectionBar } from './SelectionBar'
import { NightDetailModal, type NightStatus } from './NightDetailModal'
import { TaskModal } from './TaskModal'
import { BlockDatesModal } from './calendar/BlockDatesModal'
import { SetPriceModal } from './calendar/SetPriceModal'
import { AddBookingModal } from './calendar/AddBookingModal'
import { BookingDetailModal } from './calendar/BookingDetailModal'
import { SmartPricingModal } from './calendar/SmartPricingModal'
import { useDateOverrides } from '@/hooks/useDateOverrides'
import type {
  Room,
  Booking,
  ICalBlock,
  DateOverride,
  CalendarTask,
  CalendarData,
} from '@/types'

// Dynamically import RoomCalendarModal to avoid SSR issues
import dynamic from 'next/dynamic'
const RoomCalendarModal = dynamic(
  () => import('./RoomCalendarModal').then((m) => m.RoomCalendarModal ?? m.default),
  { ssr: false },
)

type ModalState =
  | { type: 'none' }
  | { type: 'night'; roomId: string; date: string }
  | { type: 'task'; task?: CalendarTask; roomId?: string | null; date?: string }
  | { type: 'block'; roomId: string; from: string; to: string }
  | { type: 'setPrice'; roomId: string; from: string; to: string }
  | { type: 'addBooking'; roomId: string; checkIn: string; checkOut: string }
  | { type: 'bookingDetail'; booking: Booking }
  | { type: 'smartPricing'; room: Room }
  | { type: 'roomCalendar'; room: Room }

interface CalendarClientProps {
  initialData: CalendarData
  initialMonth: string  // 'YYYY-MM-DD' first of month
}

export function CalendarClient({ initialData, initialMonth }: CalendarClientProps) {
  const router = useRouter()
  const [currentMonth, setCurrentMonth] = useState(() => new Date(initialMonth + 'T00:00:00'))
  const [data, setData] = useState<CalendarData>(initialData)
  const [loading, setLoading] = useState(false)
  const [selection, setSelection] = useState<DragSelection | null>(null)
  const [modal, setModal] = useState<ModalState>({ type: 'none' })

  const { overrideMap, getOverride, applyOverrides, removeBlock } = useDateOverrides(
    data.dateOverrides,
  )

  const days = useMemo(() => {
    const start = startOfMonth(currentMonth)
    const end = endOfMonth(currentMonth)
    return eachDayOfInterval({ start, end })
  }, [currentMonth])

  async function fetchMonth(month: Date) {
    setLoading(true)
    const from = format(startOfMonth(month), 'yyyy-MM-dd')
    const to = format(endOfMonth(month), 'yyyy-MM-dd')
    try {
      const res = await fetch(`/api/admin/calendar?from=${from}&to=${to}`)
      if (res.ok) {
        const json: CalendarData = await res.json()
        setData(json)
      }
    } finally {
      setLoading(false)
    }
  }

  function goToPrevMonth() {
    const prev = addMonths(currentMonth, -1)
    setCurrentMonth(prev)
    fetchMonth(prev)
  }

  function goToNextMonth() {
    const next = addMonths(currentMonth, 1)
    setCurrentMonth(next)
    fetchMonth(next)
  }

  function closeModal() {
    setModal({ type: 'none' })
  }

  const handleCellClick = useCallback(
    (roomId: string, date: string) => {
      setModal({ type: 'night', roomId, date })
    },
    [],
  )

  const handleRoomNameClick = useCallback((room: Room) => {
    setModal({ type: 'roomCalendar', room })
  }, [])

  function handleBook() {
    if (!selection) return
    setModal({
      type: 'addBooking',
      roomId: selection.roomId,
      checkIn: selection.startDate,
      checkOut: selection.endDate,
    })
  }

  function handleBlock() {
    if (!selection) return
    setModal({
      type: 'block',
      roomId: selection.roomId,
      from: selection.startDate,
      to: selection.endDate,
    })
  }

  function handleSetPrice() {
    if (!selection) return
    setModal({
      type: 'setPrice',
      roomId: selection.roomId,
      from: selection.startDate,
      to: selection.endDate,
    })
  }

  function nightStatusFor(roomId: string, dateStr: string): NightStatus {
    const booking = data.bookings.find(
      (b) =>
        b.room_id === roomId &&
        dateStr >= b.check_in &&
        dateStr < b.check_out &&
        (b.status === 'confirmed' || b.status === 'pending'),
    )
    if (booking) return 'booked'
    const ical = data.icalBlocks.find(
      (b) => b.room_id === roomId && dateStr >= b.start_date && dateStr < b.end_date,
    )
    if (ical) return 'ical'
    const override = getOverride(roomId, dateStr)
    if (override?.is_blocked) return 'blocked'
    return 'available'
  }

  const selectionRoom = selection
    ? data.rooms.find((r) => r.id === selection.roomId)
    : null

  const nightModal = modal.type === 'night' ? modal : null
  const nightRoom = nightModal ? data.rooms.find((r) => r.id === nightModal.roomId) : null
  const nightStatus = nightModal ? nightStatusFor(nightModal.roomId, nightModal.date) : 'available'
  const nightBooking = nightModal
    ? data.bookings.find(
        (b) =>
          b.room_id === nightModal.roomId &&
          nightModal.date >= b.check_in &&
          nightModal.date < b.check_out,
      )
    : undefined
  const nightIcal = nightModal
    ? data.icalBlocks.find(
        (b) =>
          b.room_id === nightModal.roomId &&
          nightModal.date >= b.start_date &&
          nightModal.date < b.end_date,
      )
    : undefined
  const nightOverride = nightModal
    ? getOverride(nightModal.roomId, nightModal.date)
    : undefined

  return (
    <div className="space-y-4">
      {/* Month nav */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={goToPrevMonth}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
          >
            ←
          </button>
          <h2 className="text-lg font-semibold text-slate-800">
            {format(currentMonth, 'MMMM yyyy')}
          </h2>
          <button
            onClick={goToNextMonth}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
          >
            →
          </button>
          {loading && (
            <span className="text-xs text-slate-400 animate-pulse">Loading…</span>
          )}
        </div>

        <button
          onClick={() => {
            const room = data.rooms[0]
            if (room) setModal({ type: 'smartPricing', room })
          }}
          className="text-xs text-teal-600 hover:text-teal-800 font-medium border border-teal-200 rounded-lg px-3 py-1.5 hover:bg-teal-50 transition-colors"
        >
          ⚡ Smart Pricing
        </button>
      </div>

      {/* Grid */}
      <CalendarGrid
        rooms={data.rooms}
        days={days}
        bookings={data.bookings}
        icalBlocks={data.icalBlocks}
        overrideMap={overrideMap}
        tasks={data.tasks}
        selection={selection}
        onSelectionChange={setSelection}
        onCellClick={handleCellClick}
        onRoomNameClick={handleRoomNameClick}
        onTaskClick={(task) => setModal({ type: 'task', task })}
        onAddTask={(roomId, date) => setModal({ type: 'task', roomId, date })}
      />

      <CalendarLegend />

      {/* Selection action bar */}
      <SelectionBar
        selectedCount={
          selection
            ? (() => {
                const s = new Date(selection.startDate + 'T00:00:00')
                const e = new Date(selection.endDate + 'T00:00:00')
                return Math.round((e.getTime() - s.getTime()) / 86400000) + 1
              })()
            : 0
        }
        roomName={selectionRoom?.name ?? ''}
        onBook={handleBook}
        onBlock={handleBlock}
        onSetPrice={handleSetPrice}
        onClear={() => setSelection(null)}
      />

      {/* Night detail modal */}
      {modal.type === 'night' && nightRoom && (
        <NightDetailModal
          status={nightStatus}
          date={modal.date}
          room={nightRoom}
          booking={nightBooking}
          icalBlock={nightIcal}
          override={nightOverride}
          onClose={closeModal}
          onBook={() => {
            closeModal()
            setModal({
              type: 'addBooking',
              roomId: modal.roomId,
              checkIn: modal.date,
              checkOut: modal.date,
            })
          }}
          onBlock={() => {
            closeModal()
            setModal({ type: 'block', roomId: modal.roomId, from: modal.date, to: modal.date })
          }}
          onUnblock={(roomId, date) => {
            removeBlock(roomId, date)
            closeModal()
            fetch('/api/admin/date-overrides', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ room_id: roomId, dates: [date], is_blocked: false }),
            })
          }}
          onViewBooking={(bookingId) => {
            router.push(`/admin/bookings?id=${bookingId}`)
            closeModal()
          }}
          onCancelBooking={(bookingId) => {
            router.push(`/admin/bookings?id=${bookingId}&action=cancel`)
            closeModal()
          }}
          onManageIcal={() => {
            router.push('/admin/ical')
            closeModal()
          }}
          onSaveRate={async (roomId, date, price, note) => {
            const rows = [
              {
                id: `${roomId}-${date}`,
                room_id: roomId,
                date,
                price_override: price,
                is_blocked: false,
                block_reason: null,
                note: note || null,
                created_at: new Date().toISOString(),
              },
            ]
            applyOverrides(rows)
            await fetch('/api/admin/date-overrides', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ room_id: roomId, dates: [date], price_override: price, note }),
            })
          }}
        />
      )}

      {/* Task modal */}
      {modal.type === 'task' && (
        <TaskModal
          rooms={data.rooms}
          task={modal.task}
          initialRoomId={modal.roomId}
          initialDate={modal.date}
          onClose={closeModal}
          onSuccess={(task) => {
            setData((prev) => {
              const existing = prev.tasks.findIndex((t) => t.id === task.id)
              if (existing >= 0) {
                const tasks = [...prev.tasks]
                tasks[existing] = task
                return { ...prev, tasks }
              }
              return { ...prev, tasks: [...prev.tasks, task] }
            })
            closeModal()
          }}
          onDelete={(taskId) => {
            setData((prev) => ({ ...prev, tasks: prev.tasks.filter((t) => t.id !== taskId) }))
          }}
        />
      )}

      {/* Block modal */}
      {modal.type === 'block' && (
        <BlockDatesModal
          rooms={data.rooms}
          initialRoomId={modal.roomId}
          initialFrom={modal.from}
          initialTo={modal.to}
          onClose={closeModal}
          onSuccess={(roomId, dates) => {
            const rows = dates.map((date) => ({
              id: `${roomId}-${date}`,
              room_id: roomId,
              date,
              price_override: null,
              is_blocked: true,
              block_reason: null,
              note: null,
              created_at: new Date().toISOString(),
            }))
            applyOverrides(rows)
            setSelection(null)
          }}
        />
      )}

      {/* Set price modal */}
      {modal.type === 'setPrice' && (
        <SetPriceModal
          rooms={data.rooms}
          initialRoomId={modal.roomId}
          initialFrom={modal.from}
          initialTo={modal.to}
          onClose={closeModal}
          onSuccess={(roomId, dates, price) => {
            const rows = dates.map((date) => ({
              id: `${roomId}-${date}`,
              room_id: roomId,
              date,
              price_override: price,
              is_blocked: false,
              block_reason: null,
              note: null,
              created_at: new Date().toISOString(),
            }))
            applyOverrides(rows)
            setSelection(null)
          }}
        />
      )}

      {/* Add booking modal */}
      {modal.type === 'addBooking' && (
        <AddBookingModal
          rooms={data.rooms}
          initialRoomId={modal.roomId}
          initialCheckIn={modal.checkIn}
          initialCheckOut={modal.checkOut}
          onClose={closeModal}
          onSuccess={() => fetchMonth(currentMonth)}
        />
      )}

      {/* Booking detail modal */}
      {modal.type === 'bookingDetail' && (
        <BookingDetailModal
          booking={modal.booking}
          onClose={closeModal}
          onViewFull={(bookingId) => {
            router.push(`/admin/bookings?id=${bookingId}`)
            closeModal()
          }}
          onCancelBooking={(bookingId) => {
            router.push(`/admin/bookings?id=${bookingId}&action=cancel`)
            closeModal()
          }}
        />
      )}

      {/* Smart pricing modal */}
      {modal.type === 'smartPricing' && (
        <SmartPricingModal
          room={modal.room}
          onClose={closeModal}
          onSuccess={(roomId, priceMin, priceMax) => {
            setData((prev) => ({
              ...prev,
              rooms: prev.rooms.map((r) =>
                r.id === roomId ? { ...r, price_min: priceMin, price_max: priceMax } : r,
              ),
            }))
          }}
        />
      )}

      {/* Room calendar modal */}
      {modal.type === 'roomCalendar' && (
        <RoomCalendarModal room={modal.room} onClose={closeModal} />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors. If `RoomCalendarModal` import path fails, check `components/admin/RoomCalendarModal.tsx` and adjust the dynamic import path to match.

- [ ] **Step 3: Commit**

```bash
git add components/admin/CalendarClient.tsx
git commit -m "feat: add CalendarClient — wires all calendar state, modals, and data fetching"
```

---

### Task 3: Rebuild the calendar page

**Files:**
- Modify: `app/admin/(protected)/calendar/page.tsx`

- [ ] **Step 1: Read the existing page**

Read `app/admin/(protected)/calendar/page.tsx` to see the current structure before replacing it.

- [ ] **Step 2: Replace the page**

Overwrite `app/admin/(protected)/calendar/page.tsx` with:

```tsx
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import { CalendarClient } from '@/components/admin/CalendarClient'
import type { CalendarData } from '@/types'

export default async function AdminCalendarPage() {
  const serverClient = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await serverClient.auth.getUser()
  if (authError || !user) redirect('/admin/login')

  const supabase = createServiceRoleClient()
  const today = new Date()
  const from = format(startOfMonth(today), 'yyyy-MM-dd')
  const to = format(endOfMonth(today), 'yyyy-MM-dd')

  const [roomsRes, bookingsRes, icalRes, overridesRes, tasksRes] = await Promise.all([
    supabase
      .from('rooms')
      .select('*, property:properties(id, name)')
      .eq('is_active', true)
      .order('name'),

    supabase
      .from('bookings')
      .select('*')
      .in('status', ['confirmed', 'pending'])
      .lt('check_in', to)
      .gte('check_out', from),

    supabase
      .from('ical_blocks')
      .select('*')
      .lt('start_date', to)
      .gte('end_date', from),

    supabase
      .from('date_overrides')
      .select('*')
      .gte('date', from)
      .lte('date', to),

    supabase
      .from('calendar_tasks')
      .select('*')
      .or(`recurrence_rule.not.is.null,and(due_date.gte.${from},due_date.lte.${to})`),
  ])

  const initialData: CalendarData = {
    rooms: roomsRes.data ?? [],
    bookings: bookingsRes.data ?? [],
    icalBlocks: icalRes.data ?? [],
    dateOverrides: overridesRes.data ?? [],
    tasks: tasksRes.data ?? [],
  }

  const initialMonth = format(startOfMonth(today), 'yyyy-MM-dd')

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Calendar
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage bookings, pricing, and tasks</p>
        </div>
      </div>

      <CalendarClient initialData={initialData} initialMonth={initialMonth} />
    </div>
  )
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/admin/(protected)/calendar/page.tsx components/admin/CalendarClient.tsx
git commit -m "feat: rebuild admin calendar page with full timeline grid and interactive controls"
```

---

### Task 4: Smoke test the full build

- [ ] **Step 1: Build the project**

```bash
npm run build
```

Expected: exits with code 0. No TypeScript or compilation errors.

If there are errors, fix them before proceeding. Common issues:
- `RoomCalendarModal` default vs named export — check the actual export in `components/admin/RoomCalendarModal.tsx` and update the dynamic import in `CalendarClient.tsx` to match.
- Missing `source` or `notes` on `Booking` type — these were added in Plan 4, Task 5. If Plan 4 ran separately, verify `types/index.ts` has them.
- React key warnings from `<>` fragments in `CalendarGrid` — add explicit `key` props by wrapping both rows in a `<React.Fragment key={room.id}>`.

- [ ] **Step 2: Fix React fragment keys in CalendarGrid if needed**

In `components/admin/CalendarGrid.tsx`, the room map currently renders `<>` with two rows. Replace:

```tsx
return (
  <>
    {/* Booking / availability row */}
    <tr key={room.id} ...>
    ...
    </tr>

    {/* Task sub-row */}
    <CalendarTaskRow key={`tasks-${room.id}`} .../>
  </>
)
```

with:

```tsx
return (
  <React.Fragment key={room.id}>
    {/* Booking / availability row */}
    <tr ...>
    ...
    </tr>

    {/* Task sub-row */}
    <CalendarTaskRow .../>
  </React.Fragment>
)
```

Also add `import React from 'react'` at the top of `CalendarGrid.tsx`.

- [ ] **Step 3: Run all tests**

```bash
npx jest --no-coverage
```

Expected: all tests pass.

- [ ] **Step 4: Final commit if any fixes were needed**

```bash
git add -p
git commit -m "fix: resolve build errors in CalendarGrid and CalendarClient"
```
