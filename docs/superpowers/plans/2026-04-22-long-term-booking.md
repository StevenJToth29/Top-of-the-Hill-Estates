# Long Term Booking — Calendar Visual & Full Edit Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render `long_term` bookings with a diagonal stripe on the admin calendar and enable full booking editing with automatic Stripe payment adjustments.

**Architecture:** Calendar visual changes are self-contained to two components and the calendar API. The edit form is a new modal component (`EditBookingForm`) wired to a new `PATCH /api/admin/bookings/[id]/edit` route that handles date validation, total recalculation, Stripe refunds/payment requests, and email triggering. The email system gains one new trigger event `booking_payment_request`.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, Supabase, Stripe SDK, Jest + jsdom for tests, date-fns

---

## File Map

| File | New / Modify | Purpose |
|---|---|---|
| `types/index.ts` | Modify | Add `'booking_payment_request'` to `TriggerEvent` union |
| `lib/email-queue.ts` | Modify | Add payment request context type; inject `payment_amount` + `payment_link` variables |
| `components/admin/RoomsCalendar.tsx` | Modify | Add `long_term` DayStatus, diagonal stripe, open-ended tail arrow, legend entry |
| `app/api/admin/rooms/[id]/calendar/route.ts` | Modify | Add `booking_type` to bookings select |
| `components/admin/RoomCalendarModal.tsx` | Modify | Add `long_term` bar type, diagonal stripe, legend entry, handle OPEN_ENDED_DATE |
| `supabase/migrations/017_booking_payment_request_email.sql` | New | Seed default `booking_payment_request` automation |
| `components/admin/EditBookingForm.tsx` | New | Edit modal — all fields, client-side delta preview, submits to edit API |
| `app/api/admin/bookings/[id]/edit/route.ts` | New | PATCH route — validates, recalculates, updates DB, handles Stripe |
| `__tests__/api/bookings-edit.test.ts` | New | Jest tests for edit route |
| `components/admin/BookingDetailPanel.tsx` | Modify | Enable Edit button, render EditBookingForm modal |

---

## Task 1: Add `booking_payment_request` to email system types

**Files:**
- Modify: `types/index.ts:260-271`
- Modify: `lib/email-queue.ts:118-121`

- [ ] **Step 1: Add the new trigger event to the TriggerEvent union in `types/index.ts`**

Find the `TriggerEvent` type (line 260) and add the new value:

```typescript
export type TriggerEvent =
  | 'booking_confirmed'
  | 'booking_pending'
  | 'booking_cancelled'
  | 'contact_submitted'
  | 'checkin_reminder'
  | 'checkout_reminder'
  | 'post_checkout'
  | 'review_request'
  | 'modification_requested'
  | 'admin_new_booking'
  | 'admin_cancelled'
  | 'booking_payment_request'
```

- [ ] **Step 2: Add the payment request context type to `lib/email-queue.ts`**

Find the `EmailContext` type (line 118) and add the new variant:

```typescript
export type EmailContext =
  | { type: 'booking'; bookingId: string }
  | { type: 'booking_payment_request'; bookingId: string; paymentAmount: string; paymentLink: string }
  | ({ type: 'contact' } & ContactContext)
```

- [ ] **Step 3: Handle the new context type in `evaluateAndQueueEmails`**

In `lib/email-queue.ts`, the section that resolves variables (around line 165) currently does:

```typescript
const variables =
  booking?.room
    ? buildBookingVariables(...)
    : context.type === 'contact'
    ? buildContactVariables(...)
    : {}
```

Replace it with:

```typescript
let variables: Record<string, string> =
  booking?.room
    ? buildBookingVariables(
        booking,
        booking.room as Room & { property?: Property },
        siteSettings as SiteSettings | null,
        emailSettings as EmailSettings | null,
      )
    : context.type === 'contact'
    ? buildContactVariables(
        context as ContactContext,
        siteSettings as SiteSettings | null,
        emailSettings as EmailSettings | null,
      )
    : {}

if (context.type === 'booking_payment_request') {
  variables = {
    ...variables,
    payment_amount: context.paymentAmount,
    payment_link: context.paymentLink,
  }
}
```

Also update the `booking` fetch condition so `booking_payment_request` triggers a booking fetch. Find the check `if (context.type === 'booking')` and change it to:

```typescript
if (context.type === 'booking' || context.type === 'booking_payment_request') {
  const { data } = await supabase
    .from('bookings')
    .select('*, room:rooms(*, property:properties(*))')
    .eq('id', context.bookingId)
    .single()
  if (!data) {
    console.error(`evaluateAndQueueEmails: booking ${context.bookingId} not found`)
    return
  }
  booking = data as Booking
}
```

- [ ] **Step 4: Type-check passes**

```bash
npx tsc --noEmit 2>&1 | grep -E "email-queue|TriggerEvent" | head -20
```

Expected: no errors referencing these files.

- [ ] **Step 5: Commit**

```bash
git add types/index.ts lib/email-queue.ts
git commit -m "feat: add booking_payment_request trigger event to email system"
```

---

## Task 2: Long Term visual in RoomsCalendar

**Files:**
- Modify: `components/admin/RoomsCalendar.tsx`

- [ ] **Step 1: Update the `DayStatus` type and `DayInfo` interface**

Replace:

```typescript
type DayStatus = 'available' | 'booking' | 'ical'

interface DayInfo {
  status: DayStatus
  tooltip: string
  initial?: string
}
```

With:

```typescript
type DayStatus = 'available' | 'booking' | 'long_term' | 'ical'

interface DayInfo {
  status: DayStatus
  tooltip: string
  initial?: string
  isOpenEndedTail?: boolean
}
```

- [ ] **Step 2: Update `getDayInfo` to detect long_term bookings**

Add `endOfMonth` to the date-fns import line:

```typescript
import {
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  parseISO,
  isToday,
  isBefore,
  isSameDay,
  isSunday,
} from 'date-fns'
```

Replace the booking loop inside `getDayInfo` (currently lines 44–59):

```typescript
for (const booking of bookings) {
  if (booking.room_id !== roomId) continue
  try {
    const start = parseISO(booking.check_in)
    const end = parseISO(booking.check_out)
    if (!isBefore(date, start) && isBefore(date, end)) {
      const isLongTerm = booking.booking_type === 'long_term'
      const isOpenEnded = booking.check_out === OPEN_ENDED_DATE
      return {
        status: isLongTerm ? 'long_term' : 'booking',
        tooltip: `${booking.guest_first_name} ${booking.guest_last_name} (${booking.check_in} – ${isOpenEnded ? 'open-ended' : booking.check_out}) [${booking.status}]`,
        initial: (booking.guest_last_name[0] ?? '').toUpperCase(),
        isOpenEndedTail: isLongTerm && isOpenEnded && isSameDay(date, endOfMonth(date)),
      }
    }
  } catch {
    // ignore malformed ISO dates
  }
}
```

- [ ] **Step 3: Update cell rendering to apply diagonal stripe for `long_term`**

In the `<td>` JSX (currently inside the `days.map` around line 189), update the `className` and add a `style` prop. Replace the `clsx(...)` in the `td`:

```tsx
<td
  key={dateStr}
  title={tooltip}
  style={
    status === 'long_term'
      ? {
          background:
            'repeating-linear-gradient(45deg, rgba(100,116,139,0.18) 0, rgba(100,116,139,0.18) 2px, transparent 2px, transparent 7px)',
          ...(isOpenEndedTail
            ? { borderRight: '2px dashed rgba(100,116,139,0.45)' }
            : {}),
        }
      : undefined
  }
  className={clsx(
    'h-8 p-0 text-center cursor-default transition-colors',
    isFirst && 'border-l-2 border-l-primary/25',
    isSun && !isFirst && 'border-l border-l-outline-variant/40',
    status === 'booking' && 'bg-secondary/25 hover:bg-secondary/35',
    status === 'long_term' && 'hover:brightness-95',
    status === 'ical' && 'bg-primary/15 hover:bg-primary/25',
    status === 'available' && 'hover:bg-surface-high',
    todayDay && status === 'available' && 'ring-1 ring-inset ring-primary/40',
  )}
>
  {status === 'booking' && initial && (
    <span className="text-secondary text-[9px] font-bold leading-none select-none">
      {initial}
    </span>
  )}
  {status === 'long_term' && !isOpenEndedTail && initial && (
    <span className="text-slate-500 text-[9px] font-bold leading-none select-none">
      {initial}
    </span>
  )}
  {status === 'long_term' && isOpenEndedTail && (
    <span className="text-slate-400 text-[10px] font-semibold leading-none select-none">→</span>
  )}
  {status === 'ical' && (
    <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary/60" />
  )}
</td>
```

- [ ] **Step 4: Add Long Term entry to the legend**

In the legend section (around line 242), add after the Booking pill and before iCal Block:

```tsx
<div className="flex items-center gap-2 bg-surface-container rounded-full px-3 py-1 border border-outline-variant/60">
  <div
    className="w-3.5 h-3.5 rounded-sm flex-shrink-0"
    style={{
      background:
        'repeating-linear-gradient(45deg, rgba(100,116,139,0.5) 0, rgba(100,116,139,0.5) 2px, transparent 2px, transparent 5px)',
    }}
  />
  <span className="text-xs text-on-surface-variant">Long Term</span>
</div>
```

- [ ] **Step 5: Verify in browser**

Open http://localhost:3000/admin/calendar. If there are no long_term bookings to test with, create one manually via the booking form (set type to Long Term, check "No end date"). Confirm:
- Long term booking shows diagonal stripe
- Regular booking still shows teal
- Legend has Long Term entry

- [ ] **Step 6: Commit**

```bash
git add components/admin/RoomsCalendar.tsx
git commit -m "feat: render long_term bookings with diagonal stripe in RoomsCalendar"
```

---

## Task 3: Calendar API + RoomCalendarModal long_term support

**Files:**
- Modify: `app/api/admin/rooms/[id]/calendar/route.ts`
- Modify: `components/admin/RoomCalendarModal.tsx`

- [ ] **Step 1: Add `booking_type` to the calendar API select**

In `app/api/admin/rooms/[id]/calendar/route.ts`, line 19, change:

```typescript
.select('id, room_id, check_in, check_out, guest_first_name, guest_last_name, status')
```

to:

```typescript
.select('id, room_id, check_in, check_out, guest_first_name, guest_last_name, status, booking_type')
```

- [ ] **Step 2: Add `booking_type` to the `CalendarBooking` interface in `RoomCalendarModal.tsx`**

Find the `CalendarBooking` interface (line 12) and add the field:

```typescript
interface CalendarBooking {
  id: string
  room_id: string
  check_in: string
  check_out: string
  guest_first_name: string
  guest_last_name: string
  status: string
  booking_type: string
}
```

- [ ] **Step 3: Add `isOpenEnded` to `EventBar` and update the type union**

Replace:

```typescript
interface EventBar {
  id: string
  type: 'booking' | 'ical'
  label: string
  colStart: number
  span: number
  isStart: boolean
  isEnd: boolean
}
```

With:

```typescript
interface EventBar {
  id: string
  type: 'booking' | 'long_term' | 'ical'
  label: string
  colStart: number
  span: number
  isStart: boolean
  isEnd: boolean
  isOpenEnded?: boolean
}
```

- [ ] **Step 4: Add OPEN_ENDED_DATE import to `RoomCalendarModal.tsx`**

```typescript
import { OPEN_ENDED_DATE } from '@/lib/format'
```

- [ ] **Step 5: Update `getBarsForWeek` to detect long_term and handle open-ended**

In the booking loop (lines 78–93), replace:

```typescript
for (const b of bookings) {
  const s = parseISO(b.check_in)
  // check_out is exclusive (last occupied night is the day before)
  const e = addDays(parseISO(b.check_out), -1)
  if (isAfter(s, weekEnd) || isBefore(e, weekStart)) continue
  const { colStart, span, isStart, isEnd } = clampToWeek(s, e, weekDays)
  bars.push({
    id: b.id,
    type: 'booking',
    label: `${b.guest_first_name} ${b.guest_last_name}`,
    colStart,
    span,
    isStart,
    isEnd,
  })
}
```

With:

```typescript
for (const b of bookings) {
  const s = parseISO(b.check_in)
  const isOpenEnded = b.check_out === OPEN_ENDED_DATE
  // check_out is exclusive; for open-ended we use end-of-week as the visual cap
  const e = isOpenEnded ? addDays(weekEnd, 1) : addDays(parseISO(b.check_out), -1)
  if (isAfter(s, weekEnd) || (!isOpenEnded && isBefore(e, weekStart))) continue
  const { colStart, span, isStart, isEnd } = clampToWeek(s, e, weekDays)
  bars.push({
    id: b.id,
    type: b.booking_type === 'long_term' ? 'long_term' : 'booking',
    label: `${b.guest_first_name} ${b.guest_last_name}`,
    colStart,
    span,
    isStart,
    isEnd: isOpenEnded ? false : isEnd,
    isOpenEnded,
  })
}
```

- [ ] **Step 6: Update bar rendering to apply diagonal stripe for long_term**

Find the event bar `<div>` (around line 263) that renders bars in the weeks. Replace the `className` logic:

```tsx
<div
  key={bar.id}
  title={bar.label}
  style={{
    gridColumn: `${bar.colStart} / span ${bar.span}`,
    ...(bar.type === 'long_term'
      ? {
          background:
            'repeating-linear-gradient(45deg, rgba(100,116,139,0.25) 0, rgba(100,116,139,0.25) 2px, transparent 2px, transparent 7px)',
          borderRight: bar.isOpenEnded ? '2px dashed rgba(100,116,139,0.45)' : undefined,
        }
      : {}),
  }}
  className={[
    'h-6 flex items-center px-2 text-xs font-medium overflow-hidden whitespace-nowrap mx-0.5',
    bar.isStart ? 'rounded-l-full' : '',
    bar.isEnd ? 'rounded-r-full' : '',
    bar.type === 'booking' ? 'bg-secondary/30 text-secondary' : '',
    bar.type === 'long_term' ? 'text-slate-500' : '',
    bar.type === 'ical' ? 'bg-primary/20 text-primary' : '',
  ].join(' ')}
>
  {bar.isStart && (
    <span className="truncate">{bar.label}</span>
  )}
</div>
```

- [ ] **Step 7: Add Long Term to the modal legend**

Find the legend section at the bottom (around line 306) and add after the Booking entry:

```tsx
<div className="flex items-center gap-2">
  <div
    className="w-3.5 h-3.5 rounded-sm flex-shrink-0"
    style={{
      background:
        'repeating-linear-gradient(45deg, rgba(100,116,139,0.45) 0, rgba(100,116,139,0.45) 2px, transparent 2px, transparent 5px)',
    }}
  />
  <span className="text-xs text-on-surface-variant">Long Term</span>
</div>
```

- [ ] **Step 8: Verify in browser**

Click a room name on the calendar to open the RoomCalendarModal. Long term bookings should show the diagonal stripe bar. Open-ended ones should show dashed right border with no rounded end cap.

- [ ] **Step 9: Commit**

```bash
git add app/api/admin/rooms/\[id\]/calendar/route.ts components/admin/RoomCalendarModal.tsx
git commit -m "feat: long_term booking visual in RoomCalendarModal and calendar API"
```

---

## Task 4: Email automation migration

**Files:**
- Create: `supabase/migrations/017_booking_payment_request_email.sql`

- [ ] **Step 1: Check the last migration number**

```bash
ls supabase/migrations/ | sort | tail -5
```

Confirm the last file is `016_*`. If a `017_*` already exists, use `018_`.

- [ ] **Step 2: Create the migration**

Create `supabase/migrations/017_booking_payment_request_email.sql`:

```sql
-- Seed default booking_payment_request email automation
-- This automation fires when an edit increases the booking total and a Stripe
-- payment request link is generated for the guest.

-- First, create a placeholder email template for the payment request
INSERT INTO email_templates (id, name, subject, body, design, is_active, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'Payment Request — Additional Amount Due',
  'Payment Request — Additional Amount Due for Your Booking',
  '<p>Hi {{guest_first_name}},</p>
<p>Your booking at {{unit_name}} ({{property_name}}) has been updated and an additional payment of <strong>{{payment_amount}}</strong> is now due.</p>
<p><a href="{{payment_link}}" style="background:#2DD4BF;color:#0F172A;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block;margin:16px 0">Pay {{payment_amount}} Now</a></p>
<p>If you have any questions, please contact us.</p>',
  NULL,
  true,
  now(),
  now()
)
ON CONFLICT DO NOTHING;

-- Create the automation that uses this template
INSERT INTO email_automations (
  id,
  name,
  trigger_event,
  is_active,
  delay_minutes,
  conditions,
  template_id,
  recipient_type,
  is_pre_planned,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  'Payment Request — Additional Amount Due',
  'booking_payment_request',
  true,
  0,
  '{"operator":"AND","rules":[]}'::jsonb,
  t.id,
  'guest',
  true,
  now(),
  now()
FROM email_templates t
WHERE t.name = 'Payment Request — Additional Amount Due'
ON CONFLICT DO NOTHING;
```

- [ ] **Step 3: Apply the migration**

```bash
npx supabase db push
```

Expected output: migration applied without errors.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/017_booking_payment_request_email.sql
git commit -m "feat: seed booking_payment_request email automation"
```

---

## Task 5: EditBookingForm component

**Files:**
- Create: `components/admin/EditBookingForm.tsx`

- [ ] **Step 1: Create the component file**

Create `components/admin/EditBookingForm.tsx`:

```tsx
'use client'

import { useState, useEffect } from 'react'
import { differenceInCalendarDays, parseISO } from 'date-fns'
import { XMarkIcon } from '@heroicons/react/24/outline'
import type { Booking, Room, Property } from '@/types'
import { OPEN_ENDED_DATE, formatCurrency } from '@/lib/format'

interface Props {
  booking: Booking & { room: Room & { property: Property } }
  onClose: () => void
  onSaved: (updated: Booking) => void
}

function computeShortTermTotal(
  checkIn: string,
  checkOut: string,
  nightlyRate: number,
  cleaningFee: number,
  extraGuestFee: number,
  extraGuests: number,
): number {
  const [ciY, ciM, ciD] = checkIn.split('-').map(Number)
  const [coY, coM, coD] = checkOut.split('-').map(Number)
  const start = new Date(Date.UTC(ciY, ciM - 1, ciD))
  const end = new Date(Date.UTC(coY, coM - 1, coD))
  let nights = 0
  const cur = new Date(start)
  while (cur < end) {
    nights++
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return nightlyRate * nights + cleaningFee + extraGuestFee * extraGuests * nights
}

function computeLongTermTotal(
  monthlyRate: number,
  securityDeposit: number,
  extraGuestFee: number,
  extraGuests: number,
): number {
  return monthlyRate + securityDeposit + extraGuestFee * extraGuests
}

export default function EditBookingForm({ booking, onClose, onSaved }: Props) {
  const [checkIn, setCheckIn] = useState(booking.check_in)
  const [checkOut, setCheckOut] = useState(
    booking.check_out === OPEN_ENDED_DATE ? '' : booking.check_out,
  )
  const [openEnded, setOpenEnded] = useState(booking.check_out === OPEN_ENDED_DATE)
  const [firstName, setFirstName] = useState(booking.guest_first_name)
  const [lastName, setLastName] = useState(booking.guest_last_name)
  const [email, setEmail] = useState(booking.guest_email)
  const [phone, setPhone] = useState(booking.guest_phone)
  const [guestCount, setGuestCount] = useState(booking.guest_count)
  const [notes, setNotes] = useState(booking.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const room = booking.room
  const isLongTerm = booking.booking_type === 'long_term'

  // Client-side total preview using current room rates (not booking snapshot)
  const newTotal = (() => {
    const extraGuests = Math.max(0, guestCount - 1)
    if (isLongTerm) {
      return computeLongTermTotal(
        room.monthly_rate,
        room.security_deposit ?? 0,
        room.extra_guest_fee ?? 0,
        extraGuests,
      )
    }
    if (!checkOut || checkOut === OPEN_ENDED_DATE) return booking.total_amount
    return computeShortTermTotal(
      checkIn,
      checkOut,
      room.nightly_rate,
      room.cleaning_fee ?? 0,
      room.extra_guest_fee ?? 0,
      extraGuests,
    )
  })()

  const delta = newTotal - booking.amount_paid
  const hasStripe = !!booking.stripe_payment_intent_id

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/bookings/${booking.id}/edit`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          check_in: checkIn,
          check_out: openEnded ? OPEN_ENDED_DATE : checkOut,
          guest_first_name: firstName,
          guest_last_name: lastName,
          guest_email: email,
          guest_phone: phone,
          guest_count: guestCount,
          notes: notes || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to save changes')
        return
      }
      onSaved(data.booking)
    } catch {
      setError('Network error — please try again')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden max-h-[95vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-teal-50/60 to-white shrink-0">
          <div>
            <h3 className="font-display text-base font-bold text-slate-900">Edit Booking</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              #{booking.id.slice(0, 8).toUpperCase()} · {booking.guest_first_name} {booking.guest_last_name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
          <form id="edit-booking-form" onSubmit={handleSubmit}>

            {/* Stay Dates */}
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Stay Dates</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Check-in</label>
                  <input
                    type="date"
                    value={checkIn}
                    onChange={(e) => setCheckIn(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-400/40 focus:border-teal-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Check-out</label>
                  <input
                    type="date"
                    value={checkOut}
                    onChange={(e) => setCheckOut(e.target.value)}
                    disabled={openEnded}
                    required={!openEnded}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-400/40 focus:border-teal-400 disabled:opacity-40 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              {isLongTerm && (
                <label className="flex items-center gap-2.5 mt-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={openEnded}
                    onChange={(e) => {
                      setOpenEnded(e.target.checked)
                      if (e.target.checked) setCheckOut('')
                    }}
                    className="w-4 h-4 rounded border-slate-300 text-slate-600 focus:ring-teal-400"
                  />
                  <span className="text-xs text-slate-600">No end date (open-ended tenancy)</span>
                  <span className="ml-auto text-[10px] text-slate-400">Long Term only</span>
                </label>
              )}
            </div>

            <hr className="border-slate-100" />

            {/* Guest */}
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Guest</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">First Name</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-400/40 focus:border-teal-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Last Name</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-400/40 focus:border-teal-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-400/40 focus:border-teal-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-400/40 focus:border-teal-400"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Guests</label>
                  <input
                    type="number"
                    min={1}
                    value={guestCount}
                    onChange={(e) => setGuestCount(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-400/40 focus:border-teal-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Notes</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-400/40 focus:border-teal-400"
                    placeholder="Admin notes…"
                  />
                </div>
              </div>
            </div>

            {/* Payment adjustment preview */}
            {Math.abs(newTotal - booking.total_amount) >= 0.01 && (
              <>
                <hr className="border-slate-100" />
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Payment Adjustment</p>
                  <div
                    className="rounded-xl p-3 text-sm space-y-1.5"
                    style={{
                      background: delta > 0 ? 'rgba(245,158,11,0.07)' : 'rgba(16,185,129,0.07)',
                      border: `1px solid ${delta > 0 ? 'rgba(245,158,11,0.25)' : 'rgba(16,185,129,0.2)'}`,
                    }}
                  >
                    <div className="flex justify-between text-slate-500">
                      <span>Original total</span>
                      <span className="font-semibold text-slate-800">{formatCurrency(booking.total_amount)}</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>New total</span>
                      <span className="font-semibold text-slate-800">{formatCurrency(newTotal)}</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Already paid</span>
                      <span className="font-semibold text-slate-800">{formatCurrency(booking.amount_paid)}</span>
                    </div>
                    <div
                      className="flex justify-between pt-1.5 mt-1 border-t border-black/10"
                    >
                      <span className="font-bold text-slate-700">{delta > 0 ? 'Additional charge' : 'Refund'}</span>
                      <span
                        className="font-bold"
                        style={{ color: delta > 0 ? '#b45309' : '#059669' }}
                      >
                        {delta > 0 ? '+' : '−'}{formatCurrency(Math.abs(delta))}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 pt-1 leading-relaxed">
                      {delta > 0
                        ? hasStripe
                          ? `A payment request for ${formatCurrency(delta)} will be emailed to ${email} automatically on save.`
                          : `Balance updated on record. No Stripe payment to process (manual booking).`
                        : hasStripe
                        ? `A Stripe refund of ${formatCurrency(Math.abs(delta))} will be issued automatically on save.`
                        : `Balance updated on record. No Stripe refund to process (manual booking).`}
                    </p>
                  </div>
                </div>
              </>
            )}

          </form>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-100 flex justify-between items-center shrink-0">
          {error && <p className="text-xs text-red-500 mr-3">{error}</p>}
          {!error && <span />}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="edit-booking-form"
              disabled={saving}
              className="px-5 py-2 rounded-xl text-sm font-bold bg-teal-400 text-slate-900 hover:bg-teal-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type-check the new component**

```bash
npx tsc --noEmit 2>&1 | grep "EditBookingForm" | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/admin/EditBookingForm.tsx
git commit -m "feat: add EditBookingForm modal component"
```

---

## Task 6: Edit booking API route

**Files:**
- Create: `app/api/admin/bookings/[id]/edit/route.ts`

- [ ] **Step 1: Create the route file**

Create `app/api/admin/bookings/[id]/edit/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createServiceRoleClient, createServerSupabaseClient } from '@/lib/supabase'
import { isRoomAvailableExcluding } from '@/lib/availability'
import { OPEN_ENDED_DATE } from '@/lib/format'
import { evaluateAndQueueEmails } from '@/lib/email-queue'
import type { Booking, BookingType } from '@/types'

function computeNightlySubtotal(
  checkIn: string,
  checkOut: string,
  baseRate: number,
  overrideMap: Record<string, number>,
): number {
  const [ciY, ciM, ciD] = checkIn.split('-').map(Number)
  const [coY, coM, coD] = checkOut.split('-').map(Number)
  const start = new Date(Date.UTC(ciY, ciM - 1, ciD))
  const end = new Date(Date.UTC(coY, coM - 1, coD))
  let total = 0
  const cur = new Date(start)
  while (cur < end) {
    total += overrideMap[cur.toISOString().slice(0, 10)] ?? baseRate
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return total
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const serverClient = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await serverClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const supabase = createServiceRoleClient()

    // Fetch existing booking
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', params.id)
      .single()

    if (fetchError || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    const b = booking as Booking

    if (b.status === 'cancelled' || b.status === 'completed') {
      return NextResponse.json(
        { error: `Cannot edit a ${b.status} booking` },
        { status: 400 },
      )
    }

    // Parse incoming fields with fallback to existing values
    const checkIn = (body.check_in as string | undefined) ?? b.check_in
    const checkOut = (body.check_out as string | undefined) ?? b.check_out
    const guestFirstName = (body.guest_first_name as string | undefined) ?? b.guest_first_name
    const guestLastName = (body.guest_last_name as string | undefined) ?? b.guest_last_name
    const guestEmail = (body.guest_email as string | undefined) ?? b.guest_email
    const guestPhone = (body.guest_phone as string | undefined) ?? b.guest_phone
    const guestCount = typeof body.guest_count === 'number' ? body.guest_count : b.guest_count
    const notes = Object.prototype.hasOwnProperty.call(body, 'notes')
      ? (body.notes as string | null)
      : b.notes ?? null

    // Validate dates
    if (checkOut !== OPEN_ENDED_DATE && checkIn >= checkOut) {
      return NextResponse.json({ error: 'check_in must be before check_out' }, { status: 400 })
    }

    // Availability check (excluding this booking's own dates)
    if (checkOut !== OPEN_ENDED_DATE) {
      const available = await isRoomAvailableExcluding(b.room_id, checkIn, checkOut, b.id)
      if (!available) {
        return NextResponse.json(
          { error: 'Room is not available for the new dates' },
          { status: 409 },
        )
      }
    }

    // Fetch authoritative current room rates
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('nightly_rate, monthly_rate, cleaning_fee, security_deposit, extra_guest_fee')
      .eq('id', b.room_id)
      .single()

    if (roomError || !room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    const extraGuests = Math.max(0, guestCount - 1)
    const extraGuestFee = room.extra_guest_fee ?? 0

    // Recalculate total
    let newTotal: number
    let newTotalNights: number

    if (b.booking_type === 'short_term' && checkOut !== OPEN_ENDED_DATE) {
      // Fetch price overrides for the new date range
      const { data: overrides } = await supabase
        .from('date_overrides')
        .select('date, price_override')
        .eq('room_id', b.room_id)
        .gte('date', checkIn)
        .lt('date', checkOut)
        .not('price_override', 'is', null)

      const overrideMap: Record<string, number> = {}
      for (const o of overrides ?? []) {
        if (o.price_override != null) overrideMap[o.date] = Number(o.price_override)
      }

      const nightlySubtotal = computeNightlySubtotal(checkIn, checkOut, room.nightly_rate, overrideMap)
      const [ciY, ciM, ciD] = checkIn.split('-').map(Number)
      const [coY, coM, coD] = checkOut.split('-').map(Number)
      newTotalNights = Math.round(
        (Date.UTC(coY, coM - 1, coD) - Date.UTC(ciY, ciM - 1, ciD)) / 86400000,
      )
      const cleaningFee = room.cleaning_fee ?? 0
      newTotal = nightlySubtotal + cleaningFee + extraGuestFee * extraGuests * newTotalNights
    } else {
      // long_term: only extra_guest_fee changes with guest count; base is monthly_rate + security_deposit
      const securityDeposit = room.security_deposit ?? 0
      newTotal = room.monthly_rate + securityDeposit + extraGuestFee * extraGuests
      newTotalNights = checkOut === OPEN_ENDED_DATE ? 0 : b.total_nights
    }

    const delta = newTotal - b.amount_paid
    const amountDueAtCheckin = Math.max(0, newTotal - b.amount_paid)

    // Update booking record
    const { data: updated, error: updateError } = await supabase
      .from('bookings')
      .update({
        check_in: checkIn,
        check_out: checkOut,
        guest_first_name: guestFirstName,
        guest_last_name: guestLastName,
        guest_email: guestEmail,
        guest_phone: guestPhone,
        guest_count: guestCount,
        total_nights: newTotalNights,
        total_amount: newTotal,
        amount_due_at_checkin: amountDueAtCheckin,
        notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', b.id)
      .select('*')
      .single()

    if (updateError || !updated) {
      console.error('Edit booking update error:', updateError)
      return NextResponse.json({ error: 'Failed to update booking' }, { status: 500 })
    }

    // Payment adjustments (non-blocking — don't fail the edit if Stripe errors)
    if (b.stripe_payment_intent_id && Math.abs(delta) >= 0.01) {
      if (delta < 0) {
        // Price decreased — issue partial refund
        try {
          await stripe.refunds.create({
            payment_intent: b.stripe_payment_intent_id,
            amount: Math.round(Math.abs(delta) * 100),
            reverse_transfer: true,
          })
          await supabase
            .from('bookings')
            .update({ amount_paid: b.amount_paid + delta, amount_due_at_checkin: 0 })
            .eq('id', b.id)
        } catch (stripeErr) {
          console.error('Stripe refund error on booking edit:', stripeErr)
        }
      } else {
        // Price increased — create new PaymentIntent for the delta and email guest
        try {
          const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            line_items: [{
              price_data: {
                currency: 'usd',
                product_data: { name: `Additional charge — booking ${b.id.slice(0, 8).toUpperCase()}` },
                unit_amount: Math.round(delta * 100),
              },
              quantity: 1,
            }],
            customer_email: guestEmail,
            metadata: { booking_id: b.id, type: 'booking_edit_additional_charge' },
            success_url: `${process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'}/booking-confirmed`,
            cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'}`,
          })
          const paymentLink = session.url!
          evaluateAndQueueEmails('booking_payment_request', {
            type: 'booking_payment_request',
            bookingId: b.id,
            paymentAmount: `$${delta.toFixed(2)}`,
            paymentLink,
          }).catch((err) => console.error('email queue error on payment_request:', err))
        } catch (stripeErr) {
          console.error('Stripe payment intent error on booking edit:', stripeErr)
        }
      }
    }

    return NextResponse.json({ booking: updated })
  } catch (err) {
    console.error(`PATCH /api/admin/bookings/${params.id}/edit error:`, err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "edit/route" | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "app/api/admin/bookings/[id]/edit/route.ts"
git commit -m "feat: add PATCH /api/admin/bookings/[id]/edit route with Stripe adjustment"
```

---

## Task 7: Tests for edit booking API

**Files:**
- Create: `__tests__/api/bookings-edit.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/api/bookings-edit.test.ts`:

```typescript
/** @jest-environment node */

jest.mock('@/lib/supabase', () => ({ createServiceRoleClient: jest.fn(), createServerSupabaseClient: jest.fn() }))
jest.mock('@/lib/stripe', () => ({
  stripe: {
    refunds: { create: jest.fn().mockResolvedValue({}) },
    checkout: { sessions: { create: jest.fn().mockResolvedValue({ url: 'https://checkout.stripe.com/test' }) } },
  },
}))
jest.mock('@/lib/availability', () => ({
  isRoomAvailableExcluding: jest.fn().mockResolvedValue(true),
}))
jest.mock('@/lib/email-queue', () => ({
  evaluateAndQueueEmails: jest.fn().mockResolvedValue(undefined),
}))

import { NextRequest } from 'next/server'
import { createServiceRoleClient, createServerSupabaseClient } from '@/lib/supabase'
import { stripe } from '@/lib/stripe'
import { isRoomAvailableExcluding } from '@/lib/availability'
import { evaluateAndQueueEmails } from '@/lib/email-queue'
import { PATCH } from '@/app/api/admin/bookings/[id]/edit/route'

const mockParams = { params: { id: 'booking-1' } }

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/admin/bookings/booking-1/edit', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const baseBooking = {
  id: 'booking-1',
  room_id: 'room-1',
  booking_type: 'short_term',
  status: 'confirmed',
  check_in: '2026-05-01',
  check_out: '2026-05-05',
  guest_first_name: 'Jane',
  guest_last_name: 'Doe',
  guest_email: 'jane@example.com',
  guest_phone: '555-0100',
  guest_count: 2,
  total_nights: 4,
  total_amount: 600,
  amount_paid: 600,
  amount_due_at_checkin: 0,
  stripe_payment_intent_id: 'pi_test',
  notes: null,
}

const baseRoom = {
  nightly_rate: 150,
  monthly_rate: 3000,
  cleaning_fee: 0,
  security_deposit: 0,
  extra_guest_fee: 0,
}

function setupMocks(booking = baseBooking, room = baseRoom) {
  const updatedBooking = { ...booking }
  const updateChain = {
    eq: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: updatedBooking, error: null }),
  }
  const update = jest.fn().mockReturnValue(updateChain)

  ;(createServerSupabaseClient as jest.Mock).mockResolvedValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null }),
    },
  })
  ;(createServiceRoleClient as jest.Mock).mockReturnValue({
    from: jest.fn((table: string) => {
      if (table === 'bookings') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: booking, error: null }),
          update,
        }
      }
      if (table === 'rooms') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: room, error: null }),
        }
      }
      if (table === 'date_overrides') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lt: jest.fn().mockReturnThis(),
          not: jest.fn().mockResolvedValue({ data: [] }),
        }
      }
      return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockResolvedValue({ data: [] }) }
    }),
  })
  return { update, updateChain }
}

describe('PATCH /api/admin/bookings/[id]/edit', () => {

  beforeEach(() => jest.clearAllMocks())

  it('returns 401 when not authenticated', async () => {
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }) },
    })
    ;(createServiceRoleClient as jest.Mock).mockReturnValue({ from: jest.fn() })
    const res = await PATCH(makeRequest({}), mockParams)
    expect(res.status).toBe(401)
  })

  it('returns 404 when booking does not exist', async () => {
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null }) },
    })
    ;(createServiceRoleClient as jest.Mock).mockReturnValue({
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
      })),
    })
    const res = await PATCH(makeRequest({ check_in: '2026-05-01', check_out: '2026-05-07' }), mockParams)
    expect(res.status).toBe(404)
  })

  it('returns 400 when trying to edit a cancelled booking', async () => {
    setupMocks({ ...baseBooking, status: 'cancelled' })
    const res = await PATCH(makeRequest({ check_in: '2026-05-01', check_out: '2026-05-07' }), mockParams)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/cancelled/)
  })

  it('returns 409 when new dates conflict with another booking', async () => {
    setupMocks()
    ;(isRoomAvailableExcluding as jest.Mock).mockResolvedValue(false)
    const res = await PATCH(makeRequest({ check_in: '2026-05-01', check_out: '2026-05-10' }), mockParams)
    expect(res.status).toBe(409)
  })

  it('updates booking record and returns it on success', async () => {
    const { update } = setupMocks()
    const res = await PATCH(
      makeRequest({ check_in: '2026-05-01', check_out: '2026-05-05', guest_count: 2 }),
      mockParams,
    )
    expect(res.status).toBe(200)
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ check_in: '2026-05-01', check_out: '2026-05-05' }),
    )
  })

  it('issues Stripe refund when new total is lower than amount paid', async () => {
    // 4 nights at $150 = $600 paid; new 2 nights = $300 → refund $300
    setupMocks({ ...baseBooking, amount_paid: 600 })
    await PATCH(
      makeRequest({ check_in: '2026-05-01', check_out: '2026-05-03' }),
      mockParams,
    )
    expect(stripe.refunds.create).toHaveBeenCalledWith(
      expect.objectContaining({ payment_intent: 'pi_test', amount: 30000 }),
    )
  })

  it('creates new PaymentIntent and queues email when new total is higher', async () => {
    // 4 nights at $150 = $600 paid; new 6 nights = $900 → additional $300
    setupMocks({ ...baseBooking, amount_paid: 600 })
    await PATCH(
      makeRequest({ check_in: '2026-05-01', check_out: '2026-05-07' }),
      mockParams,
    )
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'payment' }),
    )
    expect(evaluateAndQueueEmails).toHaveBeenCalledWith(
      'booking_payment_request',
      expect.objectContaining({ type: 'booking_payment_request', bookingId: 'booking-1' }),
    )
  })

  it('skips Stripe entirely for manual bookings (no stripe_payment_intent_id)', async () => {
    setupMocks({ ...baseBooking, stripe_payment_intent_id: null, amount_paid: 600 })
    await PATCH(
      makeRequest({ check_in: '2026-05-01', check_out: '2026-05-07' }),
      mockParams,
    )
    expect(stripe.refunds.create).not.toHaveBeenCalled()
    expect(stripe.paymentIntents.create).not.toHaveBeenCalled()
  })

  it('recalculates long_term total based only on guest_count change', async () => {
    const ltBooking = {
      ...baseBooking,
      booking_type: 'long_term',
      check_out: '9999-12-31',
      total_nights: 0,
      total_amount: 3000,
      amount_paid: 3000,
    }
    const ltRoom = { ...baseRoom, monthly_rate: 3000, security_deposit: 500, extra_guest_fee: 100 }
    const { update } = setupMocks(ltBooking, ltRoom)
    // Changing from 2 guests to 3 guests: 1 extra guest → +$100
    await PATCH(makeRequest({ guest_count: 3 }), mockParams)
    // new total = 3000 + 500 + 100 = 3600 → delta = 3600 - 3000 = +600... wait
    // Actually: extraGuests = max(0, 3-1) = 2 → 3000 + 500 + 100*2 = 3700
    // But amount_paid = 3000 → delta = +700
    // We check that update was called with the recalculated total
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ total_amount: 3700 }),
    )
  })
})
```

- [ ] **Step 2: Run the tests — expect failures**

```bash
npx jest __tests__/api/bookings-edit.test.ts --no-coverage 2>&1 | tail -30
```

Expected: Some tests fail because the route file was just created and may have TypeScript issues in the test file (import order matters — fix as needed).

- [ ] **Step 3: Fix any TypeScript/import issues in the test file**

If the `NextRequest` import order causes an issue (it's used before import), move the import to the top:

```typescript
/** @jest-environment node */
import { NextRequest } from 'next/server'
// ... then jest.mock calls ...
```

- [ ] **Step 4: Run tests — all should pass**

```bash
npx jest __tests__/api/bookings-edit.test.ts --no-coverage 2>&1 | tail -20
```

Expected output:
```
PASS __tests__/api/bookings-edit.test.ts
  PATCH /api/admin/bookings/[id]/edit
    ✓ returns 401 when not authenticated
    ✓ returns 404 when booking does not exist
    ✓ returns 400 when trying to edit a cancelled booking
    ✓ returns 409 when new dates conflict with another booking
    ✓ updates booking record and returns it on success
    ✓ issues Stripe refund when new total is lower than amount paid
    ✓ creates new PaymentIntent and queues email when new total is higher
    ✓ skips Stripe entirely for manual bookings (no stripe_payment_intent_id)
    ✓ recalculates long_term total based only on guest_count change
```

- [ ] **Step 5: Commit**

```bash
git add "__tests__/api/bookings-edit.test.ts"
git commit -m "test: add tests for PATCH /api/admin/bookings/[id]/edit"
```

---

## Task 8: Wire Edit button in BookingDetailPanel

**Files:**
- Modify: `components/admin/BookingDetailPanel.tsx`

- [ ] **Step 1: Add `showEditForm` state and import `EditBookingForm`**

At the top of `BookingDetailPanel.tsx`, add the import:

```typescript
import EditBookingForm from './EditBookingForm'
```

Inside the `BookingDetailPanel` function, after the existing `const [showCancelModal, setShowCancelModal] = useState(false)` line, add:

```typescript
const [showEditForm, setShowEditForm] = useState(false)
const [editedBooking, setEditedBooking] = useState(booking)
```

- [ ] **Step 2: Use `editedBooking` instead of `booking` for display**

At the top of `BookingDetailPanel`, the component renders `booking`. Change the destructure reference: everywhere the component uses `booking` for display, it should use `editedBooking`. The simplest way is to add after the state declarations:

```typescript
const b = editedBooking
```

Then replace all render-time uses of `booking.` with `b.` (but keep `booking` for the initial state values). This is a search-and-replace in the JSX only — the prop name stays `booking`.

Specifically, update these JSX references:
- All `booking.guest_first_name`, `booking.guest_last_name`, etc. → `b.guest_first_name`, etc.
- All `booking.status`, `booking.check_in`, `booking.check_out`, `booking.total_amount`, etc. → `b.*`
- Keep `booking` (the prop) only in `useState(booking)` and the `EditBookingForm` prop

- [ ] **Step 3: Enable the Edit button and wire it**

Replace the disabled Edit button (around line 391):

```tsx
<button
  disabled
  style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#94A3B8', borderRadius: 9, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'not-allowed' }}
>
  ✏ Edit
</button>
```

With:

```tsx
{b.status !== 'cancelled' && b.status !== 'completed' && (
  <button
    onClick={() => setShowEditForm(true)}
    style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', color: '#475569', borderRadius: 9, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
  >
    ✏ Edit
  </button>
)}
```

- [ ] **Step 4: Render `EditBookingForm` conditionally**

After the existing `{showCancelModal && <CancelBookingModal ... />}` block, add:

```tsx
{showEditForm && (
  <EditBookingForm
    booking={b as Booking & { room: Room & { property: Property } }}
    onClose={() => setShowEditForm(false)}
    onSaved={(updated) => {
      // API response doesn't include the room join — preserve it from the original prop
      setEditedBooking({ ...updated, room: b.room } as typeof b)
      setShowEditForm(false)
    }}
  />
)}
```

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "BookingDetailPanel\|EditBookingForm" | head -10
```

Expected: no errors.

- [ ] **Step 6: Run all tests**

```bash
npx jest --no-coverage 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 7: Verify in browser**

1. Open http://localhost:3000/admin/calendar
2. Click a booking cell to open the detail panel
3. Click ✏ Edit — the edit modal should open pre-populated
4. Change a date and save — the panel should reflect the updated dates
5. Verify the Edit button is hidden for cancelled/completed bookings

- [ ] **Step 8: Commit**

```bash
git add components/admin/BookingDetailPanel.tsx
git commit -m "feat: wire Edit button in BookingDetailPanel to EditBookingForm"
```
