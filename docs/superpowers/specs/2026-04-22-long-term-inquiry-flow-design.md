# Long-Term Booking Inquiry Flow

**Date:** 2026-04-22
**Status:** Approved

## Overview

When a guest selects the long-term tab in the BookingWidget (or the room is long-term only), clicking the booking button routes them to a dedicated `/apply` page with a simple lead-capture form instead of the Stripe checkout flow. Submission syncs the lead to GoHighLevel via the existing contact webhook with a `long-term-inquiry` tag. No payment is collected.

---

## Trigger Condition

- Room has `show_monthly_rate: true` AND guest has selected the long-term booking tab, OR
- Room has `show_monthly_rate: true` AND `show_nightly_rate: false` (long-term only)

In both cases the trigger point is clicking the Book/Apply button — not tab selection alone.

---

## Components & Changes

### 1. BookingWidget (`components/public/BookingWidget.tsx`)

- When `bookingType === 'long_term'`, the button label changes from "Book Now" to **"Apply Now"**
- Clicking navigates to `/apply?room=<slug>&move_in=<date>&occupants=<count>` instead of `/checkout`
- Short-term path is completely unchanged
- No pricing params are passed (no Stripe involvement)

### 2. `/apply` Page (`app/(public)/apply/page.tsx`)

- Server component
- Reads `room`, `move_in`, `occupants` from URL search params
- Fetches room from Supabase by slug
- Redirects to `/` if slug is missing or room not found
- Renders a summary header (room name, property name, move-in date) above `LongTermInquiryForm`
- Uses existing public layout

### 3. `LongTermInquiryForm` (`components/public/LongTermInquiryForm.tsx`)

- Client component
- Fields (all required):
  - First name
  - Last name
  - Email
  - Phone
  - Desired move-in date (pre-filled from URL param, editable)
  - Number of occupants (pre-filled from URL param, editable)
- SMS consent checkbox (required), marketing consent (optional) — matches CheckoutForm pattern
- On submit: `POST /api/inquiries`
- Loading state on submit button (disabled during request)
- Inline field-level validation errors
- On success: navigate to `/apply/confirmation`
- Styling matches `CheckoutForm` (same input classes, color tokens)

### 4. `POST /api/inquiries` (`app/api/inquiries/route.ts`)

- Accepts: `first_name`, `last_name`, `email`, `phone`, `move_in`, `occupants`, `room_slug`, `room_name`, `property_name`, `sms_consent`, `marketing_consent`
- Validates all required fields server-side; returns 400 on failure
- Calls existing `syncContactInquiryToGHL()` from `lib/ghl.ts` with:
  - Tags: `['long-term-inquiry', 'sms-opted-in']` + `'marketing-opted-in'` if opted in
  - Room/property context in webhook payload
- No Stripe call
- No database booking record created
- Returns `{ success: true }` on success, 500 on GHL failure

### 5. `/apply/confirmation` Page (`app/(public)/apply/confirmation/page.tsx`)

- Server component (static)
- Checkmark icon, heading: "We've received your inquiry"
- Short message: someone will be in touch shortly
- "Back to Home" link
- Matches public site visual style (font, color tokens)

---

## Data Flow

```
Guest selects long-term tab
        ↓
Clicks "Apply Now" in BookingWidget
        ↓
Navigate to /apply?room=<slug>&move_in=<date>&occupants=<count>
        ↓
/apply page fetches room, renders LongTermInquiryForm (pre-filled)
        ↓
Guest completes form, clicks Submit
        ↓
POST /api/inquiries
        ↓
syncContactInquiryToGHL() — tag: long-term-inquiry
        ↓
Navigate to /apply/confirmation
```

---

## Out of Scope

- Formal rental application (background check, income verification, references) — future feature
- Creating a booking DB record for inquiries
- A new GHL webhook URL (reuses `GHL_CONTACT_WEBHOOK_URL`)
- Any changes to the short-term booking flow
