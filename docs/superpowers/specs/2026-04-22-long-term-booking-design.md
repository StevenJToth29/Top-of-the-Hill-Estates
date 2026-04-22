# Long Term Booking — Calendar Visual & Full Edit Feature

**Date:** 2026-04-22
**Status:** Approved

---

## Overview

Two related features shipped together:

1. **Long Term calendar visual** — `booking_type === 'long_term'` bookings render with a diagonal stripe pattern on the admin calendar, distinct from regular teal bookings and iCal blocks. Open-ended bookings (check_out = `9999-12-31`) show a `→` arrow on the last visible cell of the month.

2. **Full edit form for all bookings** — The currently disabled Edit button in `BookingDetailPanel` is wired up to a new `EditBookingForm` modal. Editing recalculates the total and automatically processes payment adjustments via Stripe.

No database schema changes are required. Both features build on existing data model (`booking_type: 'long_term'`, `check_out: OPEN_ENDED_DATE`).

---

## Section 1 — Calendar Visual

### Rule
Any booking where `booking_type === 'long_term'` receives the Long Term visual treatment, regardless of whether it has an end date or is open-ended. The visual is tied to booking type, not to `check_out === OPEN_ENDED_DATE`.

### Cell styling
- **All Long Term cells:** diagonal stripe background via `repeating-linear-gradient(45deg, rgba(100,116,139,0.18) 2px, transparent 2px, transparent 7px)`
- **Guest initial:** shown in slate (`#475569`), same position as regular bookings
- **Open-ended tail cell** (last visible day of the month when `check_out === OPEN_ENDED_DATE`): lighter stripe + dashed right border + `→` arrow character

### Status priority
`getDayInfo` checks for `long_term` booking type before the generic `booking` check, so Long Term always takes precedence in the status determination.

### Components updated
- `components/admin/RoomsCalendar.tsx` — `DayStatus` type gains `'long_term'`; `getDayInfo` updated; cell rendering updated; legend gains Long Term entry
- `components/admin/RoomCalendarModal.tsx` — same visual treatment applied to the per-room weekly detail view

### Legend
A new "Long Term" pill is added to the calendar legend showing a stripe swatch sample.

### Tooltip
Open-ended: `"Rivera, Maria (2026-03-15 – open-ended) [confirmed]"`
With end date: `"Henderson, Paul (2026-04-01 – 2026-04-30) [confirmed]"`

---

## Section 2 — Edit Booking Form

### Entry point
The Edit button in `BookingDetailPanel` (currently disabled at line ~391) is enabled. Clicking it opens `EditBookingForm` as a modal overlay.

### New component: `components/admin/EditBookingForm.tsx`
A focused modal pre-populated from the existing booking. Fields:

**Stay Dates**
- Check-in (date picker)
- Check-out (date picker, disabled when open-ended toggle is active)
- "No end date (open-ended tenancy)" toggle — visible only when `booking_type === 'long_term'`

**Guest**
- First name, Last name
- Email, Phone
- Guest count
- Notes (admin notes field)

**Payment Adjustment panel** (shown whenever the recalculated total differs from the original total)
- Original total, New total, Already paid
- Delta line: `+$X.XX` (amber, price increase) or `−$X.XX` (green, refund)
- Explanatory note: either "payment link will be emailed" or "Stripe refund will be issued automatically"
- For manual bookings with no Stripe intent: note states balance is updated on record only

### Recalculation
Total is recalculated client-side on each field change using the same formula as booking creation:
- Short term: `nightly_rate × nights + cleaning_fee + extra_guest_fee × extra_guests × nights`
- Long term: `monthly_rate + security_deposit + extra_guest_fee × extra_guests`
Rates are fetched fresh from the DB when the form opens (not from the booking snapshot) to reflect current pricing.

---

## Section 3 — Edit API

### New route: `PATCH /api/admin/bookings/[id]/edit`

**Sequence:**
1. Authenticate admin session
2. Fetch existing booking from DB
3. Fetch current room rates from DB (authoritative — never trust client)
4. Validate new dates (check_in < check_out unless open-ended; no date in the past)
5. Recalculate new total using authoritative rates
6. Compute `delta = new_total − amount_paid`
7. Update booking record: dates, guest fields, notes, total_amount, updated_at
8. **If `delta < 0` AND `stripe_payment_intent_id` exists:** issue Stripe partial refund via `stripe.refunds.create({ payment_intent, amount: abs(delta_cents) })` with `reverse_transfer: true`
9. **If `delta > 0` AND `stripe_payment_intent_id` exists:** create new Stripe PaymentIntent for `delta_cents`, then call `evaluateAndQueueEmails('booking_payment_request', context)` with `payment_link` and `payment_amount` in context
10. **If no `stripe_payment_intent_id`:** update DB only; adjust `amount_due_at_checkin` to reflect new balance
11. Return updated booking

**Edge cases:**
- `amount_paid === 0` and `delta < 0`: update record only, no refund
- Long term bookings: base total (monthly_rate + security_deposit) is **not recalculated** when dates change — the initial charge is fixed. A delta is only triggered if `guest_count` changes (extra_guest_fee × extra_guests). Adding an end date to an open-ended long term booking records the end date but does not produce a payment adjustment.
- Short term bookings: total is always recalculated from current authoritative nightly rates × new night count.
- Availability conflict: if new dates conflict with another booking (excluding the current one), return 409

---

## Section 4 — Email Integration

### New trigger event: `booking_payment_request`

**Added via DB migration:**
- Seeds one default automation for `booking_payment_request` trigger
- Active by default, fires immediately (delay: 0), recipient: guest email

**Default template:**
- Subject: `"Payment Request — Additional Amount Due for Your Booking"`
- Body includes: guest name, unit, property, amount owed, payment link button

**Template variables available:**
| Variable | Resolves to |
|---|---|
| `{{guest_first_name}}` | Guest first name |
| `{{booking_id}}` | Booking reference ID |
| `{{unit_name}}` | Room/unit name |
| `{{property_name}}` | Property name |
| `{{payment_amount}}` | Formatted delta (e.g. "$500.00") |
| `{{payment_link}}` | Stripe-hosted payment URL for the new PaymentIntent |

**Admin control:** Template is editable in the existing Email Templates UI at `/admin/email/templates`. No special handling required — it behaves identically to all other automations.

**What does not change:** email queue processor, template editor, automation rules engine, existing trigger events.

---

## Files Affected

| File | Change |
|---|---|
| `components/admin/RoomsCalendar.tsx` | Add `long_term` DayStatus, cell styling, legend entry |
| `components/admin/RoomCalendarModal.tsx` | Same visual treatment as RoomsCalendar |
| `components/admin/BookingDetailPanel.tsx` | Enable Edit button, open EditBookingForm |
| `components/admin/EditBookingForm.tsx` | **New** — edit modal component |
| `app/api/admin/bookings/[id]/edit/route.ts` | **New** — PATCH edit route with payment adjustment |
| `lib/email-queue.ts` | Add `booking_payment_request` to trigger type union and context resolver |
| `supabase/migrations/017_booking_payment_request_email.sql` | **New** — seeds default automation |

---

## Out of Scope

- Changing the room/unit on an existing booking
- Editing the booking type (short_term ↔ long_term conversion)
- Public-facing edit request flow (guest-initiated changes remain a separate feature)
- Editing bookings in `cancelled` or `completed` status
