# Room Duplicate Feature — Design Spec

**Date:** 2026-04-22

## Overview

Allow admins to duplicate an existing room from the room list page. All settings are copied to the new room; only identity fields are reset. A small modal collects the new room name before anything is created.

---

## Fields Copied vs. Reset

**Copied (all settings):**
- `property_id`, `description`, `short_description`
- `guest_capacity`, `bedrooms`, `bathrooms`
- `nightly_rate`, `monthly_rate`, `show_nightly_rate`, `show_monthly_rate`
- `minimum_nights_short_term`, `minimum_nights_long_term`
- `cleaning_fee`, `security_deposit`, `extra_guest_fee`
- `amenities`, `images`
- `cancellation_window_hours`, `cancellation_policy`, `use_property_cancellation_policy`
- `price_min`, `price_max`
- `is_active`
- All `room_fees` rows (re-inserted with new IDs)

**Reset (unique per room):**
- `id` — new UUID
- `name` — supplied by the user in the modal
- `slug` — derived from the new name
- `ical_export_token` — new UUID
- `created_at`, `updated_at` — set to now

---

## API Endpoint

**Route:** `POST /api/admin/rooms/[id]/duplicate`

**File:** `app/api/admin/rooms/[id]/duplicate/route.ts`

**Auth:** Authenticated user required (same pattern as all other admin room routes).

**Request body:**
```json
{ "name": "string" }
```

**Behavior:**
1. Read source room from `rooms` table by `[id]`.
2. Read all `room_fees` rows where `room_id = [id]`.
3. Derive `slug` from `name` (slugify: lowercase, spaces → hyphens, strip non-alphanumeric).
4. Generate a new `ical_export_token` (UUID).
5. Insert new room row with fresh `id`, supplied `name`, derived `slug`, new `ical_export_token`, and all copied fields.
6. Insert all `room_fees` rows with new UUIDs and `room_id` pointing to the new room.
7. Return `{ id: string }` on success.
8. Return `{ error: string }` with appropriate HTTP status on failure (404 if source not found, 409 if slug conflicts, 500 for unexpected errors).

---

## Modal

**Trigger:** "Duplicate" button on a room card in the admin room list.

**Contents:**
- Heading: "Duplicate Room"
- Subtext: "Duplicating: [source room name]"
- Text input: **New Room Name**, pre-filled with `"[Original Name] (Copy)"`
- Read-only slug preview derived live from the name input
- **Duplicate** button: disabled + spinner while request is in flight
- Inline error message on failure (modal stays open)

**On success:** Redirect to `/admin/rooms/[newId]/edit`.

**Implementation:** A new client component `DuplicateRoomModal.tsx` in `components/admin/`. State (open/closed, source room id/name) is managed in `RoomCardWithIcal.tsx` or lifted to the rooms list page if needed.

---

## Room List UI Change

**File:** `app/admin/(protected)/rooms/RoomCardWithIcal.tsx`

Add a "Duplicate" action link/button alongside the existing Edit and Delete actions on each room card. Clicking it opens `DuplicateRoomModal` with the room's `id` and `name` pre-loaded. No layout changes beyond adding this action.

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Source room not found | 404 returned; modal shows "Room not found." |
| Slug already taken | 409 returned; modal shows "A room with that name already exists." |
| Network/server error | 500 returned; modal shows "Something went wrong. Please try again." |
| Empty name submitted | Client-side validation; Duplicate button stays disabled |

---

## Out of Scope

- Duplicating iCal import sources (these are live integrations, not settings)
- Duplicating bookings or date overrides
- Bulk duplicate
- Duplicate button on the edit page
