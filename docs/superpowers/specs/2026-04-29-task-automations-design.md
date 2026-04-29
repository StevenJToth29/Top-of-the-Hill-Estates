# Task Automations Design

**Date:** 2026-04-29  
**Status:** Approved

## Overview

Automatically create calendar tasks based on booking lifecycle events (checkout, check-in, booking confirmed, booking cancelled). Rules are defined at global, property, or room level with a clear override chain: room → property → global. People (assignees) can be created and assigned to tasks; each person gets a private iCal link showing their assigned tasks.

---

## Data Model

### New table: `people`

```sql
CREATE TABLE people (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text        NOT NULL,
  ical_token   uuid        NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
```

### New table: `task_automations`

```sql
CREATE TABLE task_automations (
  id             uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type     text  NOT NULL CHECK (scope_type IN ('global', 'property', 'room')),
  room_id        uuid  REFERENCES rooms(id) ON DELETE CASCADE,
  property_id    uuid  REFERENCES properties(id) ON DELETE CASCADE,
  trigger_event  text  NOT NULL CHECK (trigger_event IN (
                   'booking_confirmed', 'checkin_day', 'checkout', 'booking_cancelled'
                 )),
  title          text  NOT NULL,
  description    text,
  day_offset     integer NOT NULL DEFAULT 0,
  color          text,
  assignee_id    uuid  REFERENCES people(id) ON DELETE SET NULL,
  is_active      boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
```

Scope constraints (enforced by CHECK or application logic):
- `scope_type = 'global'` → both `room_id` and `property_id` are null
- `scope_type = 'property'` → `property_id` set, `room_id` null
- `scope_type = 'room'` → `room_id` set, `property_id` null

### Modified table: `calendar_tasks`

Four new nullable columns:
```sql
ALTER TABLE calendar_tasks
  ADD COLUMN assignee_id         uuid REFERENCES people(id) ON DELETE SET NULL,
  ADD COLUMN source_booking_id   uuid REFERENCES bookings(id) ON DELETE SET NULL,
  ADD COLUMN source_ical_block_id uuid REFERENCES ical_blocks(id) ON DELETE SET NULL,
  ADD COLUMN automation_id       uuid REFERENCES task_automations(id) ON DELETE SET NULL;
```

- `assignee_id` — set on both auto-generated and manually created tasks
- `source_booking_id` / `source_ical_block_id` — exactly one is set on auto-generated tasks; both null on manual tasks
- `automation_id` — which rule generated this task; null on manual tasks
- Dedup key: `(source_booking_id, automation_id)` or `(source_ical_block_id, automation_id)` — skip insert if this combination already exists

### TypeScript types (additions to `types/index.ts`)

```typescript
export type TaskTriggerEvent =
  | 'booking_confirmed'
  | 'checkin_day'
  | 'checkout'
  | 'booking_cancelled'

export type TaskScopeType = 'global' | 'property' | 'room'

export interface Person {
  id: string
  name: string
  ical_token: string
  created_at: string
  updated_at: string
}

export interface TaskAutomation {
  id: string
  scope_type: TaskScopeType
  room_id: string | null
  property_id: string | null
  trigger_event: TaskTriggerEvent
  title: string
  description: string | null
  day_offset: number
  color: string | null
  assignee_id: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  // joined
  room?: { name: string }
  property?: { name: string }
  assignee?: Person
}
```

`CalendarTask` gains: `assignee_id`, `source_booking_id`, `source_ical_block_id`, `automation_id`.

---

## Task Generation Logic

### Override Resolution

Implemented in `lib/task-automation.ts`, shared by all generation paths.

For a given `(roomId, propertyId, triggerEvent)`:
1. Fetch active `room`-scope rules where `room_id = roomId` and `trigger_event` matches → if any, return these
2. Else fetch active `property`-scope rules where `property_id = propertyId` and `trigger_event` matches → if any, return these
3. Else fetch active `global`-scope rules where `trigger_event` matches → return these

### Due Date Calculation

| Trigger | Base date | Example (day_offset = 0) |
|---|---|---|
| `booking_confirmed` | today (UTC) | task due today |
| `booking_cancelled` | today (UTC) | task due today |
| `checkin_day` | booking `check_in` | task due on check-in day |
| `checkout` | booking `check_out` | task due on checkout day |

`due_date = base_date + day_offset` (positive = after, negative = before).

### Event-Driven Generation (`booking_confirmed`, `booking_cancelled`)

Triggered immediately at each status-change call site:
- Stripe webhook (payment captured → confirmed)
- `POST /api/admin/bookings/manual` (manual booking creation)
- `PATCH /api/admin/bookings/[id]/status` (admin status change to confirmed)
- `POST /api/bookings/[id]/confirm` (guest confirmation)
- `POST /api/bookings/[id]/cancel` and `POST /api/bookings/[id]/cancel/guest` (cancellation)

Each call site calls `generateTasksForBooking(bookingId, triggerEvent)` from `lib/task-automation.ts`:
1. Load booking with `room_id`, `check_in`, `check_out` and the room's `property_id`
2. Resolve automations via override logic
3. For each rule, compute `due_date`, check dedup key, insert if new

**Cancellation cleanup:** when a booking is cancelled, set `status = 'cancelled'` on any auto-generated pending tasks with `source_booking_id = bookingId` and `trigger_event IN ('checkin_day', 'checkout')`. (The `booking_cancelled` trigger then creates fresh tasks for that day.)

### Cron-Driven Generation (`checkin_day`, `checkout`)

New route: `GET /api/cron/generate-booking-tasks`  
Schedule: daily (same pattern as `expire-pending-bookings`).

**Confirmed bookings sweep:**
- Query confirmed bookings where `check_in` or `check_out` is within the next 14 days
- For each booking × trigger (`checkin_day`, `checkout`), resolve rules, dedup-insert tasks

**iCal blocks sweep:**
- Query `ical_blocks` where `start_date` or `end_date` is within the next 14 days
- For each block, resolve automations using the block's `room_id` and that room's `property_id`
- `checkin_day` → base date = `start_date`; `checkout` → base date = `end_date`
- Dedup key: `(source_ical_block_id, automation_id)`
- `booking_confirmed` and `booking_cancelled` triggers are skipped for iCal blocks

---

## API Routes

| Method | Route | Purpose |
|---|---|---|
| GET, POST | `/api/admin/task-automations` | List all rules / create rule |
| PATCH, DELETE | `/api/admin/task-automations/[id]` | Update / delete rule |
| GET, POST | `/api/admin/people` | List people / create person |
| PATCH, DELETE | `/api/admin/people/[id]` | Update / delete person |
| GET | `/api/ical/cleaner/[token]` | Public iCal feed for a person |

The iCal endpoint looks up the person by `ical_token`, fetches all their pending `calendar_tasks`, and returns a valid iCal feed with one `VEVENT` per task (due date as `DTSTART`/`DTEND`, title as `SUMMARY`, description if set, room/property name in `LOCATION`).

---

## Admin UI

### `/admin/task-automations` (new page)

- Rules section: grouped by scope (Global → Properties → Rooms), each row showing trigger event badge, title, day offset, assignee name, active toggle, edit/delete actions
- "Add Rule" button → modal with: scope selector, conditional property/room picker, trigger event, title, description, day offset, color, assignee dropdown, active toggle
- People section (below rules): table of people with name and a "Copy iCal Link" button per row; create/edit/delete people inline

### Room edit page — new "Automations" tab

- Room-level rules (full edit/delete controls)
- Inherited property rules (read-only, labelled "Inherited from [Property Name]")
- Inherited global rules (read-only, labelled "Inherited — Global")
- "Add room rule" opens the rule modal pre-scoped to this room

### Property edit page — new "Automations" tab

- Property-level rules (full edit/delete controls)
- Inherited global rules (read-only, labelled "Inherited — Global")
- "Add property rule" opens the rule modal pre-scoped to this property

### Calendar — task display updates

- `CalendarTaskRow` and `NightDetailModal`: show assignee initials badge (or name on hover) when `assignee_id` is set
- No other calendar changes

---

## File Checklist

### DB migrations
- `supabase/migrations/039_people.sql`
- `supabase/migrations/040_task_automations.sql`

### Lib
- `lib/task-automation.ts` — `resolveAutomations()`, `generateTasksForBooking()`, `generateTasksForICalBlock()`

### New cron
- `app/api/cron/generate-booking-tasks/route.ts`

### New API routes
- `app/api/admin/task-automations/route.ts`
- `app/api/admin/task-automations/[id]/route.ts`
- `app/api/admin/people/route.ts`
- `app/api/admin/people/[id]/route.ts`
- `app/api/ical/cleaner/[token]/route.ts`

### Modified API routes (add `generateTasksForBooking` calls)
- `app/api/bookings/[id]/confirm/route.ts`
- `app/api/bookings/[id]/cancel/route.ts`
- `app/api/bookings/[id]/cancel/guest/route.ts`
- `app/api/admin/bookings/manual/route.ts`
- `app/api/admin/bookings/[id]/status/route.ts`
- `app/api/stripe/webhook/route.ts`

### New admin pages & components
- `app/admin/(protected)/task-automations/page.tsx`
- `components/admin/TaskAutomationsPage.tsx`
- `components/admin/TaskAutomationModal.tsx`
- `components/admin/PeopleManager.tsx`
- `components/admin/RoomTaskAutomations.tsx` (embedded on room edit)
- `components/admin/PropertyTaskAutomations.tsx` (embedded on property edit)

### Modified components
- `components/admin/CalendarTaskRow.tsx` — assignee badge
- `components/admin/NightDetailModal.tsx` — assignee badge
- `components/admin/TaskModal.tsx` — assignee picker field
- `types/index.ts` — new types

---

## Out of Scope

- Cleaner login / task completion by assignees (admin tracks completion)
- Task automations for iCal blocks on `booking_confirmed` / `booking_cancelled` triggers
- Notification emails to assignees when tasks are created
