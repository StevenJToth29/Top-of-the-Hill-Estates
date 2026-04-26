# Airbnb Comparison Button — Design Spec

**Date:** 2026-04-26  
**Status:** Approved

---

## Overview

Allow admins to link a room to its Airbnb listing. When configured, a comparison button appears on the public booking widget so guests can verify they're getting a competitive deal. The button pre-fills check-in, check-out, and guest count in the Airbnb URL when dates are selected.

---

## Data Layer

### Migration
Add a single nullable column to the `rooms` table:

```sql
ALTER TABLE rooms ADD COLUMN airbnb_listing_id TEXT DEFAULT NULL;
```

No other schema changes. The listing ID is all that's stored; the full Airbnb URL is always constructed at runtime.

### URL construction pattern
```
https://www.airbnb.com/rooms/{airbnb_listing_id}?check_in={checkIn}&check_out={checkOut}&guests={guests}&adults={guests}
```

When no dates are selected, date/guest params are omitted and the link opens the bare listing page.

### TypeScript types (`types/index.ts`)
Add to the `Room` interface:
```ts
airbnb_listing_id?: string | null
```

---

## Admin UI (`components/admin/RoomForm.tsx`)

A new optional "Airbnb Listing" text input added in the pricing/external links section of the room form.

**Input behaviour:**
- Accepts a full Airbnb URL (e.g. `https://www.airbnb.com/rooms/1234804626518653126?...`) or a bare numeric listing ID
- On blur and on save: extract the numeric ID using `/\/rooms\/(\d+)/` for URLs, or validate all-digits for a bare ID
- If the value doesn't match either pattern, clear the field and show a validation message
- Only the extracted numeric ID is persisted to the DB

**Helper text:**
- Below the input, show a preview: `Preview: https://www.airbnb.com/rooms/{id}` (only when a valid ID is present)
- This lets the admin verify the correct listing before saving

**Field is fully optional** — leaving it blank means no Airbnb button appears on the public side.

**Save payload:** `airbnb_listing_id` included in the existing room upsert alongside all other room fields.

---

## Public UI (`components/public/BookingWidget.tsx`)

Both elements only render when `room.airbnb_listing_id` is non-null and non-empty.

### Always-visible subtle link
Rendered at the bottom of the widget, below the "Book Now" / "Request to Book" button, regardless of whether dates have been selected:

```
[Airbnb logo SVG]  Compare on Airbnb  ↗
```

Styling: `text-xs text-on-surface-variant`, centered, no border — subtle enough not to compete with the primary CTA.

When no dates are selected: link opens `https://www.airbnb.com/rooms/{id}` (no params).  
When dates are selected: link opens the full pre-filled URL.

### Date-selected prominent button
Appears inside the price breakdown card, just above the grand total divider, only when `nights > 0` (short-term) or a move-in date is selected (long-term):

```
┌────────────────────────────────────────┐
│ 3 nights × $120             $360       │
│ Cleaning fee                 $50       │
│ ──────────────────────────────────── │
│  [ 🏠  See these dates on Airbnb ↗ ]  │  ← outlined teal button
│ ──────────────────────────────────── │
│ Total                       $410       │
└────────────────────────────────────────┘
```

Styling: `border border-secondary/50 text-secondary rounded-xl py-2 text-sm` — outlined teal, matching the site's secondary color palette.

**URL params included:**
- Short-term: `check_in`, `check_out`, `guests`, `adults`
- Long-term: `check_in={moveIn}`, `guests`, `adults` (no `check_out` — Airbnb will prompt the user to pick an end date)

Both links use `target="_blank" rel="noopener noreferrer"`.

---

## Airbnb Logo

Use a small inline SVG of the Airbnb "bélo" logo (the rautenförmig icon) or a simple text "airbnb" wordmark rendered in the Airbnb brand red (`#FF5A5F`) for instant recognisability. No external image dependencies.

---

## Out of Scope

- Live Airbnb price fetching (no public API; risks ToS violations)
- Displaying a manually-entered comparison price (explicitly opted out of)
- Long-term / monthly listing comparison (Airbnb is primarily short-term but the link still works)
- Any Airbnb affiliate tracking parameters

---

## Files Changed

| File | Change |
|------|--------|
| `supabase/migrations/031_add_airbnb_listing_id.sql` | Add `airbnb_listing_id` column to `rooms` |
| `types/index.ts` | Add `airbnb_listing_id?: string \| null` to `Room` |
| `components/admin/RoomForm.tsx` | Add Airbnb Listing input field with ID extraction and preview |
| `components/public/BookingWidget.tsx` | Add always-visible subtle link + date-selected prominent button |
