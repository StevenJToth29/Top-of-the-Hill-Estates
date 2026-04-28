// components/admin/CalendarClient.tsx
'use client'

import { useState, useCallback, useEffect, useLayoutEffect, useRef, useMemo } from 'react'
import { format, addDays, subDays, eachDayOfInterval } from 'date-fns'
import { useRouter } from 'next/navigation'
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { CalendarGrid, DAY_COL_WIDTH, LABEL_COL_WIDTH, type DragSelection } from './CalendarGrid'
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
  Booking,
  CalendarTask,
  CalendarData,
} from '@/types'

const DAYS_BEFORE = 60
const DAYS_AFTER = 120
const LOAD_CHUNK = 60
const LOAD_TRIGGER_PX = 500

function computeInitialDays(todayStr: string): Date[] {
  const today = new Date(todayStr + 'T00:00:00')
  return eachDayOfInterval({ start: subDays(today, DAYS_BEFORE), end: addDays(today, DAYS_AFTER) })
}

function mergeCalendarData(existing: CalendarData, incoming: CalendarData): CalendarData {
  function mergeById<T extends { id: string }>(a: T[], b: T[]): T[] {
    const map = new Map(a.map((x) => [x.id, x]))
    for (const x of b) map.set(x.id, x)
    return Array.from(map.values())
  }
  function mergeTasks(a: CalendarTask[], b: CalendarTask[]): CalendarTask[] {
    const map = new Map(a.map((t) => [`${t.id}|${t.due_date}`, t]))
    for (const t of b) map.set(`${t.id}|${t.due_date}`, t)
    return Array.from(map.values())
  }
  return {
    rooms: existing.rooms,
    bookings: mergeById(existing.bookings, incoming.bookings),
    icalBlocks: mergeById(existing.icalBlocks, incoming.icalBlocks),
    dateOverrides: mergeById(existing.dateOverrides, incoming.dateOverrides),
    tasks: mergeTasks(existing.tasks, incoming.tasks),
  }
}

type ModalState =
  | { type: 'none' }
  | { type: 'night'; roomId: string; date: string }
  | { type: 'task'; task?: CalendarTask; roomId?: string | null; propertyId?: string | null; date?: string }
  | { type: 'block'; roomId: string; from: string; to: string }
  | { type: 'setPrice'; roomId: string; from: string; to: string }
  | { type: 'addBooking'; roomId: string; checkIn: string; checkOut: string }
  | { type: 'bookingDetail'; booking: Booking }
  | { type: 'smartPricing'; roomId: string }

interface CalendarClientProps {
  initialData: CalendarData
  today: string
}

export function CalendarClient({ initialData, today }: CalendarClientProps) {
  const router = useRouter()
  const [days, setDays] = useState<Date[]>(() => computeInitialDays(today))
  const [data, setData] = useState<CalendarData>(initialData)
  const [loadingPast, setLoadingPast] = useState(false)
  const [loadingFuture, setLoadingFuture] = useState(false)
  const [selection, setSelection] = useState<DragSelection | null>(null)
  const [modal, setModal] = useState<ModalState>({ type: 'none' })
  const [roomSearch, setRoomSearch] = useState('')
  const [viewMode, setViewMode] = useState<'bookings' | 'tasks'>('bookings')

  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const daysRef = useRef(days)
  const loadingPastRef = useRef(false)
  const loadingFutureRef = useRef(false)
  const pendingScrollAdjust = useRef(0)

  useEffect(() => { daysRef.current = days }, [days])

  const { overrideMap, getOverride, applyOverrides, removeBlock, removeOverride } = useDateOverrides(
    data.dateOverrides,
  )

  // Scroll to today (5 days of past visible) after mount
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return
    const todayStr = format(new Date(), 'yyyy-MM-dd')
    const todayIdx = days.findIndex((d) => format(d, 'yyyy-MM-dd') === todayStr)
    if (todayIdx < 0) return
    container.scrollLeft = Math.max(0, (todayIdx - 5) * DAY_COL_WIDTH)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // only on mount

  // Adjust scroll after prepending days to prevent content jump
  useLayoutEffect(() => {
    if (pendingScrollAdjust.current !== 0 && scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft += pendingScrollAdjust.current
      pendingScrollAdjust.current = 0
    }
  })

  const loadMorePast = useCallback(async () => {
    if (loadingPastRef.current) return
    loadingPastRef.current = true
    setLoadingPast(true)
    const currentStart = daysRef.current[0]
    const newEnd = subDays(currentStart, 1)
    const newStart = subDays(currentStart, LOAD_CHUNK)
    try {
      const from = format(newStart, 'yyyy-MM-dd')
      const to = format(newEnd, 'yyyy-MM-dd')
      const res = await fetch(`/api/admin/calendar?from=${from}&to=${to}`)
      if (!res.ok) return
      const newCalData: CalendarData = await res.json()
      const newDays = eachDayOfInterval({ start: newStart, end: newEnd })
      pendingScrollAdjust.current = newDays.length * DAY_COL_WIDTH
      setDays((prev) => [...newDays, ...prev])
      setData((prev) => mergeCalendarData(prev, newCalData))
      applyOverrides(newCalData.dateOverrides)
    } catch {
      // silently ignore network errors
    } finally {
      setLoadingPast(false)
      loadingPastRef.current = false
    }
  }, [applyOverrides])

  const loadMoreFuture = useCallback(async () => {
    if (loadingFutureRef.current) return
    loadingFutureRef.current = true
    setLoadingFuture(true)
    const currentEnd = daysRef.current[daysRef.current.length - 1]
    const newStart = addDays(currentEnd, 1)
    const newEnd = addDays(currentEnd, LOAD_CHUNK)
    try {
      const from = format(newStart, 'yyyy-MM-dd')
      const to = format(newEnd, 'yyyy-MM-dd')
      const res = await fetch(`/api/admin/calendar?from=${from}&to=${to}`)
      if (!res.ok) return
      const newCalData: CalendarData = await res.json()
      const newDays = eachDayOfInterval({ start: newStart, end: newEnd })
      setDays((prev) => [...prev, ...newDays])
      setData((prev) => mergeCalendarData(prev, newCalData))
      applyOverrides(newCalData.dateOverrides)
    } catch {
      // silently ignore network errors
    } finally {
      setLoadingFuture(false)
      loadingFutureRef.current = false
    }
  }, [applyOverrides])

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current
    if (!container) return
    if (container.scrollLeft < LOAD_TRIGGER_PX) loadMorePast()
    const distToEnd = container.scrollWidth - container.clientWidth - container.scrollLeft
    if (distToEnd < LOAD_TRIGGER_PX) loadMoreFuture()
  }, [loadMorePast, loadMoreFuture])

  function scrollToToday() {
    const container = scrollContainerRef.current
    if (!container) return
    const todayStr = format(new Date(), 'yyyy-MM-dd')
    const todayIdx = daysRef.current.findIndex((d) => format(d, 'yyyy-MM-dd') === todayStr)
    if (todayIdx < 0) return
    container.scrollTo({ left: Math.max(0, (todayIdx - 5) * DAY_COL_WIDTH), behavior: 'smooth' })
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

  function handleBook() {
    if (!selection) return
    const checkOutDate = new Date(selection.endDate + 'T00:00:00')
    checkOutDate.setDate(checkOutDate.getDate() + 1)
    setModal({
      type: 'addBooking',
      roomId: selection.roomId,
      checkIn: selection.startDate,
      checkOut: format(checkOutDate, 'yyyy-MM-dd'),
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

  const filteredRooms = useMemo(() => {
    const q = roomSearch.trim().toLowerCase()
    if (!q) return data.rooms
    return data.rooms.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.property?.name?.toLowerCase().includes(q),
    )
  }, [data.rooms, roomSearch])

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
          nightModal.date < b.check_out &&
          (b.status === 'confirmed' || b.status === 'pending'),
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
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3 shrink-0 px-4 py-2 border-b border-slate-200 bg-white">
        <span className="text-sm font-semibold text-slate-700 shrink-0">Calendar</span>
        <button
          type="button"
          onClick={scrollToToday}
          className="text-xs font-medium rounded-lg border border-slate-200 px-3 py-1.5 text-slate-600 hover:bg-slate-50 transition-colors shrink-0"
        >
          Today
        </button>

        {/* Unit search */}
        <div className="relative flex-1 max-w-64">
          <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={roomSearch}
            onChange={(e) => setRoomSearch(e.target.value)}
            placeholder="Filter units…"
            className="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-400"
          />
          {roomSearch && (
            <button
              type="button"
              onClick={() => setRoomSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <XMarkIcon className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {roomSearch && (
          <span className="text-xs text-slate-400 shrink-0">
            {filteredRooms.length} of {data.rooms.length} unit{data.rooms.length !== 1 ? 's' : ''}
          </span>
        )}

        {(loadingPast || loadingFuture) && (
          <span className="text-xs text-slate-400 animate-pulse shrink-0">Loading…</span>
        )}

        <div className="flex-1" />

        {/* View mode toggle */}
        <div className="flex items-center rounded-lg border border-slate-200 overflow-hidden shrink-0">
          <button
            type="button"
            onClick={() => setViewMode('bookings')}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              viewMode === 'bookings'
                ? 'bg-teal-500 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            Bookings
          </button>
          <button
            type="button"
            onClick={() => setViewMode('tasks')}
            className={`px-3 py-1.5 text-xs font-medium transition-colors border-l border-slate-200 ${
              viewMode === 'tasks'
                ? 'bg-teal-500 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            Tasks
          </button>
        </div>
      </div>

      {/* Scrollable grid container — no scrollbars */}
      <div
        ref={scrollContainerRef}
        className="flex-1 min-h-0 overflow-auto scrollbar-none mr-4"
        onScroll={handleScroll}
      >
        <CalendarGrid
          rooms={filteredRooms}
          days={days}
          bookings={data.bookings}
          icalBlocks={data.icalBlocks}
          overrideMap={overrideMap}
          tasks={data.tasks}
          selection={selection}
          onSelectionChange={setSelection}
          onCellClick={handleCellClick}
          onBookingClick={(booking) => setModal({ type: 'bookingDetail', booking })}
          onTaskClick={(task) => setModal({ type: 'task', task })}
          onAddTask={(roomId, date) => setModal({ type: 'task', roomId, date })}
          onAddPropertyTask={(propertyId, date) => setModal({ type: 'task', propertyId, date })}
          onSmartPricingClick={(roomId) => setModal({ type: 'smartPricing', roomId })}
          viewMode={viewMode}
          today={today}
        />
      </div>

      {/* Legend footer */}
      <div className="shrink-0 border-t border-slate-200 bg-white px-4">
        <CalendarLegend />
      </div>

      {/* Selection action bar — floats over the bottom of the grid */}
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
            const nextDay = new Date(modal.date + 'T00:00:00')
            nextDay.setDate(nextDay.getDate() + 1)
            setModal({
              type: 'addBooking',
              roomId: modal.roomId,
              checkIn: modal.date,
              checkOut: format(nextDay, 'yyyy-MM-dd'),
            })
          }}
          onBlock={() => {
            closeModal()
            setModal({ type: 'block', roomId: modal.roomId, from: modal.date, to: modal.date })
          }}
          onUnblock={async (roomId, date) => {
            removeBlock(roomId, date)
            closeModal()
            try {
              const res = await fetch('/api/admin/date-overrides', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ room_id: roomId, dates: [date], is_blocked: false }),
              })
              if (!res.ok) {
                applyOverrides([{
                  id: `${roomId}-${date}`,
                  room_id: roomId,
                  date,
                  price_override: null,
                  is_blocked: true,
                  block_reason: null,
                  note: null,
                  created_at: new Date().toISOString(),
                }])
              }
            } catch {
              applyOverrides([{
                id: `${roomId}-${date}`,
                room_id: roomId,
                date,
                price_override: null,
                is_blocked: true,
                block_reason: null,
                note: null,
                created_at: new Date().toISOString(),
              }])
            }
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
            const originalOverride = getOverride(roomId, date)
            const optimisticRow = {
              id: originalOverride?.id ?? `${roomId}-${date}`,
              room_id: roomId,
              date,
              price_override: price,
              is_blocked: false,
              block_reason: null,
              note: note || null,
              created_at: originalOverride?.created_at ?? new Date().toISOString(),
            }
            applyOverrides([optimisticRow])
            try {
              const res = await fetch('/api/admin/date-overrides', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ room_id: roomId, dates: [date], price_override: price, note }),
              })
              if (!res.ok) {
                if (originalOverride) applyOverrides([originalOverride])
                else removeOverride(roomId, date)
              }
            } catch {
              if (originalOverride) applyOverrides([originalOverride])
              else removeOverride(roomId, date)
            }
          }}
        />
      )}

      {/* Task modal */}
      {modal.type === 'task' && (
        <TaskModal
          rooms={data.rooms}
          task={modal.task}
          initialRoomId={modal.roomId}
          initialPropertyId={modal.propertyId}
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
          onSuccess={async () => {
            const from = format(daysRef.current[0], 'yyyy-MM-dd')
            const to = format(daysRef.current[daysRef.current.length - 1], 'yyyy-MM-dd')
            try {
              const res = await fetch(`/api/admin/calendar?from=${from}&to=${to}`)
              if (res.ok) {
                const refreshed: CalendarData = await res.json()
                setData(refreshed)
                applyOverrides(refreshed.dateOverrides)
              }
            } catch { /* silent */ }
          }}
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
      {modal.type === 'smartPricing' && (() => {
        const room = data.rooms.find((r) => r.id === modal.roomId)
        if (!room) return null
        return (
          <SmartPricingModal
            room={room}
            onClose={closeModal}
            onSuccess={async (roomId, updates) => {
              setData((prev) => ({
                ...prev,
                rooms: prev.rooms.map((r) => r.id === roomId ? { ...r, ...updates } : r),
              }))
              // Refresh overrides — prices are already written by the time onSuccess fires
              try {
                const from = format(daysRef.current[0], 'yyyy-MM-dd')
                const to = format(daysRef.current[daysRef.current.length - 1], 'yyyy-MM-dd')
                const res = await fetch(`/api/admin/calendar?from=${from}&to=${to}`)
                if (res.ok) {
                  const refreshed: CalendarData = await res.json()
                  setData((prev) => ({ ...prev, dateOverrides: refreshed.dateOverrides }))
                  applyOverrides(refreshed.dateOverrides)
                }
              } catch { /* silent */ }
            }}
          />
        )
      })()}

    </div>
  )
}
