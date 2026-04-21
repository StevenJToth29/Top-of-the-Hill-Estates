# Enhanced Admin Calendar — Plan 4: Modal Suite

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build all seven modal components used by the calendar: `BlockDatesModal`, `SetPriceModal`, `AddBookingModal`, `BookingDetailModal`, `SmartPricingModal`, `NightDetailModal`, and `TaskModal`.

**Architecture:** All modals are `'use client'` components. They receive pre-filled props from the calendar page (room, date range, booking data) and call the appropriate API endpoints on submit. Each modal is a focused dialog with a dark overlay, rendered inside a `<dialog>`-style div. `NightDetailModal` is the most complex — it renders one of four states based on cell status.

**Tech Stack:** React 18, TypeScript, Tailwind CSS. `NightDetailModal` and `TaskModal` call API endpoints directly with `fetch`. `AddBookingModal` calls `POST /api/admin/bookings/manual`. `BlockDatesModal` and `SetPriceModal` call `PUT /api/admin/date-overrides`. `SmartPricingModal` calls `PATCH /api/admin/rooms/[id]`. `TaskModal` calls `POST /api/admin/calendar-tasks` or `PATCH /api/admin/calendar-tasks/[id]`.

**Dependency:** Plan 1 (Foundation) must be complete — `DateOverride`, `CalendarTask`, `Booking`, `ICalBlock`, `Room` types must exist.

---

### Task 1: Shared modal wrapper

**Files:**
- Create: `components/admin/calendar/ModalShell.tsx`

- [ ] **Step 1: Create the reusable shell**

```tsx
// components/admin/calendar/ModalShell.tsx
'use client'

import { useEffect } from 'react'

interface ModalShellProps {
  title: string
  onClose: () => void
  children: React.ReactNode
  width?: string
}

export function ModalShell({ title, onClose, children, width = 'max-w-md' }: ModalShellProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${width} flex flex-col max-h-[90vh]`}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-800">{title}</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 rounded-full p-1 transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-4">{children}</div>
      </div>
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
git add components/admin/calendar/ModalShell.tsx
git commit -m "feat: add ModalShell shared calendar modal wrapper"
```

---

### Task 2: BlockDatesModal

**Files:**
- Create: `components/admin/calendar/BlockDatesModal.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/admin/calendar/BlockDatesModal.tsx
'use client'

import { useState } from 'react'
import { format, eachDayOfInterval } from 'date-fns'
import { ModalShell } from './ModalShell'
import type { Room } from '@/types'

const REASONS = ['Maintenance', 'Personal', 'Renovation', 'Other'] as const

interface BlockDatesModalProps {
  rooms: Room[]
  initialRoomId: string
  initialFrom: string   // 'YYYY-MM-DD'
  initialTo: string     // 'YYYY-MM-DD'
  onClose: () => void
  onSuccess: (roomId: string, dates: string[]) => void
}

export function BlockDatesModal({
  rooms,
  initialRoomId,
  initialFrom,
  initialTo,
  onClose,
  onSuccess,
}: BlockDatesModalProps) {
  const [roomId, setRoomId] = useState(initialRoomId)
  const [from, setFrom] = useState(initialFrom)
  const [to, setTo] = useState(initialTo)
  const [reason, setReason] = useState<string>('Maintenance')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dates = from && to
    ? eachDayOfInterval({ start: new Date(from + 'T00:00:00'), end: new Date(to + 'T00:00:00') })
        .map((d) => format(d, 'yyyy-MM-dd'))
    : []

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!roomId || dates.length === 0) return
    setSaving(true)
    setError(null)

    try {
      const res = await fetch('/api/admin/date-overrides', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_id: roomId, dates, is_blocked: true, block_reason: reason, note }),
      })
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error ?? 'Failed to block dates')
      }
      onSuccess(roomId, dates)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalShell title="Block Dates" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Room */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Room</label>
          <select
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
          >
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>

        {/* Date range */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">From</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">To</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
          </div>
        </div>

        {/* Reason */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Reason</label>
          <div className="flex flex-wrap gap-2">
            {REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  reason === r
                    ? 'bg-teal-500 text-white border-teal-500'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-teal-300'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Note */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Note (optional)</label>
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="Additional details..."
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
        </div>

        {/* Summary */}
        {dates.length > 0 && (
          <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
            Blocking <strong>{dates.length}</strong> {dates.length === 1 ? 'night' : 'nights'} on{' '}
            <strong>{rooms.find((r) => r.id === roomId)?.name}</strong>
          </p>
        )}

        {error && <p className="text-xs text-red-500">{error}</p>}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={saving || dates.length === 0}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50"
            style={{ background: '#2DD4BF' }}>
            {saving ? 'Blocking…' : `Block ${dates.length} ${dates.length === 1 ? 'Night' : 'Nights'}`}
          </button>
        </div>
      </form>
    </ModalShell>
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
git add components/admin/calendar/BlockDatesModal.tsx
git commit -m "feat: add BlockDatesModal component"
```

---

### Task 3: SetPriceModal

**Files:**
- Create: `components/admin/calendar/SetPriceModal.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/admin/calendar/SetPriceModal.tsx
'use client'

import { useState } from 'react'
import { format, eachDayOfInterval, getDay } from 'date-fns'
import { ModalShell } from './ModalShell'
import type { Room } from '@/types'

type ApplyTo = 'all' | 'weekends' | 'weekdays'

interface SetPriceModalProps {
  rooms: Room[]
  initialRoomId: string
  initialFrom: string
  initialTo: string
  onClose: () => void
  onSuccess: (roomId: string, dates: string[], price: number) => void
}

export function SetPriceModal({
  rooms,
  initialRoomId,
  initialFrom,
  initialTo,
  onClose,
  onSuccess,
}: SetPriceModalProps) {
  const [roomId, setRoomId] = useState(initialRoomId)
  const [from] = useState(initialFrom)
  const [to] = useState(initialTo)
  const [price, setPrice] = useState<string>('')
  const [applyTo, setApplyTo] = useState<ApplyTo>('all')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const room = rooms.find((r) => r.id === roomId)
  const baseRate = room?.nightly_rate ?? 0
  const priceNum = parseFloat(price) || 0
  const pctDiff = baseRate > 0 ? ((priceNum - baseRate) / baseRate) * 100 : 0

  const allDates = from && to
    ? eachDayOfInterval({ start: new Date(from + 'T00:00:00'), end: new Date(to + 'T00:00:00') })
    : []

  const filtered = allDates.filter((d) => {
    const dow = getDay(d) // 0=Sun,1=Mon...6=Sat
    if (applyTo === 'weekends') return dow === 5 || dow === 6
    if (applyTo === 'weekdays') return dow >= 1 && dow <= 4
    return true
  })

  const dates = filtered.map((d) => format(d, 'yyyy-MM-dd'))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!roomId || !priceNum || dates.length === 0) return
    setSaving(true)
    setError(null)

    try {
      const res = await fetch('/api/admin/date-overrides', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_id: roomId, dates, price_override: priceNum }),
      })
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error ?? 'Failed to set price')
      }
      onSuccess(roomId, dates, priceNum)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalShell title="Set Price" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Room */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Room</label>
          <select value={roomId} onChange={(e) => setRoomId(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400">
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>

        {/* Price input */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Price per night</label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
              <input type="number" value={price} onChange={(e) => setPrice(e.target.value)}
                min={0} step={1} placeholder={String(baseRate)}
                className="w-full rounded-lg border border-slate-200 pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
            </div>
            {priceNum > 0 && (
              <span className={`text-xs font-semibold ${pctDiff >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {pctDiff >= 0 ? '+' : ''}{pctDiff.toFixed(0)}%
              </span>
            )}
          </div>
          {room && (
            <p className="text-xs text-slate-400 mt-1">
              Base rate: ${baseRate}/night
              {room.price_min != null && room.price_max != null &&
                ` · Smart range: $${room.price_min}–$${room.price_max}`}
            </p>
          )}
        </div>

        {/* Apply to */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-2">Apply to</label>
          <div className="flex gap-2">
            {(['all', 'weekends', 'weekdays'] as ApplyTo[]).map((v) => (
              <label key={v} className="flex items-center gap-1.5 cursor-pointer">
                <input type="radio" value={v} checked={applyTo === v}
                  onChange={() => setApplyTo(v)} className="accent-teal-500" />
                <span className="text-xs text-slate-700 capitalize">
                  {v === 'all' ? 'All selected days' : v === 'weekends' ? 'Fri–Sat only' : 'Weekdays only'}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Summary */}
        {dates.length > 0 && priceNum > 0 && (
          <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
            Setting <strong>${priceNum}</strong>/night on <strong>{dates.length}</strong>{' '}
            {dates.length === 1 ? 'night' : 'nights'}
          </p>
        )}

        {error && <p className="text-xs text-red-500">{error}</p>}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={saving || !priceNum || dates.length === 0}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50"
            style={{ background: '#2DD4BF' }}>
            {saving ? 'Saving…' : 'Save Price'}
          </button>
        </div>
      </form>
    </ModalShell>
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
git add components/admin/calendar/SetPriceModal.tsx
git commit -m "feat: add SetPriceModal component"
```

---

### Task 4: AddBookingModal

**Files:**
- Create: `components/admin/calendar/AddBookingModal.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/admin/calendar/AddBookingModal.tsx
'use client'

import { useState, useEffect } from 'react'
import { format, differenceInDays } from 'date-fns'
import { ModalShell } from './ModalShell'
import type { Room, BookingType } from '@/types'

const SOURCES = ['direct', 'airbnb', 'vrbo', 'booking.com', 'other'] as const

interface AddBookingModalProps {
  rooms: Room[]
  initialRoomId: string
  initialCheckIn: string
  initialCheckOut: string
  onClose: () => void
  onSuccess: () => void
}

export function AddBookingModal({
  rooms,
  initialRoomId,
  initialCheckIn,
  initialCheckOut,
  onClose,
  onSuccess,
}: AddBookingModalProps) {
  const [roomId, setRoomId] = useState(initialRoomId)
  const [bookingType, setBookingType] = useState<BookingType>('short_term')
  const [checkIn, setCheckIn] = useState(initialCheckIn)
  const [checkOut, setCheckOut] = useState(initialCheckOut)
  const [guests, setGuests] = useState('1')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [source, setSource] = useState<string>('direct')
  const [notes, setNotes] = useState('')
  const [smsConsent, setSmsConsent] = useState(false)
  const [marketingConsent, setMarketingConsent] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const room = rooms.find((r) => r.id === roomId)
  const nights = checkIn && checkOut
    ? Math.max(0, differenceInDays(new Date(checkOut + 'T00:00:00'), new Date(checkIn + 'T00:00:00')))
    : 0
  const suggestedTotal = room ? nights * room.nightly_rate : 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const res = await fetch('/api/admin/bookings/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_id: roomId,
          booking_type: bookingType,
          check_in: checkIn,
          check_out: checkOut,
          guest_first_name: firstName,
          guest_last_name: lastName,
          guest_email: email,
          guest_phone: phone,
          guest_count: parseInt(guests) || 1,
          source,
          notes,
          sms_consent: smsConsent,
          marketing_consent: marketingConsent,
        }),
      })
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error ?? 'Failed to create booking')
      }
      onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalShell title="Add Booking" onClose={onClose} width="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Room + type */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Room</label>
            <select value={roomId} onChange={(e) => setRoomId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400">
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
            <div className="flex rounded-lg border border-slate-200 overflow-hidden text-sm">
              {(['short_term', 'long_term'] as BookingType[]).map((t) => (
                <button key={t} type="button" onClick={() => setBookingType(t)}
                  className={`flex-1 py-2 text-xs font-medium transition-colors ${
                    bookingType === t ? 'text-white' : 'text-slate-500 hover:bg-slate-50'
                  }`}
                  style={bookingType === t ? { background: '#2DD4BF' } : {}}>
                  {t === 'short_term' ? 'Short-term' : 'Long-term'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Dates + guests */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Check-in</label>
            <input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Check-out</label>
            <input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Guests</label>
            <input type="number" value={guests} onChange={(e) => setGuests(e.target.value)}
              min={1} max={20}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
          </div>
        </div>

        {/* Guest info */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">First Name</label>
            <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Last Name</label>
            <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} required
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
          </div>
        </div>

        {/* Source */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Source</label>
          <select value={source} onChange={(e) => setSource(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400">
            {SOURCES.map((s) => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Notes (optional)</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none" />
        </div>

        {/* Consents */}
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
            <input type="checkbox" checked={smsConsent} onChange={(e) => setSmsConsent(e.target.checked)}
              className="accent-teal-500" />
            SMS consent
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
            <input type="checkbox" checked={marketingConsent} onChange={(e) => setMarketingConsent(e.target.checked)}
              className="accent-teal-500" />
            Marketing consent
          </label>
        </div>

        {/* Price summary */}
        {nights > 0 && room && (
          <div className="rounded-xl bg-teal-50 border border-teal-100 px-4 py-3 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>${room.nightly_rate} × {nights} nights</span>
              <span>${suggestedTotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between font-semibold text-slate-800 mt-1">
              <span>Suggested Total</span>
              <span>${suggestedTotal.toLocaleString()}</span>
            </div>
          </div>
        )}

        {error && <p className="text-xs text-red-500">{error}</p>}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50"
            style={{ background: '#2DD4BF' }}>
            {saving ? 'Creating…' : 'Create Booking'}
          </button>
        </div>
      </form>
    </ModalShell>
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
git add components/admin/calendar/AddBookingModal.tsx
git commit -m "feat: add AddBookingModal component"
```

---

### Task 5: BookingDetailModal

**Files:**
- Create: `components/admin/calendar/BookingDetailModal.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/admin/calendar/BookingDetailModal.tsx
'use client'

import { format } from 'date-fns'
import { ModalShell } from './ModalShell'
import type { Booking } from '@/types'

const SOURCE_COLORS: Record<string, string> = {
  airbnb: '#FF5A5F',
  vrbo: '#3D67FF',
  direct: '#2DD4BF',
  'booking.com': '#003580',
}

interface BookingDetailModalProps {
  booking: Booking
  onClose: () => void
  onViewFull: (bookingId: string) => void
  onCancelBooking: (bookingId: string) => void
}

export function BookingDetailModal({
  booking,
  onClose,
  onViewFull,
  onCancelBooking,
}: BookingDetailModalProps) {
  const initials = `${booking.guest_first_name[0] ?? ''}${booking.guest_last_name[0] ?? ''}`.toUpperCase()
  const source = booking.source as string | undefined ?? 'direct'
  const sourceColor = SOURCE_COLORS[source.toLowerCase()] ?? '#94A3B8'

  const checkIn = format(new Date(booking.check_in + 'T00:00:00'), 'MMM d, yyyy')
  const checkOut = format(new Date(booking.check_out + 'T00:00:00'), 'MMM d, yyyy')

  return (
    <ModalShell title="Booking Details" onClose={onClose}>
      <div className="space-y-4">
        {/* Guest header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0"
            style={{ background: '#2DD4BF' }}>
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-800">
              {booking.guest_first_name} {booking.guest_last_name}
            </p>
            <p className="text-xs text-slate-500 truncate">{booking.guest_email}</p>
            <p className="text-xs text-slate-500">{booking.guest_phone}</p>
          </div>
          <span className="text-xs font-semibold px-2 py-1 rounded-full text-white shrink-0"
            style={{ background: sourceColor }}>
            {source}
          </span>
        </div>

        {/* Details */}
        <div className="rounded-xl bg-slate-50 divide-y divide-slate-100 text-sm">
          {[
            { label: 'Check-in', value: checkIn },
            { label: 'Check-out', value: checkOut },
            { label: 'Duration', value: `${booking.total_nights} nights` },
            { label: 'Guests', value: String(booking.guest_count) },
            { label: 'Type', value: booking.booking_type === 'short_term' ? 'Short-term' : 'Long-term' },
            { label: 'Total', value: `$${booking.total_amount.toLocaleString()}` },
            { label: 'Status', value: booking.status },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between px-3 py-2">
              <span className="text-slate-500">{label}</span>
              <span className="font-medium text-slate-800 capitalize">{value}</span>
            </div>
          ))}
        </div>

        {booking.notes && (
          <div className="rounded-xl bg-amber-50 border border-amber-100 px-3 py-2 text-xs text-amber-800">
            <strong>Notes:</strong> {booking.notes}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={() => onCancelBooking(booking.id)}
            className="px-4 py-2 rounded-lg text-sm text-red-500 hover:bg-red-50 transition-colors">
            Cancel Booking
          </button>
          <button onClick={() => onViewFull(booking.id)}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors"
            style={{ background: '#2DD4BF' }}>
            View Full Booking
          </button>
        </div>
      </div>
    </ModalShell>
  )
}
```

- [ ] **Step 2: Note on `booking.source` and `booking.notes`**

`Booking` in `types/index.ts` does not currently have `source` or `notes` fields. Add them now as optional fields on the `Booking` interface:

In `types/index.ts`, inside the `Booking` interface after `marketing_consent`, add:

```typescript
  source?: string | null
  notes?: string | null
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/admin/calendar/BookingDetailModal.tsx types/index.ts
git commit -m "feat: add BookingDetailModal and source/notes fields to Booking type"
```

---

### Task 6: SmartPricingModal

**Files:**
- Create: `components/admin/calendar/SmartPricingModal.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/admin/calendar/SmartPricingModal.tsx
'use client'

import { useState } from 'react'
import { ModalShell } from './ModalShell'
import type { Room } from '@/types'

interface SmartPricingModalProps {
  room: Room
  onClose: () => void
  onSuccess: (roomId: string, priceMin: number, priceMax: number) => void
}

export function SmartPricingModal({ room, onClose, onSuccess }: SmartPricingModalProps) {
  const [priceMin, setPriceMin] = useState(String(room.price_min ?? Math.round(room.nightly_rate * 0.7)))
  const [priceMax, setPriceMax] = useState(String(room.price_max ?? Math.round(room.nightly_rate * 1.5)))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const min = parseFloat(priceMin)
    const max = parseFloat(priceMax)
    if (!min || !max || min >= max) {
      setError('Price floor must be less than ceiling.')
      return
    }
    setSaving(true)
    setError(null)

    try {
      const res = await fetch(`/api/admin/rooms/${room.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price_min: min, price_max: max }),
      })
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error ?? 'Failed to save pricing range')
      }
      onSuccess(room.id, min, max)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalShell title={`Smart Pricing — ${room.name}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <p className="text-xs text-slate-500">
          Set the price floor and ceiling. The future auto-pricing engine will stay within this range.
          Manual per-night overrides always take priority.
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Price Floor (min)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
              <input type="number" value={priceMin} onChange={(e) => setPriceMin(e.target.value)}
                min={1} step={1} required
                className="w-full rounded-lg border border-slate-200 pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Price Ceiling (max)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
              <input type="number" value={priceMax} onChange={(e) => setPriceMax(e.target.value)}
                min={1} step={1} required
                className="w-full rounded-lg border border-slate-200 pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
            </div>
          </div>
        </div>

        <p className="text-xs text-slate-400">
          Current base rate: <strong>${room.nightly_rate}/night</strong>
        </p>

        {/* Visual range bar */}
        {priceMin && priceMax && parseFloat(priceMin) < parseFloat(priceMax) && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-slate-400">
              <span>${priceMin}</span>
              <span>${priceMax}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 relative">
              <div className="h-2 rounded-full" style={{ background: '#2DD4BF', width: '100%' }} />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-slate-700 border-2 border-white shadow"
                style={{
                  left: `${Math.min(99, Math.max(1, ((room.nightly_rate - parseFloat(priceMin)) / (parseFloat(priceMax) - parseFloat(priceMin))) * 100))}%`,
                }}
                title={`Base rate: $${room.nightly_rate}`}
              />
            </div>
            <p className="text-xs text-center text-slate-400">▲ base rate</p>
          </div>
        )}

        {error && <p className="text-xs text-red-500">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50"
            style={{ background: '#2DD4BF' }}>
            {saving ? 'Saving…' : 'Save Range'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}
```

- [ ] **Step 2: Add PATCH support to rooms API**

Check if `app/api/admin/rooms/[id]/route.ts` exists and has a `PATCH` handler. If not, create it:

```typescript
// app/api/admin/rooms/[id]/route.ts  (PATCH handler — add alongside any existing handlers)
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, { params }: Params) {
  const serverClient = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await serverClient.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const allowed = ['price_min', 'price_max']
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  const supabase = createServiceRoleClient()
  const { data: room, error } = await supabase
    .from('rooms')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ room })
}
```

If the file already exists with other handlers, ADD the `PATCH` export to that file rather than replacing it.

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/admin/calendar/SmartPricingModal.tsx app/api/admin/rooms/
git commit -m "feat: add SmartPricingModal and PATCH /api/admin/rooms/[id] for price range"
```

---

### Task 7: NightDetailModal (4-state)

**Files:**
- Create: `components/admin/NightDetailModal.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/admin/NightDetailModal.tsx
'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { ModalShell } from './calendar/ModalShell'
import type { Booking, ICalBlock, DateOverride, Room } from '@/types'

export type NightStatus = 'available' | 'booked' | 'blocked' | 'ical'

interface NightDetailModalProps {
  status: NightStatus
  date: string          // 'YYYY-MM-DD'
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
  status,
  date,
  room,
  booking,
  icalBlock,
  override,
  onClose,
  onBook,
  onBlock,
  onUnblock,
  onViewBooking,
  onCancelBooking,
  onManageIcal,
  onSaveRate,
}: NightDetailModalProps) {
  const dateLabel = format(new Date(date + 'T00:00:00'), 'EEEE, MMMM d, yyyy')

  return (
    <ModalShell title={dateLabel} onClose={onClose}>
      {status === 'available' && (
        <AvailableState
          date={date} room={room} override={override}
          onBook={onBook} onBlock={onBlock} onSaveRate={onSaveRate}
        />
      )}
      {status === 'booked' && booking && (
        <BookedState
          booking={booking}
          onViewBooking={() => onViewBooking(booking.id)}
          onCancelBooking={() => onCancelBooking(booking.id)}
        />
      )}
      {status === 'blocked' && (
        <BlockedState
          date={date} room={room} override={override}
          onUnblock={() => onUnblock(room.id, date)}
        />
      )}
      {status === 'ical' && icalBlock && (
        <ICalState icalBlock={icalBlock} onManageIcal={onManageIcal} />
      )}
    </ModalShell>
  )
}

function AvailableState({
  date, room, override, onBook, onBlock, onSaveRate,
}: {
  date: string
  room: Room
  override?: DateOverride
  onBook: () => void
  onBlock: () => void
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
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full bg-green-50 text-green-700 border border-green-100">
          ● Available
        </span>
      </div>

      {/* Rate input */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Nightly Rate</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
          <input type="number" value={price} onChange={(e) => setPrice(e.target.value)}
            min={1} step={1}
            className="w-full rounded-lg border border-slate-200 pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
        </div>

        {priceMin != null && priceMax != null && (
          <div className="mt-2 space-y-1">
            <div className="flex justify-between text-xs text-slate-400">
              <span>${priceMin}</span>
              <span>${priceMax}</span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-100 relative">
              <div className="h-1.5 rounded-full" style={{ background: '#2DD4BF', width: '100%' }} />
              {parseFloat(price) >= priceMin && parseFloat(price) <= priceMax && (
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-slate-700 border-2 border-white shadow"
                  style={{
                    left: `${((parseFloat(price) - priceMin) / (priceMax - priceMin)) * 100}%`,
                  }}
                />
              )}
            </div>
            <p className="text-xs text-slate-400">Smart pricing range: ${priceMin}–${priceMax}</p>
          </div>
        )}
      </div>

      {/* Note */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Internal Note</label>
        <input type="text" value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="Optional note..."
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex gap-2 pt-2 flex-wrap">
        <button onClick={onBook}
          className="px-3 py-2 rounded-lg text-xs font-semibold text-white transition-colors"
          style={{ background: '#2DD4BF' }}>
          + Book
        </button>
        <button onClick={onBlock}
          className="px-3 py-2 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors">
          ✕ Block
        </button>
        <button onClick={handleSave} disabled={saving}
          className="px-3 py-2 rounded-lg text-xs font-semibold bg-slate-800 text-white hover:bg-slate-700 transition-colors disabled:opacity-50">
          {saving ? 'Saving…' : '💲 Save Rate'}
        </button>
      </div>
    </div>
  )
}

function BookedState({
  booking, onViewBooking, onCancelBooking,
}: {
  booking: Booking
  onViewBooking: () => void
  onCancelBooking: () => void
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
          style={{ background: '#2DD4BF' }}>
          {initials}
        </div>
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
        <button onClick={onCancelBooking}
          className="px-3 py-2 rounded-lg text-xs font-semibold text-red-500 hover:bg-red-50 transition-colors">
          ✕ Cancel Booking
        </button>
        <button onClick={onViewBooking}
          className="px-3 py-2 rounded-lg text-xs font-semibold text-white transition-colors"
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

  async function handleSaveReason() {
    setSaving(true)
    await fetch('/api/admin/date-overrides', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room_id: room.id, dates: [date], is_blocked: true, block_reason: reason }),
    })
    setSaving(false)
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

      <div className="flex gap-2 pt-2">
        <button onClick={onUnblock}
          className="px-3 py-2 rounded-lg text-xs font-semibold text-white bg-green-500 hover:bg-green-600 transition-colors">
          ✓ Unblock Night
        </button>
        <button onClick={handleSaveReason} disabled={saving}
          className="px-3 py-2 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors disabled:opacity-50">
          {saving ? 'Saving…' : '💾 Save Note'}
        </button>
      </div>
    </div>
  )
}

function ICalState({
  icalBlock, onManageIcal,
}: {
  icalBlock: ICalBlock
  onManageIcal: () => void
}) {
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
        <button onClick={onManageIcal}
          className="px-3 py-2 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors">
          ⚙️ Manage iCal Sources
        </button>
      </div>
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
git add components/admin/NightDetailModal.tsx
git commit -m "feat: add NightDetailModal 4-state component"
```

---

### Task 8: TaskModal

**Files:**
- Create: `components/admin/TaskModal.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/admin/TaskModal.tsx
'use client'

import { useState } from 'react'
import { ModalShell } from './calendar/ModalShell'
import type { Room, CalendarTask } from '@/types'

const PRESET_COLORS = ['#6366F1', '#2DD4BF', '#F59E0B', '#EF4444', '#10B981', '#8B5CF6']
const RECURRENCE_OPTIONS = [
  { label: 'None', value: '' },
  { label: 'Daily', value: 'FREQ=DAILY' },
  { label: 'Weekly', value: 'FREQ=WEEKLY' },
  { label: 'Monthly', value: 'FREQ=MONTHLY' },
  { label: 'Custom (RRULE)', value: 'custom' },
]

interface TaskModalProps {
  rooms: Room[]
  task?: CalendarTask          // if provided, edit mode
  initialRoomId?: string | null  // null = property-wide
  initialDate?: string
  onClose: () => void
  onSuccess: (task: CalendarTask) => void
  onDelete?: (taskId: string) => void
}

export function TaskModal({
  rooms,
  task,
  initialRoomId = null,
  initialDate,
  onClose,
  onSuccess,
  onDelete,
}: TaskModalProps) {
  const isEdit = !!task

  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [scope, setScope] = useState<'property' | 'room'>(
    (task?.room_id ?? initialRoomId) ? 'room' : 'property',
  )
  const [roomId, setRoomId] = useState(task?.room_id ?? initialRoomId ?? '')
  const [date, setDate] = useState(task?.due_date ?? initialDate ?? '')
  const [recurrencePreset, setRecurrencePreset] = useState(() => {
    if (!task?.recurrence_rule) return ''
    const preset = RECURRENCE_OPTIONS.find(
      (o) => o.value === task.recurrence_rule && o.value !== 'custom',
    )
    return preset ? preset.value : 'custom'
  })
  const [customRRule, setCustomRRule] = useState(
    recurrencePreset === 'custom' ? (task?.recurrence_rule ?? '') : '',
  )
  const [recurrenceEnd, setRecurrenceEnd] = useState(task?.recurrence_end_date ?? '')
  const [status, setStatus] = useState<'pending' | 'complete'>(task?.status ?? 'pending')
  const [color, setColor] = useState(task?.color ?? PRESET_COLORS[0])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const effectiveRRule =
    recurrencePreset === 'custom' ? customRRule : recurrencePreset

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !date) return
    setSaving(true)
    setError(null)

    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      due_date: date,
      room_id: scope === 'room' && roomId ? roomId : null,
      recurrence_rule: effectiveRRule || null,
      recurrence_end_date: recurrenceEnd || null,
      status,
      color,
    }

    try {
      const url = isEdit
        ? `/api/admin/calendar-tasks/${task!.id}`
        : '/api/admin/calendar-tasks'
      const method = isEdit ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error ?? 'Failed to save task')
      }
      const j = await res.json()
      onSuccess(j.task)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!task || !onDelete) return
    if (!confirm(`Delete task "${task.title}"?`)) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/calendar-tasks/${task.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete task')
      onDelete(task.id)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setSaving(false)
    }
  }

  return (
    <ModalShell title={isEdit ? 'Edit Task' : 'Add Task'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Title */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Title *</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none" />
        </div>

        {/* Scope */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-2">Scope</label>
          <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs">
            {[
              { v: 'property', label: 'Property-wide' },
              { v: 'room', label: 'Room-specific' },
            ].map(({ v, label }) => (
              <button key={v} type="button" onClick={() => setScope(v as 'property' | 'room')}
                className={`flex-1 py-2 font-medium transition-colors ${
                  scope === v ? 'text-white' : 'text-slate-500 hover:bg-slate-50'
                }`}
                style={scope === v ? { background: '#2DD4BF' } : {}}>
                {label}
              </button>
            ))}
          </div>

          {scope === 'room' && (
            <select value={roomId} onChange={(e) => setRoomId(e.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400">
              <option value="">Select a room…</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Date */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Date *</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
        </div>

        {/* Recurrence */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Recurrence</label>
          <select value={recurrencePreset} onChange={(e) => setRecurrencePreset(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400">
            {RECURRENCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          {recurrencePreset === 'custom' && (
            <input type="text" value={customRRule} onChange={(e) => setCustomRRule(e.target.value)}
              placeholder="e.g. FREQ=WEEKLY;BYDAY=MO,FR"
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-teal-400" />
          )}

          {recurrencePreset && (
            <div className="mt-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Ends</label>
              <input type="date" value={recurrenceEnd} onChange={(e) => setRecurrenceEnd(e.target.value)}
                placeholder="Never"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
            </div>
          )}
        </div>

        {/* Status */}
        <div className="flex items-center gap-2">
          <input type="checkbox" id="task-status"
            checked={status === 'complete'}
            onChange={(e) => setStatus(e.target.checked ? 'complete' : 'pending')}
            className="accent-teal-500 w-4 h-4" />
          <label htmlFor="task-status" className="text-sm text-slate-600 cursor-pointer">
            Mark as complete
          </label>
        </div>

        {/* Color */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-2">Color</label>
          <div className="flex gap-2">
            {PRESET_COLORS.map((c) => (
              <button key={c} type="button" onClick={() => setColor(c)}
                className={`w-6 h-6 rounded-full transition-transform ${color === c ? 'scale-125 ring-2 ring-offset-1 ring-slate-400' : 'hover:scale-110'}`}
                style={{ background: c }} />
            ))}
          </div>
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        {/* Actions */}
        <div className="flex justify-between gap-3 pt-2">
          <div>
            {isEdit && onDelete && (
              <button type="button" onClick={handleDelete} disabled={saving}
                className="px-3 py-2 rounded-lg text-xs font-semibold text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50">
                Delete
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50"
              style={{ background: '#2DD4BF' }}>
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Task'}
            </button>
          </div>
        </div>
      </form>
    </ModalShell>
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
git add components/admin/TaskModal.tsx
git commit -m "feat: add TaskModal with recurrence support"
```

---

### Task 9: Final type-check for the entire modal suite

- [ ] **Step 1: Run type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 2: Verify all files exist**

```bash
ls components/admin/calendar/ModalShell.tsx \
   components/admin/calendar/BlockDatesModal.tsx \
   components/admin/calendar/SetPriceModal.tsx \
   components/admin/calendar/AddBookingModal.tsx \
   components/admin/calendar/BookingDetailModal.tsx \
   components/admin/calendar/SmartPricingModal.tsx \
   components/admin/NightDetailModal.tsx \
   components/admin/TaskModal.tsx
```

Expected: all eight paths print without error.
