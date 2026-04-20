# Enhanced Admin Calendar — Design Spec

_Date: 2026-04-20_

---

## Overview

Replace the existing read-only admin calendar with a fully interactive timeline grid. The new calendar lets the admin view all rooms and dates at a glance, drag to select date ranges, block dates, set per-night prices, create bookings directly, and manage operational tasks — all without leaving the calendar page.

The design is based on the HTML/JSX prototype in `toth-rooms-calendar/project/Enhanced Calendar.html` and has been adapted to fit this codebase's patterns, the simplified smart pricing requirement (min/max only), and the addition of a task management layer.

---

## Goals

1. Replace the static month grid with an interactive timeline grid (rooms × days).
2. Allow drag-to-select date ranges with bulk actions: Book, Block, Set Price.
3. Show per-night pricing on each available cell.
4. Allow manual per-night price overrides within a room's min/max price range.
5. Allow manually blocking date ranges with a reason.
6. Add a task system (property-wide and room-specific, one-time and recurring) that has zero impact on room availability or bookings.
7. Retain the existing `RoomCalendarModal` week view, accessible by clicking a room name.
8. Continue displaying iCal blocks from external platforms (Airbnb, VRBO, etc.) unchanged.

---

## Database Changes

### New columns on `rooms`

```sql
ALTER TABLE rooms ADD COLUMN price_min numeric;
ALTER TABLE rooms ADD COLUMN price_max numeric;
```

These define the allowed price floor and ceiling for smart pricing. The future self-learning system will adjust nightly rates within this range automatically. For now they are informational constraints shown in the price-override UI.

### New table: `date_overrides`

```sql
CREATE TABLE date_overrides (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  date        date NOT NULL,
  price_override numeric,          -- null = use base rate
  is_blocked  boolean NOT NULL DEFAULT false,
  block_reason text,
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, date)
);
```

One row per night that has any manual change. Nights with no row use the room's base rate and are available. iCal blocks remain in `ical_blocks` — this table is for admin-created overrides only.

### New table: `calendar_tasks`

```sql
CREATE TABLE calendar_tasks (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id             uuid REFERENCES rooms(id) ON DELETE CASCADE, -- null = property-wide
  title               text NOT NULL,
  description         text,
  due_date            date NOT NULL,
  recurrence_rule     text,        -- iCal RRULE string e.g. "FREQ=WEEKLY;BYDAY=MO"
  recurrence_end_date date,
  status              text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','complete')),
  color               text,        -- hex color, optional
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
```

`room_id = null` means the task applies to the whole property. Recurrence uses iCal RRULE format — a widely supported standard that handles daily, weekly, monthly, and custom patterns without a custom schema.

---

## Architecture

### Page

**`/app/admin/(protected)/calendar/page.tsx`** — full rebuild.

Fetches for the visible month range (current month ± 1 for smooth navigation):
- All active rooms with `price_min`, `price_max`
- Bookings (`confirmed` and `pending`) overlapping the range
- `ical_blocks` overlapping the range
- `date_overrides` for the range
- `calendar_tasks` for the range (expanded from recurrence rules server-side)

Owns state:
- `currentMonth` — drives date range
- `selStart` / `selEnd` / `selRoomId` — drag selection
- `modal` + `modalData` — which modal is open and its context
- `showPrices` / `cellDensity` — display preferences (persisted in localStorage)

### New components

| Component | File | Purpose |
|-----------|------|---------|
| `CalendarGrid` | `components/admin/CalendarGrid.tsx` | The timeline table — rooms × days. Renders all cell states, handles mousedown/mousemove drag selection, cell click, room name click. |
| `OccupancyBar` | `components/admin/OccupancyBar.tsx` | Thin teal→amber→red strip above the grid showing % of rooms occupied per day. |
| `SelectionBar` | `components/admin/SelectionBar.tsx` | Dark action bar that appears after a drag selection: "N days selected on Room Name" + Book / Block / Set Price / Clear. |
| `CalendarLegend` | `components/admin/CalendarLegend.tsx` | Legend row below the grid. |
| `CalendarTaskRow` | `components/admin/CalendarTaskRow.tsx` | A single task sub-row. Used for the pinned Property Tasks row and for each room's task sub-row. Renders task bars spanning their date range. |
| `NightDetailModal` | `components/admin/NightDetailModal.tsx` | Opens on single-cell click. Context-aware — four states: available, booked, blocked, iCal. |
| `TaskModal` | `components/admin/TaskModal.tsx` | Create/edit a task: title, description, date, room or property scope, recurrence, status, color. |

### Reused unchanged

- `RoomCalendarModal` — opens when room name is clicked. No changes needed.

### Note on AddBookingModal vs ManualBookingForm

The existing `ManualBookingForm` component is used in the admin bookings page. `AddBookingModal` is a new component built from the design prototype. It calls the same `POST /api/admin/bookings/manual` endpoint as `ManualBookingForm`. The implementation may choose to extract shared logic into a shared hook, but the modal itself is a new component — it has a different layout, a price summary card, and source/consent fields that may differ from the existing form.

### New API routes

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/admin/calendar` | Fetch bookings, iCal blocks, date overrides, and tasks for a date range across all rooms. Single endpoint to power the calendar page. |
| `PUT` | `/api/admin/date-overrides` | Upsert one or more `date_overrides` rows (price override, block, note, or unblock). |
| `POST` | `/api/admin/calendar-tasks` | Create a task. |
| `PATCH` | `/api/admin/calendar-tasks/[id]` | Update a task (edit, mark complete). |
| `DELETE` | `/api/admin/calendar-tasks/[id]` | Delete a task. |

---

## Calendar Grid

### Layout

```
[Room label col — sticky left] [Day col × N days]
```

- Room label col: 180px, sticky left. Shows room name (teal, clickable → `RoomCalendarModal`), property name, base price.
- Day columns: 34px min-width each. Full month shown. Weekend columns (Fri/Sat) visually distinguished.
- Today's date: teal circle around the day number in the header.
- Week separator: subtle left border on Sunday columns.

### Row structure per room

```
[Booking/availability row]   ← always shown
[Task sub-row]               ← collapsible, shown by default
```

The grid also has a **Property Tasks row** pinned at the very top (above room rows).

### Cell states

| State | Background | Top border | Content |
|-------|-----------|------------|---------|
| Available | white / #FAFBFD (alternating) | none | Price in teal (or amber on weekends) |
| Booked — first night | `rgba(45,212,191,0.14)` | 2px `#2DD4BF` | Guest initials (bold, dark teal) |
| Booked — continuation | `rgba(45,212,191,0.14)` | 2px `rgba(45,212,191,0.4)` | empty |
| Blocked | `rgba(100,116,139,0.1)` | 2px `#CBD5E1` | `–` in light gray |
| iCal block | `rgba(45,212,191,0.07)` | none | small teal dot |
| Selected (drag) | `rgba(45,212,191,0.28)` | 2px outline | price or initials |

### Drag selection

- `mousedown` on an available or blocked cell starts drag. `mousemove` extends selection within the same room row. `mouseup` ends drag.
- Selecting a booked or iCal cell does nothing (those cannot be bulk-actioned).
- After mouseup: `SelectionBar` appears if ≥1 cell is selected.
- Single click (no drag, same start/end cell): opens `NightDetailModal`.

### Occupancy heatbar

A 5px strip above the grid headers. Each day column gets a segment colored by occupancy:
- < 50% occupied → teal at low opacity
- 50–79% → amber
- ≥ 80% → red

Tooltip on hover: "X% occupied".

---

## Night Detail Modal

Single modal, four states based on the cell's status.

### State 1: Available night

- Status pill: green "● Available"
- **Nightly Rate**: number input pre-filled with current price (base rate or existing override). Below the input: a visual range bar showing `price_min` ↔ `price_max` with the current value marked. Label: "Smart pricing range: $X – $Y. Future auto-pricing will stay within this range."
- **Internal Note**: text input (saved to `date_overrides.note`)
- Actions: **＋ Book** (opens Add Booking modal pre-filled for this room/date) | **✕ Block** (opens Block Dates modal) | **💲 Save Rate** (upserts `date_overrides` with new price)

### State 2: Booked night

- Status pill: teal "● Booked · [status]"
- **Guest card**: initials avatar, full name, dates, rate, email, phone
- **Booking Total**: amount + payment status
- **Night indicator**: "Night X of Y"
- Actions: **📋 View Full Booking** (navigates to `/admin/bookings` with booking pre-selected) | **✕ Cancel Booking** (opens cancellation flow)

### State 3: Manually blocked night

- Status pill: red "✕ Blocked"
- **Block Reason**: editable text input (updates `date_overrides.block_reason`)
- **Blocked info**: date range, created by, created at
- Actions: **✓ Unblock Night** (deletes or clears `is_blocked` on `date_overrides`) | **💾 Save Note**

### State 4: iCal block

- Status pill: purple "◆ iCal Block"
- **Platform info**: platform name, date range, last sync time
- **Informational note**: "This block is managed by [Platform]. Cancel on [Platform] to remove it — it clears on the next iCal sync."
- Actions: **⚙️ Manage iCal Sources** (navigates to `/admin/ical`)
- Read-only — no edit actions.

---

## Selection Action Bar

Appears below the grid after a drag selection is completed (≥1 cell, mouseup).

Dark (`#0F172A`) pill bar:
```
[N days selected on Room Name]  [+ Book]  [🚫 Block]  [$ Set Price]  [×]
```

- **+ Book** → opens `AddBookingModal` pre-filled with room and date range
- **🚫 Block** → opens `BlockDatesModal` pre-filled with room and date range
- **$ Set Price** → opens `SetPriceModal` pre-filled with room and selected dates
- **×** → clears selection

---

## Modals (from design, adapted)

### Add Booking Modal

Fields: Room (dropdown), Booking Type (short-term / long-term toggle), Check-in, Check-out, Guests, First Name, Last Name, Email, Phone, Total (pre-filled suggestion based on nights × base rate), Source (direct / Airbnb / VRBO / Booking.com / other), Notes, SMS consent, Marketing consent.

Price summary card shows nights × rate and total.

On submit: calls `POST /api/admin/bookings/manual`. No Stripe payment processing — admin-entered booking.

### Block Dates Modal

Fields: Room (dropdown), From date, To date, Reason (toggle: Maintenance / Personal / Renovation / Other), Note.

Summary: "Blocking N days on Room Name".

On submit: upserts `date_overrides` rows with `is_blocked = true` for each date in range.

### Set Price Modal

Fields: Room (dropdown), Price per night (large number input), Apply to (radio: All selected days / Fri–Sat only / Weekdays only).

Shows % above/below base rate in red/green.

On submit: upserts `date_overrides` rows with `price_override` for each targeted date.

### Booking Detail Modal

Guest header with initials avatar, full name, email, phone, source badge (color-coded: Airbnb red, VRBO blue, Direct teal, etc.).

Detail rows: Check-in, Check-out, Duration, Guests, Type, Total, Status.

Notes block if present.

Actions: Cancel Booking (opens cancellation flow) | Close.

### Smart Pricing Modal (simplified)

Two fields per room:
- **Price Floor** (`price_min`): the lowest the system should ever price this room
- **Price Ceiling** (`price_max`): the highest the system should ever price this room

Current base rate shown as reference. Saving updates `rooms.price_min` and `rooms.price_max`.

Explanatory note: "These bounds will guide the future auto-pricing engine. Manual overrides always take priority."

---

## Task System

### Property Tasks row

Pinned as the first row in the grid (above all room rows). Label: "📋 Property Tasks" with a small "+ Add" button.

Task bars rendered as colored horizontal bars spanning their date range (or a single-day dot if one day). Clicking a task bar opens `TaskModal` in edit mode. Clicking the "+ Add" button opens `TaskModal` in create mode with `room_id = null`.

### Room task sub-rows

Each room has a collapsible task sub-row rendered directly beneath its booking row. Label: "↳ [Room Name] Tasks". Clicking "+" opens `TaskModal` in create mode pre-filled with that room's `room_id`.

Tasks have **zero impact on availability**. The calendar API, booking widget, and availability checks do not read `calendar_tasks` at all.

### Task Modal

Fields:
- **Title** (required)
- **Description** (optional textarea)
- **Scope**: Property-wide or Room-specific (room dropdown appears if room-specific)
- **Date** (required — the start date / due date)
- **Recurrence**: None / Daily / Weekly / Monthly / Custom (custom shows an RRULE input for advanced users)
- **Ends**: Never / On date (date picker)
- **Status**: Pending / Complete (checkbox or toggle)
- **Color**: optional color picker (6 preset colors)

Recurrence is stored as an iCal RRULE string. The server expands recurring tasks into individual occurrences for the visible date range at query time using the `rrule` npm package (`npm install rrule`) — no pre-expansion stored in the database.

---

## Data Flow

```
Page load
  → GET /api/admin/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD
  → Returns: { rooms, bookings, icalBlocks, dateOverrides, tasks }

Cell renders
  → getDayInfo(roomId, date) checks in order:
    1. bookings (confirmed/pending overlap)
    2. icalBlocks (date overlap)
    3. dateOverrides (is_blocked)
    4. dateOverrides (price_override) → shown as cell price
    5. else → available, show base rate

Drag ends → SelectionBar shown
  → User clicks action → modal opens pre-filled

Modal saves
  → API call (booking create / date-override upsert / task create)
  → Optimistic update to local state (no full page reload)
  → useDateOverrides hook manages price/block local state

Room name clicked
  → Opens existing RoomCalendarModal (unchanged)

Task bar clicked
  → Opens TaskModal in edit mode
```

---

## Non-Goals

- The smart pricing engine (auto-adjusting prices within min/max range) is **not** built in this spec. Only the `price_min` / `price_max` fields are added to enable it later.
- No drag-and-drop to move bookings between dates or rooms.
- No guest-facing calendar changes.
- No changes to iCal sync logic.
- No changes to `RoomCalendarModal`.

---

## File Checklist

### Database migrations
- `supabase/migrations/NNN_date_overrides.sql` — NNN = next sequential number after existing migrations
- `supabase/migrations/NNN_calendar_tasks.sql`
- `supabase/migrations/NNN_room_price_range.sql`

### API routes
- `app/api/admin/calendar/route.ts`
- `app/api/admin/date-overrides/route.ts`
- `app/api/admin/calendar-tasks/route.ts`
- `app/api/admin/calendar-tasks/[id]/route.ts`

### Components (new)
- `components/admin/CalendarGrid.tsx`
- `components/admin/OccupancyBar.tsx`
- `components/admin/SelectionBar.tsx`
- `components/admin/CalendarLegend.tsx`
- `components/admin/CalendarTaskRow.tsx`
- `components/admin/NightDetailModal.tsx`
- `components/admin/TaskModal.tsx`

### Components (modal dialogs — from design)
- `components/admin/calendar/AddBookingModal.tsx`
- `components/admin/calendar/BlockDatesModal.tsx`
- `components/admin/calendar/SetPriceModal.tsx`
- `components/admin/calendar/BookingDetailModal.tsx`
- `components/admin/calendar/SmartPricingModal.tsx`

### Pages (rebuild)
- `app/admin/(protected)/calendar/page.tsx`

### Hooks
- `hooks/useDateOverrides.ts` — optimistic price/block state management

### Types (additions to `types/index.ts`)
- `DateOverride`
- `CalendarTask`
