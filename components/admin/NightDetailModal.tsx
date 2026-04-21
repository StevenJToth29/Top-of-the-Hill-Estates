'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { ModalShell } from './calendar/ModalShell'
import type { Booking, ICalBlock, DateOverride, Room } from '@/types'

export type NightStatus = 'available' | 'booked' | 'blocked' | 'ical'

interface NightDetailModalProps {
  status: NightStatus
  date: string
  room: Room
  booking?: Booking
  icalBlock?: ICalBlock
  override?: DateOverride
  onClose: () => void
  onBook: () => void
  onBlock: () => void
  onUnblock: (roomId: string, date: string) => void
  onViewBooking: (bookingId: string) => void
  onCancelBooking: (bookingId: string) => void
  onManageIcal: () => void
  onSaveRate: (roomId: string, date: string, price: number, note: string) => Promise<void>
}

export function NightDetailModal({
  status, date, room, booking, icalBlock, override,
  onClose, onBook, onBlock, onUnblock, onViewBooking, onCancelBooking, onManageIcal, onSaveRate,
}: NightDetailModalProps) {
  const dateLabel = format(new Date(date + 'T00:00:00'), 'EEEE, MMMM d, yyyy')

  return (
    <ModalShell title={dateLabel} onClose={onClose}>
      {status === 'available' && (
        <AvailableState date={date} room={room} override={override}
          onBook={onBook} onBlock={onBlock} onSaveRate={onSaveRate} />
      )}
      {status === 'booked' && booking && (
        <BookedState booking={booking}
          onViewBooking={() => onViewBooking(booking.id)}
          onCancelBooking={() => onCancelBooking(booking.id)} />
      )}
      {status === 'blocked' && (
        <BlockedState date={date} room={room} override={override}
          onUnblock={() => onUnblock(room.id, date)} />
      )}
      {status === 'ical' && icalBlock && (
        <ICalState icalBlock={icalBlock} onManageIcal={onManageIcal} />
      )}
    </ModalShell>
  )
}

function AvailableState({ date, room, override, onBook, onBlock, onSaveRate }: {
  date: string; room: Room; override?: DateOverride
  onBook: () => void; onBlock: () => void
  onSaveRate: (roomId: string, date: string, price: number, note: string) => Promise<void>
}) {
  const currentPrice = override?.price_override ?? room.nightly_rate
  const [price, setPrice] = useState(String(currentPrice))
  const [note, setNote] = useState(override?.note ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const priceMin = room.price_min ?? null
  const priceMax = room.price_max ?? null

  async function handleSave() {
    const p = parseFloat(price)
    if (!p || p <= 0) { setError('Enter a valid price'); return }
    setSaving(true)
    setError(null)
    try {
      await onSaveRate(room.id, date, p, note)
    } catch {
      setError('Failed to save rate')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full bg-green-50 text-green-700 border border-green-100">
        ● Available
      </span>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Nightly Rate</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
          <input type="number" value={price} onChange={(e) => setPrice(e.target.value)}
            min={1} step={1}
            className="w-full rounded-lg border border-slate-200 pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
        </div>
        {priceMin != null && priceMax != null && priceMax > priceMin && (() => {
          const pNum = parseFloat(price)
          const showMarker = pNum >= priceMin && pNum <= priceMax
          return (
            <div className="mt-2 space-y-1">
              <div className="flex justify-between text-xs text-slate-400">
                <span>${priceMin}</span><span>${priceMax}</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 relative">
                <div className="h-1.5 rounded-full" style={{ background: '#2DD4BF', width: '100%' }} />
                {showMarker && (
                  <div className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-slate-700 border-2 border-white shadow"
                    style={{ left: `${((pNum - priceMin) / (priceMax - priceMin)) * 100}%` }} />
                )}
              </div>
              <p className="text-xs text-slate-400">Smart pricing range: ${priceMin}–${priceMax}</p>
            </div>
          )
        })()}
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Internal Note</label>
        <input type="text" value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="Optional note..."
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex gap-2 pt-2 flex-wrap">
        <button type="button" onClick={onBook}
          className="px-3 py-2 rounded-lg text-xs font-semibold text-white"
          style={{ background: '#2DD4BF' }}>
          + Book
        </button>
        <button type="button" onClick={onBlock}
          className="px-3 py-2 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors">
          ✕ Block
        </button>
        <button type="button" onClick={handleSave} disabled={saving}
          className="px-3 py-2 rounded-lg text-xs font-semibold bg-slate-800 text-white hover:bg-slate-700 transition-colors disabled:opacity-50">
          {saving ? 'Saving…' : '💲 Save Rate'}
        </button>
      </div>
    </div>
  )
}

function BookedState({ booking, onViewBooking, onCancelBooking }: {
  booking: Booking; onViewBooking: () => void; onCancelBooking: () => void
}) {
  const initials = `${booking.guest_first_name[0] ?? ''}${booking.guest_last_name[0] ?? ''}`.toUpperCase()
  const checkIn = format(new Date(booking.check_in + 'T00:00:00'), 'MMM d')
  const checkOut = format(new Date(booking.check_out + 'T00:00:00'), 'MMM d, yyyy')

  return (
    <div className="space-y-4">
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full bg-teal-50 text-teal-700 border border-teal-100">
        ● Booked · {booking.status}
      </span>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
          style={{ background: '#2DD4BF' }}>{initials}</div>
        <div>
          <p className="font-semibold text-slate-800">{booking.guest_first_name} {booking.guest_last_name}</p>
          <p className="text-xs text-slate-500">{booking.guest_email}</p>
        </div>
      </div>
      <div className="rounded-xl bg-slate-50 divide-y divide-slate-100 text-sm">
        <div className="flex justify-between px-3 py-2">
          <span className="text-slate-500">Dates</span>
          <span className="font-medium text-slate-800">{checkIn} – {checkOut}</span>
        </div>
        <div className="flex justify-between px-3 py-2">
          <span className="text-slate-500">Total</span>
          <span className="font-medium text-slate-800">${booking.total_amount.toLocaleString()}</span>
        </div>
        <div className="flex justify-between px-3 py-2">
          <span className="text-slate-500">Nights</span>
          <span className="font-medium text-slate-800">{booking.total_nights}</span>
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        <button type="button" onClick={onCancelBooking}
          className="px-3 py-2 rounded-lg text-xs font-semibold text-red-500 hover:bg-red-50 transition-colors">
          ✕ Cancel Booking
        </button>
        <button type="button" onClick={onViewBooking}
          className="px-3 py-2 rounded-lg text-xs font-semibold text-white"
          style={{ background: '#2DD4BF' }}>
          📋 View Full Booking
        </button>
      </div>
    </div>
  )
}

function BlockedState({
  date, room, override, onUnblock,
}: {
  date: string
  room: Room
  override?: DateOverride
  onUnblock: () => void
}) {
  const [reason, setReason] = useState(override?.block_reason ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSaveReason() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/date-overrides', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_id: room.id, dates: [date], is_blocked: true, block_reason: reason }),
      })
      if (!res.ok) {
        const j = await res.json()
        setError(j.error ?? 'Failed to save note')
      }
    } catch {
      setError('Failed to save note')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full bg-red-50 text-red-600 border border-red-100">
        ✕ Blocked
      </span>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Block Reason</label>
        <input type="text" value={reason} onChange={(e) => setReason(e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex gap-2 pt-2">
        <button type="button" onClick={onUnblock}
          className="px-3 py-2 rounded-lg text-xs font-semibold text-white bg-green-500 hover:bg-green-600 transition-colors">
          ✓ Unblock Night
        </button>
        <button type="button" onClick={handleSaveReason} disabled={saving}
          className="px-3 py-2 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors disabled:opacity-50">
          {saving ? 'Saving…' : '💾 Save Note'}
        </button>
      </div>
    </div>
  )
}

function ICalState({ icalBlock, onManageIcal }: { icalBlock: ICalBlock; onManageIcal: () => void }) {
  return (
    <div className="space-y-4">
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-100">
        ◆ iCal Block
      </span>
      <div className="rounded-xl bg-slate-50 divide-y divide-slate-100 text-sm">
        <div className="flex justify-between px-3 py-2">
          <span className="text-slate-500">Platform</span>
          <span className="font-medium text-slate-800">{icalBlock.platform}</span>
        </div>
        <div className="flex justify-between px-3 py-2">
          <span className="text-slate-500">Dates</span>
          <span className="font-medium text-slate-800">
            {format(new Date(icalBlock.start_date + 'T00:00:00'), 'MMM d')} –{' '}
            {format(new Date(icalBlock.end_date + 'T00:00:00'), 'MMM d, yyyy')}
          </span>
        </div>
        <div className="flex justify-between px-3 py-2">
          <span className="text-slate-500">Last sync</span>
          <span className="font-medium text-slate-800">
            {format(new Date(icalBlock.last_synced_at), 'MMM d, h:mm a')}
          </span>
        </div>
      </div>
      <p className="text-xs text-slate-500 bg-purple-50 rounded-lg px-3 py-2 border border-purple-100">
        This block is managed by {icalBlock.platform}. Cancel on {icalBlock.platform} to remove it — it clears on the next iCal sync.
      </p>
      <div className="pt-2">
        <button type="button" onClick={onManageIcal}
          className="px-3 py-2 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors">
          ⚙️ Manage iCal Sources
        </button>
      </div>
    </div>
  )
}
