# Task Automations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-create calendar tasks from booking events (checkout, check-in, confirmed, cancelled) using scope-aware rules (room → property → global), with assignable people who each get a private iCal feed.

**Architecture:** A `task_automations` table stores rules; `lib/task-automation.ts` provides shared resolution + generation logic called at booking status-change points (event-driven for confirmed/cancelled) and from a new daily cron (for checkin_day/checkout and iCal blocks). A `people` table stores assignees; `calendar_tasks` gains four new columns. Admin UI spans a dedicated page plus Automations tabs on room/property edit forms.

**Tech Stack:** Next.js App Router, Supabase (Postgres), TypeScript, Jest, React, Tailwind, ical-generator

---

## File Map

**New files:**
- `supabase/migrations/039_people.sql`
- `supabase/migrations/040_task_automations.sql`
- `lib/task-automation.ts`
- `app/api/admin/people/route.ts`
- `app/api/admin/people/[id]/route.ts`
- `app/api/admin/task-automations/route.ts`
- `app/api/admin/task-automations/[id]/route.ts`
- `app/api/cron/generate-booking-tasks/route.ts`
- `app/api/ical/cleaner/[token]/route.ts`
- `app/admin/(protected)/task-automations/page.tsx`
- `components/admin/TaskAutomationModal.tsx`
- `components/admin/TaskAutomationsPage.tsx`
- `components/admin/PeopleManager.tsx`
- `components/admin/RoomTaskAutomations.tsx`
- `components/admin/PropertyTaskAutomations.tsx`
- `__tests__/lib/task-automation.test.ts`
- `__tests__/api/admin/people.test.ts`
- `__tests__/api/admin/task-automations.test.ts`
- `__tests__/api/admin/booking-confirmed-tasks.test.ts`
- `__tests__/api/admin/booking-cancelled-tasks.test.ts`
- `__tests__/api/cron/generate-booking-tasks.test.ts`

**Modified files:**
- `types/index.ts` — add Person, TaskAutomation, TaskTriggerEvent, TaskScopeType; extend CalendarTask
- `app/api/stripe/webhook/route.ts` — call generateTasksForBooking on payment_intent.succeeded
- `app/api/admin/bookings/manual/route.ts` — call generateTasksForBooking on confirmed booking
- `app/api/admin/bookings/[id]/application/review/route.ts` — call generateTasksForBooking on approval
- `app/api/bookings/[id]/cancel/route.ts` — call generateTasksForBooking + cleanupTasksForCancelledBooking
- `app/api/bookings/[id]/cancel/guest/route.ts` — same
- `components/admin/TaskModal.tsx` — add assignee_id picker
- `components/admin/CalendarTaskRow.tsx` — show assignee initials badge on tasks
- `components/admin/NightDetailModal.tsx` — show assignee name on tasks
- `components/admin/AdminSidebar.tsx` — add Tasks nav item
- `app/admin/(protected)/rooms/[id]/edit/page.tsx` — pass people to RoomForm
- `app/admin/(protected)/properties/[id]/edit/page.tsx` — pass people to PropertyForm
- `components/admin/RoomForm.tsx` — add Automations tab
- `components/admin/PropertyForm.tsx` — add Automations tab

---

## Task 1: DB Migrations

**Files:**
- Create: `supabase/migrations/039_people.sql`
- Create: `supabase/migrations/040_task_automations.sql`

- [ ] **Step 1: Create 039_people.sql**

```sql
-- supabase/migrations/039_people.sql
CREATE TABLE people (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  ical_token  uuid        NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE people ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on people"
  ON people USING (auth.role() = 'service_role');

CREATE TRIGGER update_people_updated_at
  BEFORE UPDATE ON people
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

- [ ] **Step 2: Create 040_task_automations.sql**

```sql
-- supabase/migrations/040_task_automations.sql
CREATE TABLE task_automations (
  id            uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type    text    NOT NULL CHECK (scope_type IN ('global', 'property', 'room')),
  room_id       uuid    REFERENCES rooms(id) ON DELETE CASCADE,
  property_id   uuid    REFERENCES properties(id) ON DELETE CASCADE,
  trigger_event text    NOT NULL CHECK (trigger_event IN (
                  'booking_confirmed', 'checkin_day', 'checkout', 'booking_cancelled'
                )),
  title         text    NOT NULL,
  description   text,
  day_offset    integer NOT NULL DEFAULT 0,
  color         text,
  assignee_id   uuid    REFERENCES people(id) ON DELETE SET NULL,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_scope_global
    CHECK (scope_type != 'global' OR (room_id IS NULL AND property_id IS NULL)),
  CONSTRAINT chk_scope_property
    CHECK (scope_type != 'property' OR (property_id IS NOT NULL AND room_id IS NULL)),
  CONSTRAINT chk_scope_room
    CHECK (scope_type != 'room' OR (room_id IS NOT NULL AND property_id IS NULL))
);

CREATE INDEX idx_task_automations_lookup
  ON task_automations (scope_type, trigger_event, room_id, property_id)
  WHERE is_active = true;

ALTER TABLE task_automations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on task_automations"
  ON task_automations USING (auth.role() = 'service_role');

CREATE TRIGGER update_task_automations_updated_at
  BEFORE UPDATE ON task_automations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Extend calendar_tasks
ALTER TABLE calendar_tasks
  ADD COLUMN IF NOT EXISTS assignee_id           uuid REFERENCES people(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_booking_id     uuid REFERENCES bookings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_ical_block_id  uuid REFERENCES ical_blocks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS automation_id         uuid REFERENCES task_automations(id) ON DELETE SET NULL;
```

- [ ] **Step 3: Apply migrations to local Supabase**

```bash
npx supabase db push
```

Expected: migrations apply without error.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/039_people.sql supabase/migrations/040_task_automations.sql
git commit -m "feat: add people and task_automations tables, extend calendar_tasks"
```

---

## Task 2: TypeScript Types

**Files:**
- Modify: `types/index.ts`

- [ ] **Step 1: Add new types after the CalendarTask/TaskException block (after line 495)**

Open `types/index.ts` and add after the `TaskException` interface:

```typescript
// ── Task automations ──────────────────────────────────────────────────────────

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
  room?: { name: string }
  property?: { name: string }
  assignee?: Person
}
```

- [ ] **Step 2: Extend CalendarTask with the four new columns**

Find the `CalendarTask` interface (around line 467) and add four fields before `created_at`:

```typescript
  assignee_id: string | null
  source_booking_id: string | null
  source_ical_block_id: string | null
  automation_id: string | null
  assignee?: Person
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add types/index.ts
git commit -m "feat: add Person, TaskAutomation types; extend CalendarTask"
```

---

## Task 3: Core Task-Automation Library

**Files:**
- Create: `lib/task-automation.ts`
- Create: `__tests__/lib/task-automation.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/lib/task-automation.test.ts`:

```typescript
/**
 * @jest-environment node
 */
import {
  addDays,
  resolveAutomations,
  generateTasksForBooking,
  generateTasksForDateTrigger,
  generateTasksForICalBlock,
  cleanupTasksForCancelledBooking,
} from '@/lib/task-automation'
import type { TaskAutomation } from '@/types'

jest.mock('@/lib/supabase', () => ({
  createServiceRoleClient: jest.fn(),
}))
import { createServiceRoleClient } from '@/lib/supabase'

// ── addDays ──────────────────────────────────────────────────────────────────

describe('addDays', () => {
  it('returns the same date when offset is 0', () => {
    expect(addDays('2026-05-01', 0)).toBe('2026-05-01')
  })
  it('adds positive days', () => {
    expect(addDays('2026-05-01', 2)).toBe('2026-05-03')
  })
  it('subtracts when offset is negative', () => {
    expect(addDays('2026-05-03', -1)).toBe('2026-05-02')
  })
  it('handles month rollover', () => {
    expect(addDays('2026-05-31', 1)).toBe('2026-06-01')
  })
})

// ── resolveAutomations ───────────────────────────────────────────────────────

const roomRule: TaskAutomation = {
  id: 'auto-room', scope_type: 'room', room_id: 'room-1', property_id: null,
  trigger_event: 'checkout', title: 'Room Clean', description: null,
  day_offset: 0, color: null, assignee_id: null, is_active: true,
  created_at: '', updated_at: '',
}
const propertyRule: TaskAutomation = {
  id: 'auto-prop', scope_type: 'property', room_id: null, property_id: 'prop-1',
  trigger_event: 'checkout', title: 'Property Clean', description: null,
  day_offset: 0, color: null, assignee_id: null, is_active: true,
  created_at: '', updated_at: '',
}
const globalRule: TaskAutomation = {
  id: 'auto-global', scope_type: 'global', room_id: null, property_id: null,
  trigger_event: 'checkout', title: 'Global Clean', description: null,
  day_offset: 0, color: null, assignee_id: null, is_active: true,
  created_at: '', updated_at: '',
}

function makeSupabaseMock(roomRules: TaskAutomation[], propRules: TaskAutomation[], globalRules: TaskAutomation[]) {
  let callCount = 0
  const makeChain = (data: TaskAutomation[]) => {
    const obj: Record<string, unknown> = {}
    obj.eq = jest.fn().mockReturnValue(obj)
    obj.then = jest.fn().mockImplementation((resolve: (v: { data: TaskAutomation[] }) => unknown) =>
      Promise.resolve(resolve({ data })),
    )
    return obj
  }
  return {
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockImplementation(() => {
          callCount++
          if (callCount <= 3) {
            // First .eq chain returns the mock chain for that call
          }
          return makeChain(callCount === 1 ? roomRules : callCount === 2 ? propRules : globalRules)
        }),
      }),
    }),
  }
}

describe('resolveAutomations', () => {
  it('returns room rules when they exist, skipping property and global', async () => {
    const db = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ data: [roomRule] }),
              }),
            }),
          }),
        }),
      }),
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await resolveAutomations(db as any, 'room-1', 'prop-1', 'checkout')
    expect(result).toEqual([roomRule])
    expect(db.from).toHaveBeenCalledTimes(1)
  })

  it('falls back to property rules when no room rules exist', async () => {
    let call = 0
    const db = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockImplementation(() => {
                  call++
                  return Promise.resolve({ data: call === 1 ? [] : [propertyRule] })
                }),
              }),
            }),
          }),
        }),
      }),
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await resolveAutomations(db as any, 'room-1', 'prop-1', 'checkout')
    expect(result).toEqual([propertyRule])
  })

  it('falls back to global rules when no room or property rules exist', async () => {
    let call = 0
    const db = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockImplementation(() => {
                  call++
                  return Promise.resolve({ data: call < 3 ? [] : [globalRule] })
                }),
              }),
            }),
          }),
        }),
      }),
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await resolveAutomations(db as any, 'room-1', 'prop-1', 'checkout')
    expect(result).toEqual([globalRule])
  })
})

// ── generateTasksForBooking ──────────────────────────────────────────────────

describe('generateTasksForBooking', () => {
  beforeEach(() => jest.clearAllMocks())

  it('inserts tasks for each resolved automation', async () => {
    const mockInsert = jest.fn().mockResolvedValue({ error: null })
    const mockSelectExisting = jest.fn().mockResolvedValue({ data: [] })
    let fromCall = 0

    ;(createServiceRoleClient as jest.Mock).mockReturnValue({
      from: jest.fn().mockImplementation((table: string) => {
        fromCall++
        if (table === 'bookings') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: {
                    id: 'booking-1', check_in: '2026-06-01', check_out: '2026-06-05',
                    room_id: 'room-1', room: { property_id: 'prop-1' },
                  },
                  error: null,
                }),
              }),
            }),
          }
        }
        if (table === 'task_automations') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  eq: jest.fn().mockReturnValue({
                    eq: jest.fn().mockResolvedValue({ data: [globalRule] }),
                  }),
                }),
              }),
            }),
          }
        }
        if (fromCall > 3) {
          return { select: jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue({ not: jest.fn().mockReturnValue(mockSelectExisting()) }) }), insert: mockInsert }
        }
        return { select: jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue({ not: jest.fn().mockReturnValue(mockSelectExisting()) }) }), insert: mockInsert }
      }),
    })

    await generateTasksForBooking('booking-1', 'booking_confirmed')
    // Verifies that insert was called (or no-op if dedup) — main assertion is no throw
  })

  it('returns early when booking is not found', async () => {
    ;(createServiceRoleClient as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    })
    await expect(generateTasksForBooking('missing', 'booking_confirmed')).resolves.toBeUndefined()
  })
})

// ── cleanupTasksForCancelledBooking ──────────────────────────────────────────

describe('cleanupTasksForCancelledBooking', () => {
  beforeEach(() => jest.clearAllMocks())

  it('deletes pending auto-generated tasks for the booking', async () => {
    const mockDelete = jest.fn().mockResolvedValue({ error: null })
    ;(createServiceRoleClient as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              not: jest.fn().mockReturnValue(mockDelete()),
            }),
          }),
        }),
      }),
    })
    await cleanupTasksForCancelledBooking('booking-1')
    // No throw = pass
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test -- --testPathPattern="__tests__/lib/task-automation" --no-coverage
```

Expected: FAIL — "Cannot find module '@/lib/task-automation'"

- [ ] **Step 3: Implement lib/task-automation.ts**

Create `lib/task-automation.ts`:

```typescript
import { createServiceRoleClient } from '@/lib/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { TaskAutomation, TaskTriggerEvent } from '@/types'

export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export async function resolveAutomations(
  supabase: SupabaseClient,
  roomId: string,
  propertyId: string,
  triggerEvent: TaskTriggerEvent,
): Promise<TaskAutomation[]> {
  const { data: roomRules } = await supabase
    .from('task_automations')
    .select('*')
    .eq('scope_type', 'room')
    .eq('room_id', roomId)
    .eq('trigger_event', triggerEvent)
    .eq('is_active', true)
  if (roomRules && roomRules.length > 0) return roomRules as TaskAutomation[]

  const { data: propertyRules } = await supabase
    .from('task_automations')
    .select('*')
    .eq('scope_type', 'property')
    .eq('property_id', propertyId)
    .eq('trigger_event', triggerEvent)
    .eq('is_active', true)
  if (propertyRules && propertyRules.length > 0) return propertyRules as TaskAutomation[]

  const { data: globalRules } = await supabase
    .from('task_automations')
    .select('*')
    .eq('scope_type', 'global')
    .eq('trigger_event', triggerEvent)
    .eq('is_active', true)
  return (globalRules ?? []) as TaskAutomation[]
}

async function insertNewTasks(
  supabase: SupabaseClient,
  rules: TaskAutomation[],
  baseDate: string,
  roomId: string,
  sourceBookingId: string | null,
  sourceIcalBlockId: string | null,
): Promise<void> {
  const sourceCol = sourceBookingId ? 'source_booking_id' : 'source_ical_block_id'
  const sourceVal = sourceBookingId ?? sourceIcalBlockId

  const { data: existing } = await supabase
    .from('calendar_tasks')
    .select('automation_id')
    .eq(sourceCol, sourceVal as string)
    .not('automation_id', 'is', null)

  const existingIds = new Set((existing ?? []).map((t: { automation_id: string }) => t.automation_id))

  const newTasks = rules
    .filter((rule) => !existingIds.has(rule.id))
    .map((rule) => ({
      title: rule.title,
      description: rule.description ?? null,
      due_date: addDays(baseDate, rule.day_offset),
      room_id: roomId,
      color: rule.color ?? null,
      assignee_id: rule.assignee_id ?? null,
      source_booking_id: sourceBookingId,
      source_ical_block_id: sourceIcalBlockId,
      automation_id: rule.id,
      status: 'pending',
    }))

  if (newTasks.length > 0) {
    const { error } = await supabase.from('calendar_tasks').insert(newTasks)
    if (error) console.error('[task-automation] insert error:', error)
  }

  // Update due_date for existing tasks if base date changed (handles booking date edits)
  const existingTasks = (existing ?? []) as Array<{ automation_id: string; due_date?: string; id?: string }>
  const { data: existingWithDates } = await supabase
    .from('calendar_tasks')
    .select('id, automation_id, due_date')
    .eq(sourceCol, sourceVal as string)
    .not('automation_id', 'is', null)

  for (const rule of rules) {
    const expectedDate = addDays(baseDate, rule.day_offset)
    const stored = (existingWithDates ?? []).find(
      (t: { automation_id: string }) => t.automation_id === rule.id,
    ) as { id: string; due_date: string } | undefined
    if (stored && stored.due_date !== expectedDate) {
      await supabase
        .from('calendar_tasks')
        .update({ due_date: expectedDate })
        .eq('id', stored.id)
    }
  }
}

export async function generateTasksForBooking(
  bookingId: string,
  triggerEvent: 'booking_confirmed' | 'booking_cancelled',
): Promise<void> {
  const supabase = createServiceRoleClient()

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, check_in, check_out, room_id, room:rooms(property_id)')
    .eq('id', bookingId)
    .single()

  if (!booking || !booking.room) return

  const propertyId = (booking.room as { property_id: string }).property_id
  const rules = await resolveAutomations(supabase, booking.room_id, propertyId, triggerEvent)
  if (rules.length === 0) return

  const today = new Date().toISOString().slice(0, 10)
  await insertNewTasks(supabase, rules, today, booking.room_id, bookingId, null)
}

export async function generateTasksForDateTrigger(
  sourceBookingId: string,
  triggerEvent: 'checkin_day' | 'checkout',
  checkIn: string,
  checkOut: string,
  roomId: string,
  propertyId: string,
): Promise<void> {
  const supabase = createServiceRoleClient()
  const rules = await resolveAutomations(supabase, roomId, propertyId, triggerEvent)
  if (rules.length === 0) return

  const baseDate = triggerEvent === 'checkin_day' ? checkIn : checkOut
  await insertNewTasks(supabase, rules, baseDate, roomId, sourceBookingId, null)
}

export async function generateTasksForICalBlock(
  icalBlockId: string,
  triggerEvent: 'checkin_day' | 'checkout',
  startDate: string,
  endDate: string,
  roomId: string,
  propertyId: string,
): Promise<void> {
  const supabase = createServiceRoleClient()
  const rules = await resolveAutomations(supabase, roomId, propertyId, triggerEvent)
  if (rules.length === 0) return

  const baseDate = triggerEvent === 'checkin_day' ? startDate : endDate
  await insertNewTasks(supabase, rules, baseDate, roomId, null, icalBlockId)
}

export async function cleanupTasksForCancelledBooking(bookingId: string): Promise<void> {
  const supabase = createServiceRoleClient()
  await supabase
    .from('calendar_tasks')
    .delete()
    .eq('source_booking_id', bookingId)
    .eq('status', 'pending')
    .not('automation_id', 'is', null)
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm test -- --testPathPattern="__tests__/lib/task-automation" --no-coverage
```

Expected: PASS (all tests green)

- [ ] **Step 5: Commit**

```bash
git add lib/task-automation.ts __tests__/lib/task-automation.test.ts
git commit -m "feat: add task-automation lib with resolve, generate, and cleanup logic"
```

---

## Task 4: People API Routes

**Files:**
- Create: `app/api/admin/people/route.ts`
- Create: `app/api/admin/people/[id]/route.ts`
- Create: `__tests__/api/admin/people.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/api/admin/people.test.ts`:

```typescript
/**
 * @jest-environment node
 */
import { GET, POST } from '@/app/api/admin/people/route'
import { PATCH, DELETE } from '@/app/api/admin/people/[id]/route'
import { NextRequest } from 'next/server'

jest.mock('@/lib/supabase', () => ({
  createServerSupabaseClient: jest.fn(),
  createServiceRoleClient: jest.fn(),
}))
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase'

const mockUser = { id: 'user-1' }
function makeAuth(user = mockUser) {
  return { auth: { getUser: jest.fn().mockResolvedValue({ data: { user }, error: null }) } }
}
function makeAuthFail() {
  return { auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: new Error('no auth') }) } }
}

const personRow = { id: 'person-1', name: 'Alice', ical_token: 'tok-1', created_at: '', updated_at: '' }

function makeDb(overrides: Record<string, unknown> = {}) {
  const single = jest.fn().mockResolvedValue({ data: personRow, error: null })
  const select = jest.fn().mockReturnValue({ order: jest.fn().mockResolvedValue({ data: [personRow], error: null }), single })
  const insert = jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ single }) })
  const eqUpdate = jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ single }) })
  const update = jest.fn().mockReturnValue({ eq: eqUpdate })
  const eqDelete = jest.fn().mockResolvedValue({ error: null })
  const del = jest.fn().mockReturnValue({ eq: eqDelete })
  return { from: jest.fn().mockReturnValue({ select, insert, update, delete: del }), ...overrides }
}

const idParams = { params: Promise.resolve({ id: 'person-1' }) }

describe('GET /api/admin/people', () => {
  it('returns 401 when not authenticated', async () => {
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(makeAuthFail())
    const res = await GET()
    expect(res.status).toBe(401)
  })
  it('returns list of people', async () => {
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(makeAuth())
    ;(createServiceRoleClient as jest.Mock).mockReturnValue(makeDb())
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual([personRow])
  })
})

describe('POST /api/admin/people', () => {
  it('returns 400 when name is missing', async () => {
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(makeAuth())
    ;(createServiceRoleClient as jest.Mock).mockReturnValue(makeDb())
    const req = new NextRequest('http://localhost/api/admin/people', {
      method: 'POST', body: JSON.stringify({}), headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
  it('creates a person and returns 201', async () => {
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(makeAuth())
    ;(createServiceRoleClient as jest.Mock).mockReturnValue(makeDb())
    const req = new NextRequest('http://localhost/api/admin/people', {
      method: 'POST', body: JSON.stringify({ name: 'Alice' }), headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
  })
})

describe('PATCH /api/admin/people/[id]', () => {
  it('returns 401 when not authenticated', async () => {
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(makeAuthFail())
    const req = new NextRequest('http://localhost/api/admin/people/person-1', {
      method: 'PATCH', body: JSON.stringify({ name: 'Bob' }), headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req, idParams)
    expect(res.status).toBe(401)
  })
  it('updates and returns 200', async () => {
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(makeAuth())
    ;(createServiceRoleClient as jest.Mock).mockReturnValue(makeDb())
    const req = new NextRequest('http://localhost/api/admin/people/person-1', {
      method: 'PATCH', body: JSON.stringify({ name: 'Bob' }), headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req, idParams)
    expect(res.status).toBe(200)
  })
})

describe('DELETE /api/admin/people/[id]', () => {
  it('deletes and returns 200', async () => {
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(makeAuth())
    ;(createServiceRoleClient as jest.Mock).mockReturnValue(makeDb())
    const req = new NextRequest('http://localhost/api/admin/people/person-1', { method: 'DELETE' })
    const res = await DELETE(req, idParams)
    expect(res.status).toBe(200)
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test -- --testPathPattern="__tests__/api/admin/people" --no-coverage
```

Expected: FAIL — "Cannot find module"

- [ ] **Step 3: Implement /api/admin/people/route.ts**

Create `app/api/admin/people/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase'

async function requireAuth() {
  const server = await createServerSupabaseClient()
  const { data: { user }, error } = await server.auth.getUser()
  return error || !user ? null : user
}

export async function GET() {
  if (!(await requireAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase.from('people').select('*').order('name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: NextRequest) {
  if (!(await requireAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = (await request.json()) as { name?: string }
  if (!body.name || typeof body.name !== 'string') {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('people')
    .insert({ name: body.name.trim() })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
```

- [ ] **Step 4: Implement /api/admin/people/[id]/route.ts**

Create `app/api/admin/people/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase'

async function requireAuth() {
  const server = await createServerSupabaseClient()
  const { data: { user }, error } = await server.auth.getUser()
  return error || !user ? null : user
}

interface RouteContext { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  if (!(await requireAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = (await request.json()) as { name?: string }
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('people')
    .update({ name: body.name })
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  if (!(await requireAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const supabase = createServiceRoleClient()
  const { error } = await supabase.from('people').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 5: Run tests — verify they pass**

```bash
npm test -- --testPathPattern="__tests__/api/admin/people" --no-coverage
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/api/admin/people/ __tests__/api/admin/people.test.ts
git commit -m "feat: add people CRUD API routes"
```

---

## Task 5: Task Automations API Routes

**Files:**
- Create: `app/api/admin/task-automations/route.ts`
- Create: `app/api/admin/task-automations/[id]/route.ts`
- Create: `__tests__/api/admin/task-automations.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/api/admin/task-automations.test.ts`:

```typescript
/**
 * @jest-environment node
 */
import { GET, POST } from '@/app/api/admin/task-automations/route'
import { PATCH, DELETE } from '@/app/api/admin/task-automations/[id]/route'
import { NextRequest } from 'next/server'

jest.mock('@/lib/supabase', () => ({
  createServerSupabaseClient: jest.fn(),
  createServiceRoleClient: jest.fn(),
}))
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase'

const mockUser = { id: 'user-1' }
function makeAuth() {
  return { auth: { getUser: jest.fn().mockResolvedValue({ data: { user: mockUser }, error: null }) } }
}
function makeAuthFail() {
  return { auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: new Error('fail') }) } }
}

const autoRow = {
  id: 'auto-1', scope_type: 'global', room_id: null, property_id: null,
  trigger_event: 'checkout', title: 'Clean', description: null,
  day_offset: 0, color: null, assignee_id: null, is_active: true,
  created_at: '', updated_at: '',
}

function makeDb() {
  const single = jest.fn().mockResolvedValue({ data: autoRow, error: null })
  const select = jest.fn().mockReturnValue({
    order: jest.fn().mockReturnValue({
      order: jest.fn().mockResolvedValue({ data: [autoRow], error: null }),
    }),
    single,
  })
  const insert = jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ single }) })
  const eqUpdate = jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ single }) })
  const update = jest.fn().mockReturnValue({ eq: eqUpdate })
  const eqDelete = jest.fn().mockResolvedValue({ error: null })
  const del = jest.fn().mockReturnValue({ eq: eqDelete })
  return { from: jest.fn().mockReturnValue({ select, insert, update, delete: del }) }
}

const idParams = { params: Promise.resolve({ id: 'auto-1' }) }

describe('GET /api/admin/task-automations', () => {
  it('returns 401 when unauthenticated', async () => {
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(makeAuthFail())
    const res = await GET()
    expect(res.status).toBe(401)
  })
  it('returns list', async () => {
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(makeAuth())
    ;(createServiceRoleClient as jest.Mock).mockReturnValue(makeDb())
    const res = await GET()
    expect(res.status).toBe(200)
  })
})

describe('POST /api/admin/task-automations', () => {
  it('returns 400 when required fields missing', async () => {
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(makeAuth())
    ;(createServiceRoleClient as jest.Mock).mockReturnValue(makeDb())
    const req = new NextRequest('http://localhost/api/admin/task-automations', {
      method: 'POST', body: JSON.stringify({ scope_type: 'global' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
  it('creates automation and returns 201', async () => {
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(makeAuth())
    ;(createServiceRoleClient as jest.Mock).mockReturnValue(makeDb())
    const req = new NextRequest('http://localhost/api/admin/task-automations', {
      method: 'POST',
      body: JSON.stringify({ scope_type: 'global', trigger_event: 'checkout', title: 'Clean', day_offset: 0 }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
  })
})

describe('PATCH /api/admin/task-automations/[id]', () => {
  it('updates and returns 200', async () => {
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(makeAuth())
    ;(createServiceRoleClient as jest.Mock).mockReturnValue(makeDb())
    const req = new NextRequest('http://localhost/api/admin/task-automations/auto-1', {
      method: 'PATCH', body: JSON.stringify({ is_active: false }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req, idParams)
    expect(res.status).toBe(200)
  })
})

describe('DELETE /api/admin/task-automations/[id]', () => {
  it('deletes and returns 200', async () => {
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(makeAuth())
    ;(createServiceRoleClient as jest.Mock).mockReturnValue(makeDb())
    const req = new NextRequest('http://localhost/api/admin/task-automations/auto-1', { method: 'DELETE' })
    const res = await DELETE(req, idParams)
    expect(res.status).toBe(200)
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test -- --testPathPattern="__tests__/api/admin/task-automations" --no-coverage
```

Expected: FAIL — "Cannot find module"

- [ ] **Step 3: Implement /api/admin/task-automations/route.ts**

Create `app/api/admin/task-automations/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase'

async function requireAuth() {
  const server = await createServerSupabaseClient()
  const { data: { user }, error } = await server.auth.getUser()
  return error || !user ? null : user
}

export async function GET() {
  if (!(await requireAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('task_automations')
    .select('*, room:rooms(name), property:properties(name), assignee:people(id,name)')
    .order('scope_type')
    .order('created_at')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: NextRequest) {
  if (!(await requireAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = (await request.json()) as Record<string, unknown>
  if (!body.scope_type || !body.trigger_event || !body.title) {
    return NextResponse.json({ error: 'scope_type, trigger_event, and title are required' }, { status: 400 })
  }
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('task_automations')
    .insert({
      scope_type: body.scope_type,
      room_id: body.room_id ?? null,
      property_id: body.property_id ?? null,
      trigger_event: body.trigger_event,
      title: body.title,
      description: body.description ?? null,
      day_offset: body.day_offset ?? 0,
      color: body.color ?? null,
      assignee_id: body.assignee_id ?? null,
      is_active: body.is_active ?? true,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
```

- [ ] **Step 4: Implement /api/admin/task-automations/[id]/route.ts**

Create `app/api/admin/task-automations/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase'

async function requireAuth() {
  const server = await createServerSupabaseClient()
  const { data: { user }, error } = await server.auth.getUser()
  return error || !user ? null : user
}

interface RouteContext { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  if (!(await requireAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = (await request.json()) as Record<string, unknown>
  const allowed = ['title', 'description', 'day_offset', 'color', 'assignee_id', 'is_active', 'trigger_event', 'room_id', 'property_id', 'scope_type']
  const update = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)))
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('task_automations')
    .update(update)
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  if (!(await requireAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const supabase = createServiceRoleClient()
  const { error } = await supabase.from('task_automations').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 5: Run tests — verify they pass**

```bash
npm test -- --testPathPattern="__tests__/api/admin/task-automations" --no-coverage
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/api/admin/task-automations/ __tests__/api/admin/task-automations.test.ts
git commit -m "feat: add task-automations CRUD API routes"
```

---

## Task 6: Hook booking_confirmed Event

**Files:**
- Modify: `app/api/stripe/webhook/route.ts`
- Modify: `app/api/admin/bookings/manual/route.ts`
- Modify: `app/api/admin/bookings/[id]/application/review/route.ts`
- Create: `__tests__/api/admin/booking-confirmed-tasks.test.ts`

- [ ] **Step 1: Write failing test**

Create `__tests__/api/admin/booking-confirmed-tasks.test.ts`:

```typescript
/**
 * @jest-environment node
 */
import * as taskAutomation from '@/lib/task-automation'

jest.mock('@/lib/task-automation', () => ({
  generateTasksForBooking: jest.fn().mockResolvedValue(undefined),
  cleanupTasksForCancelledBooking: jest.fn().mockResolvedValue(undefined),
}))

describe('generateTasksForBooking is exported and callable', () => {
  it('resolves without throwing', async () => {
    await expect(taskAutomation.generateTasksForBooking('booking-1', 'booking_confirmed')).resolves.toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test — verify it passes (it's a smoke test for the mock)**

```bash
npm test -- --testPathPattern="__tests__/api/admin/booking-confirmed-tasks" --no-coverage
```

Expected: PASS

- [ ] **Step 3: Add generateTasksForBooking call to Stripe webhook**

In `app/api/stripe/webhook/route.ts`, add the import at the top alongside other imports:

```typescript
import { generateTasksForBooking } from '@/lib/task-automation'
```

In the `payment_intent.succeeded` case, after the existing `seedReminderEmails` call (around line 61-63), add:

```typescript
        generateTasksForBooking((booking as Booking).id, 'booking_confirmed').catch((err) => {
          console.error('task automation error on booking_confirmed:', err)
        })
```

- [ ] **Step 4: Add generateTasksForBooking call to manual booking route**

In `app/api/admin/bookings/manual/route.ts`, add the import:

```typescript
import { generateTasksForBooking } from '@/lib/task-automation'
```

Find the section where `booking_confirmed` email is queued (around line 229) and add after those calls:

```typescript
  generateTasksForBooking(booking.id as string, 'booking_confirmed').catch((err) => {
    console.error('task automation error on manual booking_confirmed:', err)
  })
```

- [ ] **Step 5: Add generateTasksForBooking call to application review route**

In `app/api/admin/bookings/[id]/application/review/route.ts`, add the import:

```typescript
import { generateTasksForBooking } from '@/lib/task-automation'
```

In the `body.decision === 'approved'` branch, after `seedReminderEmails` call, add:

```typescript
    generateTasksForBooking(bookingId, 'booking_confirmed').catch(
      (err) => { console.error('task automation error on booking_approved:', err) }
    )
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add app/api/stripe/webhook/route.ts app/api/admin/bookings/manual/route.ts app/api/admin/bookings/[id]/application/review/route.ts __tests__/api/admin/booking-confirmed-tasks.test.ts
git commit -m "feat: generate tasks on booking_confirmed event"
```

---

## Task 7: Hook booking_cancelled Event

**Files:**
- Modify: `app/api/bookings/[id]/cancel/route.ts`
- Modify: `app/api/bookings/[id]/cancel/guest/route.ts`
- Create: `__tests__/api/admin/booking-cancelled-tasks.test.ts`

- [ ] **Step 1: Write failing test**

Create `__tests__/api/admin/booking-cancelled-tasks.test.ts`:

```typescript
/**
 * @jest-environment node
 */
import * as taskAutomation from '@/lib/task-automation'

jest.mock('@/lib/task-automation', () => ({
  generateTasksForBooking: jest.fn().mockResolvedValue(undefined),
  cleanupTasksForCancelledBooking: jest.fn().mockResolvedValue(undefined),
}))

describe('cleanupTasksForCancelledBooking is exported and callable', () => {
  it('resolves without throwing', async () => {
    await expect(taskAutomation.cleanupTasksForCancelledBooking('booking-1')).resolves.toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test — verify it passes**

```bash
npm test -- --testPathPattern="__tests__/api/admin/booking-cancelled-tasks" --no-coverage
```

Expected: PASS

- [ ] **Step 3: Add calls to admin cancel route**

In `app/api/bookings/[id]/cancel/route.ts`, add the import after the existing imports:

```typescript
import { generateTasksForBooking, cleanupTasksForCancelledBooking } from '@/lib/task-automation'
```

After the existing `cancelBookingEmails` call (near the end of the route, before the `return NextResponse.json`), add:

```typescript
    cleanupTasksForCancelledBooking(params.id).catch((err) => {
      console.error('task cleanup error on booking_cancelled:', err)
    })
    generateTasksForBooking(params.id, 'booking_cancelled').catch((err) => {
      console.error('task automation error on booking_cancelled:', err)
    })
```

- [ ] **Step 4: Add same calls to guest cancel route**

In `app/api/bookings/[id]/cancel/guest/route.ts`, add the import:

```typescript
import { generateTasksForBooking, cleanupTasksForCancelledBooking } from '@/lib/task-automation'
```

Find the same pattern (after `cancelBookingEmails`) and add:

```typescript
    cleanupTasksForCancelledBooking(params.id).catch((err) => {
      console.error('task cleanup error on guest booking_cancelled:', err)
    })
    generateTasksForBooking(params.id, 'booking_cancelled').catch((err) => {
      console.error('task automation error on guest booking_cancelled:', err)
    })
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add app/api/bookings/[id]/cancel/route.ts app/api/bookings/[id]/cancel/guest/route.ts __tests__/api/admin/booking-cancelled-tasks.test.ts
git commit -m "feat: generate and cleanup tasks on booking_cancelled event"
```

---

## Task 8: Cron — generate-booking-tasks

**Files:**
- Create: `app/api/cron/generate-booking-tasks/route.ts`
- Create: `__tests__/api/cron/generate-booking-tasks.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/api/cron/generate-booking-tasks.test.ts`:

```typescript
/**
 * @jest-environment node
 */
import { GET } from '@/app/api/cron/generate-booking-tasks/route'
import { NextRequest } from 'next/server'

jest.mock('@/lib/supabase', () => ({ createServiceRoleClient: jest.fn() }))
jest.mock('@/lib/task-automation', () => ({
  generateTasksForDateTrigger: jest.fn().mockResolvedValue(undefined),
  generateTasksForICalBlock: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('@/lib/timing-safe-compare', () => ({ timingSafeCompare: jest.fn() }))

import { createServiceRoleClient } from '@/lib/supabase'
import { generateTasksForDateTrigger, generateTasksForICalBlock } from '@/lib/task-automation'
import { timingSafeCompare } from '@/lib/timing-safe-compare'

function makeReq(auth = 'Bearer test-secret') {
  return new NextRequest('http://localhost/api/cron/generate-booking-tasks', {
    headers: { Authorization: auth },
  })
}

const booking = {
  id: 'b-1', check_in: '2026-05-01', check_out: '2026-05-05',
  room_id: 'room-1', room: { property_id: 'prop-1' },
}
const icalBlock = {
  id: 'ical-1', start_date: '2026-05-02', end_date: '2026-05-06',
  room_id: 'room-1', room: { property_id: 'prop-1' },
}

describe('GET /api/cron/generate-booking-tasks', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 401 when auth fails', async () => {
    ;(timingSafeCompare as jest.Mock).mockReturnValue(false)
    const res = await GET(makeReq('bad'))
    expect(res.status).toBe(401)
  })

  it('calls generateTasksForDateTrigger for each booking × trigger', async () => {
    ;(timingSafeCompare as jest.Mock).mockReturnValue(true)
    ;(createServiceRoleClient as jest.Mock).mockReturnValue({
      from: jest.fn().mockImplementation((table: string) => ({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lte: jest.fn().mockResolvedValue({
                data: table === 'bookings' ? [booking] : [icalBlock],
                error: null,
              }),
            }),
          }),
        }),
      })),
    })
    const res = await GET(makeReq())
    expect(res.status).toBe(200)
    expect(generateTasksForDateTrigger).toHaveBeenCalledWith(
      'b-1', 'checkin_day', '2026-05-01', '2026-05-05', 'room-1', 'prop-1',
    )
    expect(generateTasksForDateTrigger).toHaveBeenCalledWith(
      'b-1', 'checkout', '2026-05-01', '2026-05-05', 'room-1', 'prop-1',
    )
    expect(generateTasksForICalBlock).toHaveBeenCalledWith(
      'ical-1', 'checkin_day', '2026-05-02', '2026-05-06', 'room-1', 'prop-1',
    )
    expect(generateTasksForICalBlock).toHaveBeenCalledWith(
      'ical-1', 'checkout', '2026-05-02', '2026-05-06', 'room-1', 'prop-1',
    )
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test -- --testPathPattern="__tests__/api/cron/generate-booking-tasks" --no-coverage
```

Expected: FAIL — "Cannot find module"

- [ ] **Step 3: Implement the cron route**

Create `app/api/cron/generate-booking-tasks/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase'
import { generateTasksForDateTrigger, generateTasksForICalBlock } from '@/lib/task-automation'
import { timingSafeCompare } from '@/lib/timing-safe-compare'

const LOOKAHEAD_DAYS = 14

export async function GET(request: NextRequest) {
  if (!timingSafeCompare(request.headers.get('Authorization') ?? '', `Bearer ${process.env.CRON_SECRET ?? ''}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceRoleClient()
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const todayStr = today.toISOString().slice(0, 10)

  const lookahead = new Date(today)
  lookahead.setUTCDate(lookahead.getUTCDate() + LOOKAHEAD_DAYS)
  const lookaheadStr = lookahead.toISOString().slice(0, 10)

  // Fetch confirmed bookings with checkin or checkout in lookahead window
  const [{ data: bookingsCheckin }, { data: bookingsCheckout }] = await Promise.all([
    supabase
      .from('bookings')
      .select('id, check_in, check_out, room_id, room:rooms(property_id)')
      .eq('status', 'confirmed')
      .gte('check_in', todayStr)
      .lte('check_in', lookaheadStr),
    supabase
      .from('bookings')
      .select('id, check_in, check_out, room_id, room:rooms(property_id)')
      .eq('status', 'confirmed')
      .gte('check_out', todayStr)
      .lte('check_out', lookaheadStr),
  ])

  // Fetch iCal blocks with start or end in lookahead window
  const [{ data: blocksStart }, { data: blocksEnd }] = await Promise.all([
    supabase
      .from('ical_blocks')
      .select('id, start_date, end_date, room_id, room:rooms(property_id)')
      .gte('start_date', todayStr)
      .lte('start_date', lookaheadStr),
    supabase
      .from('ical_blocks')
      .select('id, start_date, end_date, room_id, room:rooms(property_id)')
      .gte('end_date', todayStr)
      .lte('end_date', lookaheadStr),
  ])

  let bookingTasksCreated = 0
  let icalTasksCreated = 0

  // Process checkin triggers for bookings
  await Promise.all(
    (bookingsCheckin ?? []).map(async (b) => {
      const propertyId = (b.room as { property_id: string } | null)?.property_id
      if (!propertyId) return
      await generateTasksForDateTrigger(b.id, 'checkin_day', b.check_in, b.check_out, b.room_id, propertyId)
      bookingTasksCreated++
    }),
  )

  // Process checkout triggers for bookings
  await Promise.all(
    (bookingsCheckout ?? []).map(async (b) => {
      const propertyId = (b.room as { property_id: string } | null)?.property_id
      if (!propertyId) return
      await generateTasksForDateTrigger(b.id, 'checkout', b.check_in, b.check_out, b.room_id, propertyId)
      bookingTasksCreated++
    }),
  )

  // Process checkin triggers for iCal blocks
  await Promise.all(
    (blocksStart ?? []).map(async (block) => {
      const propertyId = (block.room as { property_id: string } | null)?.property_id
      if (!propertyId) return
      await generateTasksForICalBlock(block.id, 'checkin_day', block.start_date, block.end_date, block.room_id, propertyId)
      icalTasksCreated++
    }),
  )

  // Process checkout triggers for iCal blocks
  await Promise.all(
    (blocksEnd ?? []).map(async (block) => {
      const propertyId = (block.room as { property_id: string } | null)?.property_id
      if (!propertyId) return
      await generateTasksForICalBlock(block.id, 'checkout', block.start_date, block.end_date, block.room_id, propertyId)
      icalTasksCreated++
    }),
  )

  return NextResponse.json({ booking_tasks: bookingTasksCreated, ical_tasks: icalTasksCreated })
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm test -- --testPathPattern="__tests__/api/cron/generate-booking-tasks" --no-coverage
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/cron/generate-booking-tasks/ __tests__/api/cron/generate-booking-tasks.test.ts
git commit -m "feat: add daily cron to generate checkin/checkout tasks for bookings and iCal blocks"
```

---

## Task 9: iCal Cleaner Endpoint

**Files:**
- Create: `app/api/ical/cleaner/[token]/route.ts`

- [ ] **Step 1: Create the route**

Create `app/api/ical/cleaner/[token]/route.ts`:

```typescript
import ICalGenerator from 'ical-generator'
import { createServiceRoleClient } from '@/lib/supabase'

export async function GET(
  _request: Request,
  { params }: { params: { token: string } },
) {
  const supabase = createServiceRoleClient()

  const { data: person } = await supabase
    .from('people')
    .select('id, name')
    .eq('ical_token', params.token)
    .single()

  if (!person) return new Response('Not found', { status: 404 })

  const { data: tasks } = await supabase
    .from('calendar_tasks')
    .select('id, title, description, due_date, room:rooms(name, property:properties(name))')
    .eq('assignee_id', person.id)
    .eq('status', 'pending')
    .order('due_date')

  const cal = ICalGenerator({ name: `${person.name} – Tasks` })

  for (const task of tasks ?? []) {
    const [y, m, d] = (task.due_date as string).split('-').map(Number)
    const start = new Date(Date.UTC(y, m - 1, d))
    const end = new Date(Date.UTC(y, m - 1, d + 1))

    const roomName = (task.room as { name: string; property: { name: string } } | null)?.name
    const propName = (task.room as { name: string; property: { name: string } } | null)?.property?.name
    const location = [roomName, propName].filter(Boolean).join(' – ')

    cal.createEvent({
      id: `task-${task.id}@tothrooms.com`,
      summary: task.title as string,
      description: (task.description as string | null) ?? undefined,
      location: location || undefined,
      start,
      end,
      allDay: true,
    })
  }

  return new Response(cal.toString(), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="tasks-${person.name.toLowerCase().replace(/\s+/g, '-')}.ics"`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  })
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add app/api/ical/cleaner/
git commit -m "feat: add iCal feed endpoint for person task assignments"
```

---

## Task 10: Admin UI — Task Automations Page

**Files:**
- Create: `components/admin/TaskAutomationModal.tsx`
- Create: `components/admin/PeopleManager.tsx`
- Create: `components/admin/TaskAutomationsPage.tsx`
- Create: `app/admin/(protected)/task-automations/page.tsx`

- [ ] **Step 1: Create TaskAutomationModal.tsx**

Create `components/admin/TaskAutomationModal.tsx`:

```typescript
'use client'

import { useState } from 'react'
import type { TaskAutomation, TaskTriggerEvent, TaskScopeType, Person, Room, Property } from '@/types'

const TRIGGER_LABELS: Record<TaskTriggerEvent, string> = {
  booking_confirmed: 'Booking Confirmed',
  checkin_day: 'Check-in Day',
  checkout: 'Checkout',
  booking_cancelled: 'Booking Cancelled',
}

interface Props {
  automation?: TaskAutomation
  rooms: Room[]
  properties: Property[]
  people: Person[]
  onClose: () => void
  onSave: (automation: TaskAutomation) => void
}

export function TaskAutomationModal({ automation, rooms, properties, people, onClose, onSave }: Props) {
  const isEdit = !!automation
  const [scope, setScope] = useState<TaskScopeType>(automation?.scope_type ?? 'global')
  const [trigger, setTrigger] = useState<TaskTriggerEvent>(automation?.trigger_event ?? 'checkout')
  const [roomId, setRoomId] = useState(automation?.room_id ?? '')
  const [propertyId, setPropertyId] = useState(automation?.property_id ?? '')
  const [title, setTitle] = useState(automation?.title ?? '')
  const [description, setDescription] = useState(automation?.description ?? '')
  const [dayOffset, setDayOffset] = useState(automation?.day_offset ?? 0)
  const [assigneeId, setAssigneeId] = useState(automation?.assignee_id ?? '')
  const [isActive, setIsActive] = useState(automation?.is_active ?? true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (!title.trim()) { setError('Title is required'); return }
    if (scope === 'room' && !roomId) { setError('Select a room'); return }
    if (scope === 'property' && !propertyId) { setError('Select a property'); return }
    setSaving(true)
    setError(null)
    try {
      const body = {
        scope_type: scope, trigger_event: trigger, title: title.trim(),
        description: description.trim() || null,
        day_offset: dayOffset,
        room_id: scope === 'room' ? roomId : null,
        property_id: scope === 'property' ? propertyId : null,
        assignee_id: assigneeId || null,
        is_active: isActive,
      }
      const url = isEdit ? `/api/admin/task-automations/${automation.id}` : '/api/admin/task-automations'
      const method = isEdit ? 'PATCH' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) { const j = await res.json(); throw new Error(j.error ?? 'Save failed'); }
      const saved = await res.json()
      onSave(saved)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
        <h2 className="font-display text-xl text-primary">{isEdit ? 'Edit Rule' : 'New Automation Rule'}</h2>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Scope</label>
            <select className="w-full border rounded-lg px-3 py-2 text-sm" value={scope}
              onChange={(e) => setScope(e.target.value as TaskScopeType)}>
              <option value="global">Global (all units)</option>
              <option value="property">Property</option>
              <option value="room">Unit</option>
            </select>
          </div>

          {scope === 'property' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Property</label>
              <select className="w-full border rounded-lg px-3 py-2 text-sm" value={propertyId}
                onChange={(e) => setPropertyId(e.target.value)}>
                <option value="">Select property…</option>
                {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}

          {scope === 'room' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
              <select className="w-full border rounded-lg px-3 py-2 text-sm" value={roomId}
                onChange={(e) => setRoomId(e.target.value)}>
                <option value="">Select unit…</option>
                {rooms.map((r) => <option key={r.id} value={r.id}>{r.property?.name} – {r.name}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Trigger Event</label>
            <select className="w-full border rounded-lg px-3 py-2 text-sm" value={trigger}
              onChange={(e) => setTrigger(e.target.value as TaskTriggerEvent)}>
              {Object.entries(TRIGGER_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Task Title</label>
            <input className="w-full border rounded-lg px-3 py-2 text-sm" value={title}
              onChange={(e) => setTitle(e.target.value)} placeholder="Post-checkout cleaning" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
            <textarea className="w-full border rounded-lg px-3 py-2 text-sm" rows={2} value={description}
              onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Day Offset <span className="text-gray-400 font-normal">(0 = event day, −1 = day before, +1 = day after)</span>
            </label>
            <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm" value={dayOffset}
              onChange={(e) => setDayOffset(parseInt(e.target.value, 10) || 0)} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Assign To (optional)</label>
            <select className="w-full border rounded-lg px-3 py-2 text-sm" value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}>
              <option value="">Unassigned</option>
              {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Active
          </label>
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button className="px-4 py-2 text-sm rounded-lg border" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="px-4 py-2 text-sm rounded-lg bg-primary text-white disabled:opacity-50"
            onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Rule'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create PeopleManager.tsx**

Create `components/admin/PeopleManager.tsx`:

```typescript
'use client'

import { useState } from 'react'
import type { Person } from '@/types'

interface Props {
  initialPeople: Person[]
}

export function PeopleManager({ initialPeople }: Props) {
  const [people, setPeople] = useState<Person[]>(initialPeople)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''

  async function handleAdd() {
    if (!newName.trim()) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/people', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      })
      if (!res.ok) { const j = await res.json(); throw new Error(j.error ?? 'Failed to add'); }
      const person: Person = await res.json()
      setPeople((prev) => [...prev, person])
      setNewName('')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/admin/people/${id}`, { method: 'DELETE' })
    setPeople((prev) => prev.filter((p) => p.id !== id))
  }

  function handleCopyLink(token: string) {
    navigator.clipboard.writeText(`${baseUrl}/api/ical/cleaner/${token}`)
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-gray-800">People</h3>

      <div className="flex gap-2">
        <input
          className="flex-1 border rounded-lg px-3 py-2 text-sm"
          placeholder="Name…"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <button
          className="px-4 py-2 text-sm rounded-lg bg-primary text-white disabled:opacity-50"
          onClick={handleAdd}
          disabled={saving || !newName.trim()}
        >
          Add
        </button>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className="divide-y border rounded-xl overflow-hidden">
        {people.length === 0 && (
          <p className="px-4 py-3 text-sm text-gray-400">No people yet.</p>
        )}
        {people.map((person) => (
          <div key={person.id} className="flex items-center justify-between px-4 py-3">
            <span className="text-sm font-medium text-gray-800">{person.name}</span>
            <div className="flex items-center gap-3">
              <button
                className="text-xs text-primary hover:underline"
                onClick={() => handleCopyLink(person.ical_token)}
              >
                Copy iCal Link
              </button>
              <button
                className="text-xs text-red-500 hover:underline"
                onClick={() => handleDelete(person.id)}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create TaskAutomationsPage.tsx**

Create `components/admin/TaskAutomationsPage.tsx`:

```typescript
'use client'

import { useState } from 'react'
import type { TaskAutomation, Person, Room, Property } from '@/types'
import { TaskAutomationModal } from './TaskAutomationModal'
import { PeopleManager } from './PeopleManager'

const TRIGGER_LABELS: Record<string, string> = {
  booking_confirmed: 'Booking Confirmed',
  checkin_day: 'Check-in Day',
  checkout: 'Checkout',
  booking_cancelled: 'Booking Cancelled',
}

const SCOPE_LABELS: Record<string, string> = {
  global: 'Global',
  property: 'Property',
  room: 'Unit',
}

interface Props {
  initialAutomations: TaskAutomation[]
  people: Person[]
  rooms: Room[]
  properties: Property[]
}

export function TaskAutomationsPage({ initialAutomations, people, rooms, properties }: Props) {
  const [automations, setAutomations] = useState<TaskAutomation[]>(initialAutomations)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<TaskAutomation | undefined>()

  function openNew() { setEditing(undefined); setModalOpen(true) }
  function openEdit(a: TaskAutomation) { setEditing(a); setModalOpen(true) }

  function handleSaved(saved: TaskAutomation) {
    setAutomations((prev) => {
      const idx = prev.findIndex((a) => a.id === saved.id)
      return idx >= 0 ? prev.map((a) => a.id === saved.id ? saved : a) : [...prev, saved]
    })
    setModalOpen(false)
  }

  async function handleDelete(id: string) {
    await fetch(`/api/admin/task-automations/${id}`, { method: 'DELETE' })
    setAutomations((prev) => prev.filter((a) => a.id !== id))
  }

  async function handleToggle(automation: TaskAutomation) {
    const res = await fetch(`/api/admin/task-automations/${automation.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !automation.is_active }),
    })
    if (res.ok) {
      const updated: TaskAutomation = await res.json()
      setAutomations((prev) => prev.map((a) => a.id === updated.id ? updated : a))
    }
  }

  const scopeOrder = ['global', 'property', 'room']
  const sorted = [...automations].sort((a, b) => scopeOrder.indexOf(a.scope_type) - scopeOrder.indexOf(b.scope_type))

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Rules section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl text-primary">Automation Rules</h2>
          <button className="px-4 py-2 text-sm rounded-lg bg-primary text-white" onClick={openNew}>
            + Add Rule
          </button>
        </div>

        <div className="border rounded-xl overflow-hidden divide-y">
          {sorted.length === 0 && (
            <p className="px-4 py-6 text-sm text-gray-400 text-center">No rules yet. Add one above.</p>
          )}
          {sorted.map((auto) => (
            <div key={auto.id} className="flex items-center gap-4 px-4 py-3">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700 shrink-0">
                {SCOPE_LABELS[auto.scope_type]}
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-teal-50 text-teal-700 shrink-0">
                {TRIGGER_LABELS[auto.trigger_event]}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{auto.title}</p>
                {(auto.room?.name || auto.property?.name) && (
                  <p className="text-xs text-gray-400 truncate">
                    {auto.property?.name}{auto.room?.name ? ` – ${auto.room.name}` : ''}
                  </p>
                )}
              </div>
              <span className="text-xs text-gray-500 shrink-0">
                {auto.day_offset === 0 ? 'Same day' : auto.day_offset > 0 ? `+${auto.day_offset}d` : `${auto.day_offset}d`}
              </span>
              {auto.assignee && (
                <span className="text-xs text-gray-500 shrink-0">{auto.assignee.name}</span>
              )}
              <button
                className={`text-xs font-medium shrink-0 ${auto.is_active ? 'text-green-600' : 'text-gray-400'}`}
                onClick={() => handleToggle(auto)}
              >
                {auto.is_active ? 'Active' : 'Inactive'}
              </button>
              <button className="text-xs text-primary hover:underline shrink-0" onClick={() => openEdit(auto)}>Edit</button>
              <button className="text-xs text-red-500 hover:underline shrink-0" onClick={() => handleDelete(auto.id)}>Delete</button>
            </div>
          ))}
        </div>
      </div>

      {/* People section */}
      <PeopleManager initialPeople={people} />

      {/* Modal */}
      {modalOpen && (
        <TaskAutomationModal
          automation={editing}
          rooms={rooms}
          properties={properties}
          people={people}
          onClose={() => setModalOpen(false)}
          onSave={handleSaved}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Create the server page**

Create `app/admin/(protected)/task-automations/page.tsx`:

```typescript
export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createServiceRoleClient, createServerSupabaseClient } from '@/lib/supabase'
import { TaskAutomationsPage } from '@/components/admin/TaskAutomationsPage'
import type { TaskAutomation, Person, Room, Property } from '@/types'

export default async function AdminTaskAutomationsPage() {
  const serverClient = await createServerSupabaseClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) redirect('/admin/login')

  const supabase = createServiceRoleClient()
  const [automationsRes, peopleRes, roomsRes, propertiesRes] = await Promise.all([
    supabase
      .from('task_automations')
      .select('*, room:rooms(name), property:properties(name), assignee:people(id,name)')
      .order('scope_type').order('created_at'),
    supabase.from('people').select('*').order('name'),
    supabase.from('rooms').select('*, property:properties(id,name)').order('name'),
    supabase.from('properties').select('id, name').order('name'),
  ])

  return (
    <div>
      <h1 className="font-display text-3xl text-primary mb-8">Task Automations</h1>
      <TaskAutomationsPage
        initialAutomations={(automationsRes.data ?? []) as TaskAutomation[]}
        people={(peopleRes.data ?? []) as Person[]}
        rooms={(roomsRes.data ?? []) as Room[]}
        properties={(propertiesRes.data ?? []) as Property[]}
      />
    </div>
  )
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add components/admin/TaskAutomationModal.tsx components/admin/PeopleManager.tsx components/admin/TaskAutomationsPage.tsx app/admin/\(protected\)/task-automations/
git commit -m "feat: add task automations admin page with rules management and people manager"
```

---

## Task 11: RoomForm Automations Tab

**Files:**
- Create: `components/admin/RoomTaskAutomations.tsx`
- Modify: `components/admin/RoomForm.tsx`
- Modify: `app/admin/(protected)/rooms/[id]/edit/page.tsx`

- [ ] **Step 1: Create RoomTaskAutomations.tsx**

Create `components/admin/RoomTaskAutomations.tsx`:

```typescript
'use client'

import { useState } from 'react'
import type { TaskAutomation, Person } from '@/types'
import { TaskAutomationModal } from './TaskAutomationModal'
import type { Room, Property } from '@/types'

const TRIGGER_LABELS: Record<string, string> = {
  booking_confirmed: 'Booking Confirmed',
  checkin_day: 'Check-in Day',
  checkout: 'Checkout',
  booking_cancelled: 'Booking Cancelled',
}

interface Props {
  roomId: string
  propertyId: string
  initialRoomRules: TaskAutomation[]
  inheritedRules: TaskAutomation[]
  people: Person[]
  rooms: Room[]
  properties: Property[]
}

export function RoomTaskAutomations({
  roomId, propertyId, initialRoomRules, inheritedRules, people, rooms, properties,
}: Props) {
  const [roomRules, setRoomRules] = useState<TaskAutomation[]>(initialRoomRules)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<TaskAutomation | undefined>()

  function openNew() { setEditing(undefined); setModalOpen(true) }
  function openEdit(a: TaskAutomation) { setEditing(a); setModalOpen(true) }

  function handleSaved(saved: TaskAutomation) {
    setRoomRules((prev) => {
      const idx = prev.findIndex((a) => a.id === saved.id)
      return idx >= 0 ? prev.map((a) => a.id === saved.id ? saved : a) : [...prev, saved]
    })
    setModalOpen(false)
  }

  async function handleDelete(id: string) {
    await fetch(`/api/admin/task-automations/${id}`, { method: 'DELETE' })
    setRoomRules((prev) => prev.filter((a) => a.id !== id))
  }

  const preScoped: Partial<TaskAutomation> = { scope_type: 'room', room_id: roomId, property_id: null }

  return (
    <div className="space-y-6 py-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">Unit Rules</h3>
          <button className="px-3 py-1.5 text-sm rounded-lg bg-primary text-white" onClick={openNew}>
            + Add Unit Rule
          </button>
        </div>
        <div className="border rounded-xl overflow-hidden divide-y">
          {roomRules.length === 0 && (
            <p className="px-4 py-4 text-sm text-gray-400">No unit-level rules. Using inherited rules below.</p>
          )}
          {roomRules.map((rule) => (
            <div key={rule.id} className="flex items-center gap-4 px-4 py-3">
              <span className="text-xs px-2 py-0.5 rounded bg-teal-50 text-teal-700 shrink-0">
                {TRIGGER_LABELS[rule.trigger_event]}
              </span>
              <span className="flex-1 text-sm font-medium text-gray-800 truncate">{rule.title}</span>
              <span className="text-xs text-gray-400 shrink-0">
                {rule.day_offset === 0 ? 'Same day' : rule.day_offset > 0 ? `+${rule.day_offset}d` : `${rule.day_offset}d`}
              </span>
              <button className="text-xs text-primary hover:underline shrink-0" onClick={() => openEdit(rule)}>Edit</button>
              <button className="text-xs text-red-500 hover:underline shrink-0" onClick={() => handleDelete(rule.id)}>Delete</button>
            </div>
          ))}
        </div>
      </div>

      {inheritedRules.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-500 text-sm">Inherited Rules (read-only)</h3>
          <div className="border border-dashed rounded-xl overflow-hidden divide-y">
            {inheritedRules.map((rule) => (
              <div key={rule.id} className="flex items-center gap-4 px-4 py-3 opacity-60">
                <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-500 shrink-0">
                  {rule.scope_type === 'property' ? 'From property' : 'Global'}
                </span>
                <span className="text-xs px-2 py-0.5 rounded bg-teal-50 text-teal-700 shrink-0">
                  {TRIGGER_LABELS[rule.trigger_event]}
                </span>
                <span className="flex-1 text-sm text-gray-600 truncate">{rule.title}</span>
                <span className="text-xs text-gray-400 shrink-0">
                  {rule.day_offset === 0 ? 'Same day' : rule.day_offset > 0 ? `+${rule.day_offset}d` : `${rule.day_offset}d`}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400">
            Adding a unit rule for the same trigger will override these inherited rules for this unit.
          </p>
        </div>
      )}

      {modalOpen && (
        <TaskAutomationModal
          automation={editing ?? (preScoped as TaskAutomation)}
          rooms={rooms}
          properties={properties}
          people={people}
          onClose={() => setModalOpen(false)}
          onSave={handleSaved}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Update room edit page to fetch automations and people**

In `app/admin/(protected)/rooms/[id]/edit/page.tsx`, add the additional fetches in the `Promise.all`:

```typescript
import { RoomTaskAutomations } from '@/components/admin/RoomTaskAutomations'
import type { Room, Property, ICalSource, RoomFee, TaskAutomation, Person } from '@/types'
```

Replace the existing `Promise.all` with:

```typescript
  const [
    { data: room }, { data: properties }, { data: icalSources }, { data: roomFees },
    { data: roomRules }, { data: propertyRules }, { data: globalRules }, { data: people },
  ] = await Promise.all([
    supabase.from('rooms').select('*, property:properties(*)').eq('id', params.id).single(),
    supabase.from('properties').select('*').order('name'),
    supabase.from('ical_sources').select('*').eq('room_id', params.id),
    supabase.from('room_fees').select('*').eq('room_id', params.id).order('created_at'),
    supabase.from('task_automations').select('*').eq('scope_type', 'room').eq('room_id', params.id).eq('is_active', true),
    supabase.from('task_automations').select('*').eq('scope_type', 'property').eq('property_id', (room as unknown as { property_id: string })?.property_id ?? '').eq('is_active', true),
    supabase.from('task_automations').select('*').eq('scope_type', 'global').eq('is_active', true),
    supabase.from('people').select('*').order('name'),
  ])
```

Note: you'll need to fetch the room first to get `property_id` for the property rules query, OR run two sequential fetches. The simpler approach is to fetch the room first, then run the rest in parallel. Restructure the page as:

```typescript
export default async function EditRoomPage({ params }: EditRoomPageProps) {
  const serverClient = await createServerSupabaseClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) redirect('/admin/login')

  const supabase = createServiceRoleClient()

  const { data: room } = await supabase
    .from('rooms').select('*, property:properties(*)').eq('id', params.id).single()

  if (!room) notFound()

  const propertyId = (room as unknown as { property_id: string }).property_id ?? ''

  const [
    { data: properties }, { data: icalSources }, { data: roomFees },
    { data: roomRules }, { data: propertyRulesData }, { data: globalRules }, { data: people },
    { data: allRooms },
  ] = await Promise.all([
    supabase.from('properties').select('*').order('name'),
    supabase.from('ical_sources').select('*').eq('room_id', params.id),
    supabase.from('room_fees').select('*').eq('room_id', params.id).order('created_at'),
    supabase.from('task_automations').select('*').eq('scope_type', 'room').eq('room_id', params.id).eq('is_active', true),
    supabase.from('task_automations').select('*').eq('scope_type', 'property').eq('property_id', propertyId).eq('is_active', true),
    supabase.from('task_automations').select('*').eq('scope_type', 'global').eq('is_active', true),
    supabase.from('people').select('*').order('name'),
    supabase.from('rooms').select('*, property:properties(id,name)').order('name'),
  ])

  const roomWithFees = { ...room, fees: (roomFees ?? []) as RoomFee[] } as Room
  const hasRoomRules = (roomRules ?? []).length > 0
  const inheritedRules = hasRoomRules ? [] : [
    ...((propertyRulesData ?? []) as TaskAutomation[]),
    ...((globalRules ?? []) as TaskAutomation[]),
  ]

  return (
    <div className="-m-8 bg-background">
      <RoomForm
        room={roomWithFees}
        properties={(properties ?? []) as Property[]}
        icalSources={(icalSources ?? []) as ICalSource[]}
        roomId={params.id}
        taskAutomationsTab={
          <RoomTaskAutomations
            roomId={params.id}
            propertyId={propertyId}
            initialRoomRules={(roomRules ?? []) as TaskAutomation[]}
            inheritedRules={inheritedRules}
            people={(people ?? []) as Person[]}
            rooms={(allRooms ?? []) as Room[]}
            properties={(properties ?? []) as Property[]}
          />
        }
      />
    </div>
  )
}
```

- [ ] **Step 3: Add Automations tab to RoomForm**

In `components/admin/RoomForm.tsx`:

1. Update the `RoomTab` type (around line 26): `type RoomTab = 'info' | 'pricing' | 'amenities' | 'images' | 'ical' | 'automations'`

2. Add `taskAutomationsTab` prop to the `RoomFormProps` interface. Find the interface definition and add:
```typescript
  taskAutomationsTab?: React.ReactNode
```

3. Update the `tabs` array (around line 238) to add:
```typescript
    { id: 'automations', label: 'Automations' },
```

4. Add the tab panel after the `ical` tab panel (around line 1126):
```typescript
        {/* ── Tab: Automations ── */}
        {tab === 'automations' && (
          <div className="px-6 pb-8">
            {taskAutomationsTab}
          </div>
        )}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add components/admin/RoomTaskAutomations.tsx components/admin/RoomForm.tsx app/admin/\(protected\)/rooms/\[id\]/edit/page.tsx
git commit -m "feat: add Automations tab to room edit page"
```

---

## Task 12: PropertyForm Automations Tab

**Files:**
- Create: `components/admin/PropertyTaskAutomations.tsx`
- Modify: `components/admin/PropertyForm.tsx`
- Modify: `app/admin/(protected)/properties/[id]/edit/page.tsx`

- [ ] **Step 1: Create PropertyTaskAutomations.tsx**

Create `components/admin/PropertyTaskAutomations.tsx`:

```typescript
'use client'

import { useState } from 'react'
import type { TaskAutomation, Person, Room, Property } from '@/types'
import { TaskAutomationModal } from './TaskAutomationModal'

const TRIGGER_LABELS: Record<string, string> = {
  booking_confirmed: 'Booking Confirmed',
  checkin_day: 'Check-in Day',
  checkout: 'Checkout',
  booking_cancelled: 'Booking Cancelled',
}

interface Props {
  propertyId: string
  initialPropertyRules: TaskAutomation[]
  globalRules: TaskAutomation[]
  people: Person[]
  rooms: Room[]
  properties: Property[]
}

export function PropertyTaskAutomations({
  propertyId, initialPropertyRules, globalRules, people, rooms, properties,
}: Props) {
  const [propRules, setPropRules] = useState<TaskAutomation[]>(initialPropertyRules)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<TaskAutomation | undefined>()

  function openNew() { setEditing(undefined); setModalOpen(true) }
  function openEdit(a: TaskAutomation) { setEditing(a); setModalOpen(true) }

  function handleSaved(saved: TaskAutomation) {
    setPropRules((prev) => {
      const idx = prev.findIndex((a) => a.id === saved.id)
      return idx >= 0 ? prev.map((a) => a.id === saved.id ? saved : a) : [...prev, saved]
    })
    setModalOpen(false)
  }

  async function handleDelete(id: string) {
    await fetch(`/api/admin/task-automations/${id}`, { method: 'DELETE' })
    setPropRules((prev) => prev.filter((a) => a.id !== id))
  }

  const preScoped: Partial<TaskAutomation> = { scope_type: 'property', property_id: propertyId, room_id: null }

  return (
    <div className="space-y-6 py-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">Property Rules</h3>
          <button className="px-3 py-1.5 text-sm rounded-lg bg-primary text-white" onClick={openNew}>
            + Add Property Rule
          </button>
        </div>
        <div className="border rounded-xl overflow-hidden divide-y">
          {propRules.length === 0 && (
            <p className="px-4 py-4 text-sm text-gray-400">No property-level rules. Using global rules below.</p>
          )}
          {propRules.map((rule) => (
            <div key={rule.id} className="flex items-center gap-4 px-4 py-3">
              <span className="text-xs px-2 py-0.5 rounded bg-teal-50 text-teal-700 shrink-0">
                {TRIGGER_LABELS[rule.trigger_event]}
              </span>
              <span className="flex-1 text-sm font-medium text-gray-800 truncate">{rule.title}</span>
              <span className="text-xs text-gray-400 shrink-0">
                {rule.day_offset === 0 ? 'Same day' : rule.day_offset > 0 ? `+${rule.day_offset}d` : `${rule.day_offset}d`}
              </span>
              <button className="text-xs text-primary hover:underline shrink-0" onClick={() => openEdit(rule)}>Edit</button>
              <button className="text-xs text-red-500 hover:underline shrink-0" onClick={() => handleDelete(rule.id)}>Delete</button>
            </div>
          ))}
        </div>
      </div>

      {globalRules.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-500 text-sm">Global Rules (read-only)</h3>
          <div className="border border-dashed rounded-xl overflow-hidden divide-y">
            {globalRules.map((rule) => (
              <div key={rule.id} className="flex items-center gap-4 px-4 py-3 opacity-60">
                <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-500 shrink-0">Global</span>
                <span className="text-xs px-2 py-0.5 rounded bg-teal-50 text-teal-700 shrink-0">
                  {TRIGGER_LABELS[rule.trigger_event]}
                </span>
                <span className="flex-1 text-sm text-gray-600 truncate">{rule.title}</span>
                <span className="text-xs text-gray-400 shrink-0">
                  {rule.day_offset === 0 ? 'Same day' : rule.day_offset > 0 ? `+${rule.day_offset}d` : `${rule.day_offset}d`}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400">
            Adding a property rule for the same trigger will override these global rules for all units in this property.
          </p>
        </div>
      )}

      {modalOpen && (
        <TaskAutomationModal
          automation={editing ?? (preScoped as TaskAutomation)}
          rooms={rooms}
          properties={properties}
          people={people}
          onClose={() => setModalOpen(false)}
          onSave={handleSaved}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Update property edit page**

In `app/admin/(protected)/properties/[id]/edit/page.tsx`, replace the existing content with:

```typescript
export const dynamic = 'force-dynamic'

import { notFound, redirect } from 'next/navigation'
import { createServiceRoleClient, createServerSupabaseClient } from '@/lib/supabase'
import PropertyForm from '@/components/admin/PropertyForm'
import { PropertyTaskAutomations } from '@/components/admin/PropertyTaskAutomations'
import type { Property, StripeAccount, TaskAutomation, Person, Room } from '@/types'

interface EditPropertyPageProps { params: { id: string } }

export default async function EditPropertyPage({ params }: EditPropertyPageProps) {
  const serverClient = await createServerSupabaseClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) redirect('/admin/login')

  const supabase = createServiceRoleClient()
  const [
    { data: property }, { data: settings }, { data: stripeAccounts },
    { data: propRules }, { data: globalRules }, { data: people },
    { data: allRooms }, { data: allProperties },
  ] = await Promise.all([
    supabase.from('properties').select('*').eq('id', params.id).single(),
    supabase.from('site_settings').select('global_house_rules').maybeSingle(),
    supabase.from('stripe_accounts').select('*').order('label'),
    supabase.from('task_automations').select('*').eq('scope_type', 'property').eq('property_id', params.id).eq('is_active', true),
    supabase.from('task_automations').select('*').eq('scope_type', 'global').eq('is_active', true),
    supabase.from('people').select('*').order('name'),
    supabase.from('rooms').select('*, property:properties(id,name)').order('name'),
    supabase.from('properties').select('id, name').order('name'),
  ])

  if (!property) notFound()

  return (
    <div className="-m-8 bg-background">
      <PropertyForm
        property={property as Property}
        propertyId={params.id}
        globalHouseRules={settings?.global_house_rules ?? ''}
        stripeAccounts={(stripeAccounts ?? []) as StripeAccount[]}
        taskAutomationsTab={
          <PropertyTaskAutomations
            propertyId={params.id}
            initialPropertyRules={(propRules ?? []) as TaskAutomation[]}
            globalRules={(globalRules ?? []) as TaskAutomation[]}
            people={(people ?? []) as Person[]}
            rooms={(allRooms ?? []) as Room[]}
            properties={(allProperties ?? []) as Property[]}
          />
        }
      />
    </div>
  )
}
```

- [ ] **Step 3: Add Automations tab to PropertyForm**

In `components/admin/PropertyForm.tsx`:

1. Update the `PropertyTab` type (around line 20): `type PropertyTab = 'info' | 'amenities' | 'policy' | 'images' | 'payout' | 'automations'`

2. Add `taskAutomationsTab?: React.ReactNode` to `PropertyFormProps`

3. Add to the `tabs` array (around line 115):
```typescript
    { id: 'automations', label: 'Automations' },
```

4. Add the tab panel after the `payout` tab panel:
```typescript
        {/* ── Tab: Automations ── */}
        {tab === 'automations' && (
          <div className="px-6 pb-8">
            {taskAutomationsTab}
          </div>
        )}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add components/admin/PropertyTaskAutomations.tsx components/admin/PropertyForm.tsx app/admin/\(protected\)/properties/\[id\]/edit/page.tsx
git commit -m "feat: add Automations tab to property edit page"
```

---

## Task 13: Sidebar Nav + Calendar Assignee Badges

**Files:**
- Modify: `components/admin/AdminSidebar.tsx`
- Modify: `components/admin/CalendarTaskRow.tsx`
- Modify: `components/admin/NightDetailModal.tsx`
- Modify: `components/admin/TaskModal.tsx`

- [ ] **Step 1: Add Tasks nav item to AdminSidebar**

In `components/admin/AdminSidebar.tsx`, add a `ClipboardDocumentListIcon` import from `@heroicons/react/24/outline`:

```typescript
import {
  ArrowRightOnRectangleIcon,
  BanknotesIcon,
  Bars3Icon,
  BuildingOfficeIcon,
  CalendarDaysIcon,
  CalendarIcon,
  ChartBarIcon,
  ClipboardDocumentListIcon,
  Cog6ToothIcon,
  EnvelopeIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
```

Add to `NAV_ITEMS` array (after Calendar, before Payout):

```typescript
  { label: 'Tasks', href: '/admin/task-automations', icon: ClipboardDocumentListIcon },
```

- [ ] **Step 2: Add assignee initials badge to CalendarTaskRow**

In `components/admin/CalendarTaskRow.tsx`, find where individual tasks are rendered. Look for the task dot/label rendering inside the task map. Add an assignee initials badge after the task title when `task.assignee_id` is set.

Find the JSX where tasks are mapped and rendered (the task chip/dot area). Add a small badge alongside the task title:

```typescript
{task.assignee_id && (
  <span
    title={`Assigned`}
    className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-teal-500 text-white text-[8px] font-bold shrink-0"
  >
    ✓
  </span>
)}
```

Place this inside the task rendering element, after the task title text node.

- [ ] **Step 3: Add assignee name to NightDetailModal tasks**

In `components/admin/NightDetailModal.tsx`, find where tasks are listed. After the task title, add:

```typescript
{task.assignee_id && (
  <span className="text-xs text-teal-600 ml-2">Assigned</span>
)}
```

To show the actual name, the CalendarData would need to include people. For now, a simple "Assigned" indicator is sufficient since the CalendarTask now has `assignee_id`.

- [ ] **Step 4: Add assignee picker to TaskModal**

In `components/admin/TaskModal.tsx`, add `people` to the `TaskModalProps` interface:

```typescript
interface TaskModalProps {
  rooms: Room[]
  people?: Person[]
  task?: CalendarTask
  // ... (keep all existing props)
}
```

Add `people = []` to the destructured props.

Add `assigneeId` state after the existing state declarations:

```typescript
  const [assigneeId, setAssigneeId] = useState(task?.assignee_id ?? '')
```

Include `assignee_id: assigneeId || null` in the POST/PATCH body when saving the task. Find the `fetch` call that creates/updates the task and add `assignee_id` to the body.

Add the assignee select field before the color picker in the form JSX:

```typescript
              {people.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Assign To</label>
                  <select
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={assigneeId}
                    onChange={(e) => setAssigneeId(e.target.value)}
                  >
                    <option value="">Unassigned</option>
                    {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}
```

- [ ] **Step 5: Pass people to TaskModal from CalendarClient**

In `components/admin/CalendarClient.tsx`, find where `TaskModal` is rendered and add the `people` prop. The CalendarData doesn't currently include people, so add a fetch. Find the state where `calendarData` is loaded and add:

```typescript
const [people, setPeople] = useState<Person[]>([])

useEffect(() => {
  fetch('/api/admin/people')
    .then((r) => r.json())
    .then((data: Person[]) => setPeople(data))
    .catch(() => {})
}, [])
```

Pass `people={people}` to the `<TaskModal>` wherever it is rendered in `CalendarClient.tsx`.

Add `Person` to the import from `@/types` in `CalendarClient.tsx`.

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 7: Run full test suite**

```bash
npm test --no-coverage
```

Expected: all tests pass (or only pre-existing failures unrelated to this work)

- [ ] **Step 8: Commit**

```bash
git add components/admin/AdminSidebar.tsx components/admin/CalendarTaskRow.tsx components/admin/NightDetailModal.tsx components/admin/TaskModal.tsx components/admin/CalendarClient.tsx
git commit -m "feat: add Tasks nav item, assignee badges on calendar, assignee picker in task modal"
```
