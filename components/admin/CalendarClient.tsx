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

type ModalState =
  | { type: 'none' }
  | { type: 'night'; roomId: string; date: string }
  | { type: 'task'; task?: CalendarTask; roomId?: string | null; date?: string }
  | { type: 'block'; roomId: string; from: string; to: string }
  | { type: 'setPrice'; roomId: string; from: string; to: string }
  | { type: 'addBooking'; roomId: string; checkIn: string; checkOut: string }
  | { type: 'bookingDetail'; booking: Booking }
  | { type: 'smartPricing'; room: Room }

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
    setModal({ type: 'smartPricing', room })
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
            type="button"
            onClick={goToPrevMonth}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
          >
            ←
          </button>
          <h2 className="text-lg font-semibold text-slate-800">
            {format(currentMonth, 'MMMM yyyy')}
          </h2>
          <button
            type="button"
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
          type="button"
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
    </div>
  )
}
