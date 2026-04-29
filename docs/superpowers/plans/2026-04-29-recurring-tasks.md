# Recurring Calendar Tasks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand recurring calendar tasks into per-date occurrences using server-side RRULE expansion, with per-occurrence independence (complete/edit/delete one without affecting others) and a "delete this occurrence vs delete the whole series" confirmation UX.

**Architecture:** A new `task_exceptions` table stores per-occurrence overrides (deletion, status, title, color, description). The existing `GET /api/admin/calendar` endpoint already uses the `rrule` package for expansion — it gains exception fetching and merging. A new `/api/admin/calendar-tasks/[id]/occurrences/[date]` route handles per-occurrence PATCH and DELETE. `TaskModal` gains an `occurrenceDate` prop that switches it into occurrence-edit mode with a split delete UI.

**Tech Stack:** Next.js App Router, Supabase (PostgreSQL), `rrule` npm package (already installed), Jest for unit/integration tests.

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `supabase/migrations/036_task_exceptions.sql` | Create | DB schema: `series_id` on `calendar_tasks`, new `task_exceptions` table |
| `types/index.ts` | Modify | Add `series_id`, `occurrence_date`, `is_recurring` to `CalendarTask`; new `TaskException` interface |
| `app/api/admin/calendar-tasks/route.ts` | Modify | Set `series_id = task.id` on create when `recurrence_rule` is set |
| `app/api/admin/calendar-tasks/[id]/occurrences/[date]/route.ts` | Create | PATCH (upsert exception with field overrides) + DELETE (mark occurrence deleted) |
| `app/api/admin/calendar/route.ts` | Modify | Fetch `task_exceptions`, pass to `expandRecurringTasks`, apply overrides + set `is_recurring`/`occurrence_date` |
| `components/admin/CalendarClient.tsx` | Modify | Thread `occurrence_date` through `ModalState` and `onDelete`; handle occurrence-only vs. full-series delete |
| `components/admin/TaskModal.tsx` | Modify | Add `occurrenceDate` prop; recurring badge; split delete buttons; route saves to occurrence endpoint |
| `__tests__/api/admin/calendar.test.ts` | Modify | Add tests for exception filtering and field overrides in expanded tasks |
| `__tests__/api/admin/calendar-tasks-occurrences.test.ts` | Create | Tests for PATCH and DELETE occurrence endpoints |

---

## Task 1: DB Migration

**Files:**
- Create: `supabase/migrations/036_task_exceptions.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/036_task_exceptions.sql

ALTER TABLE calendar_tasks
  ADD COLUMN IF NOT EXISTS series_id uuid REFERENCES calendar_tasks(id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS task_exceptions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id         uuid NOT NULL REFERENCES calendar_tasks(id) ON DELETE CASCADE,
  occurrence_date date NOT NULL,
  is_deleted      boolean NOT NULL DEFAULT false,
  status          text CHECK (status IN ('pending', 'complete')),
  title           text,
  color           text,
  description     text,
  created_at      timestamptz DEFAULT now(),
  UNIQUE(task_id, occurrence_date)
);
```

- [ ] **Step 2: Apply migration via Supabase MCP**

Use the `mcp__supabase__apply_migration` tool with:
- `name`: `036_task_exceptions`
- `query`: the SQL above

- [ ] **Step 3: Verify tables**

Use `mcp__supabase__execute_sql` with:
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'calendar_tasks' AND column_name = 'series_id';

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'task_exceptions'
ORDER BY ordinal_position;
```

Expected: `series_id` column on `calendar_tasks`, and columns `id, task_id, occurrence_date, is_deleted, status, title, color, description, created_at` on `task_exceptions`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/036_task_exceptions.sql
git commit -m "feat: add task_exceptions table and series_id to calendar_tasks"
```

---

## Task 2: Update Types

**Files:**
- Modify: `types/index.ts`

- [ ] **Step 1: Add fields to `CalendarTask` and new `TaskException` interface**

In `types/index.ts`, find the `CalendarTask` interface (around line 466) and add three fields:

```ts
export interface CalendarTask {
  id: string
  room_id: string | null
  property_id: string | null
  title: string
  description: string | null
  due_date: string        // ISO date "YYYY-MM-DD"
  recurrence_rule: string | null
  recurrence_end_date: string | null
  status: 'pending' | 'complete'
  color: string | null
  series_id: string | null       // ← new: set to own id for recurring tasks
  occurrence_date: string | null // ← new: set on virtual expanded occurrences
  is_recurring: boolean | null   // ← new: true on virtual expanded occurrences
  created_at: string
  updated_at: string
}
```

Add after `CalendarTask`:

```ts
export interface TaskException {
  id: string
  task_id: string
  occurrence_date: string
  is_deleted: boolean
  status: 'pending' | 'complete' | null
  title: string | null
  color: string | null
  description: string | null
  created_at: string
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors related to `CalendarTask` or `TaskException`.

- [ ] **Step 3: Commit**

```bash
git add types/index.ts
git commit -m "feat: add series_id, occurrence_date, is_recurring to CalendarTask; add TaskException type"
```

---

## Task 3: Set series_id on task creation

**Files:**
- Modify: `app/api/admin/calendar-tasks/route.ts`

- [ ] **Step 1: Write the failing test**

In `__tests__/api/admin/calendar-tasks.test.ts`, add a test case (inside the `describe('POST /api/admin/calendar-tasks')` block):

```ts
it('sets series_id equal to task id when recurrence_rule is provided', async () => {
  ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(makeAuthMock())

  const taskId = 'task-recur-1'
  const insertedTask = {
    id: taskId,
    title: 'Weekly clean',
    due_date: '2026-05-01',
    recurrence_rule: 'FREQ=WEEKLY',
    recurrence_end_date: null,
    description: null,
    room_id: null,
    property_id: null,
    status: 'pending',
    color: null,
    series_id: taskId,
    created_at: '2026-05-01T00:00:00Z',
    updated_at: '2026-05-01T00:00:00Z',
  }

  const mockDb = makeDbMock({ insertResult: insertedTask })
  ;(createServiceRoleClient as jest.Mock).mockReturnValue(mockDb)

  const req = new NextRequest('http://localhost/api/admin/calendar-tasks', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Weekly clean',
      due_date: '2026-05-01',
      recurrence_rule: 'FREQ=WEEKLY',
    }),
    headers: { 'Content-Type': 'application/json' },
  })

  const res = await POST(req)
  expect(res.status).toBe(201)
  const body = await res.json()
  expect(body.task.series_id).toBe(taskId)
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- --testPathPattern="calendar-tasks.test.ts" --no-coverage 2>&1 | tail -20
```

Expected: FAIL — either `series_id` is undefined or the mock structure doesn't match yet.

- [ ] **Step 3: Update `app/api/admin/calendar-tasks/route.ts` POST handler**

Find the insert block (starting around line 31) and replace it with:

```ts
const taskId = crypto.randomUUID()

const supabase = createServiceRoleClient()
const { data: task, error } = await supabase
  .from('calendar_tasks')
  .insert({
    id: taskId,
    title,
    due_date,
    description: description ?? null,
    room_id: room_id ?? null,
    property_id: property_id ?? null,
    recurrence_rule: recurrence_rule ?? null,
    recurrence_end_date: recurrence_end_date ?? null,
    status: status ?? 'pending',
    color: color ?? null,
    series_id: recurrence_rule ? taskId : null,
  })
  .select()
  .single()
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npm test -- --testPathPattern="calendar-tasks.test.ts" --no-coverage 2>&1 | tail -20
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/calendar-tasks/route.ts __tests__/api/admin/calendar-tasks.test.ts
git commit -m "feat: set series_id on recurring task creation"
```

---

## Task 4: Per-occurrence PATCH and DELETE endpoints

**Files:**
- Create: `app/api/admin/calendar-tasks/[id]/occurrences/[date]/route.ts`
- Create: `__tests__/api/admin/calendar-tasks-occurrences.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/api/admin/calendar-tasks-occurrences.test.ts`:

```ts
/**
 * @jest-environment node
 */
import { PATCH, DELETE } from '@/app/api/admin/calendar-tasks/[id]/occurrences/[date]/route'
import { NextRequest } from 'next/server'

jest.mock('@/lib/supabase', () => ({
  createServerSupabaseClient: jest.fn(),
  createServiceRoleClient: jest.fn(),
}))

import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase'

const mockUser = { id: 'user-1' }

function makeAuthMock(user = mockUser) {
  return {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user }, error: null }),
    },
  }
}

const baseTask = {
  id: 'task-1',
  title: 'Weekly clean',
  due_date: '2026-05-01',
  recurrence_rule: 'FREQ=WEEKLY',
  recurrence_end_date: null,
  description: null,
  room_id: null,
  property_id: null,
  status: 'pending',
  color: '#6366F1',
  series_id: 'task-1',
  occurrence_date: null,
  is_recurring: null,
  created_at: '2026-05-01T00:00:00Z',
  updated_at: '2026-05-01T00:00:00Z',
}

const exceptionRow = {
  id: 'exc-1',
  task_id: 'task-1',
  occurrence_date: '2026-05-08',
  is_deleted: false,
  status: 'complete',
  title: null,
  color: null,
  description: null,
  created_at: '2026-05-08T00:00:00Z',
}

function makeDbMock() {
  const upsertResult = { data: exceptionRow, error: null }
  const taskResult = { data: baseTask, error: null }
  return {
    from: jest.fn((table: string) => {
      if (table === 'task_exceptions') {
        return {
          upsert: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue(upsertResult),
        }
      }
      if (table === 'calendar_tasks') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue(taskResult),
        }
      }
      return {}
    }),
  }
}

const params = Promise.resolve({ id: 'task-1', date: '2026-05-08' })

describe('PATCH /api/admin/calendar-tasks/[id]/occurrences/[date]', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(
      makeAuthMock(null as unknown as typeof mockUser),
    )
    ;(createServiceRoleClient as jest.Mock).mockReturnValue(makeDbMock())
    const req = new NextRequest(
      'http://localhost/api/admin/calendar-tasks/task-1/occurrences/2026-05-08',
      { method: 'PATCH', body: JSON.stringify({ status: 'complete' }), headers: { 'Content-Type': 'application/json' } },
    )
    const res = await PATCH(req, { params })
    expect(res.status).toBe(401)
  })

  it('upserts the exception and returns the merged task occurrence', async () => {
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(makeAuthMock())
    ;(createServiceRoleClient as jest.Mock).mockReturnValue(makeDbMock())
    const req = new NextRequest(
      'http://localhost/api/admin/calendar-tasks/task-1/occurrences/2026-05-08',
      { method: 'PATCH', body: JSON.stringify({ status: 'complete' }), headers: { 'Content-Type': 'application/json' } },
    )
    const res = await PATCH(req, { params })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.task.due_date).toBe('2026-05-08')
    expect(body.task.status).toBe('complete')
    expect(body.task.is_recurring).toBe(true)
    expect(body.task.occurrence_date).toBe('2026-05-08')
  })
})

describe('DELETE /api/admin/calendar-tasks/[id]/occurrences/[date]', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(
      makeAuthMock(null as unknown as typeof mockUser),
    )
    ;(createServiceRoleClient as jest.Mock).mockReturnValue(makeDbMock())
    const req = new NextRequest(
      'http://localhost/api/admin/calendar-tasks/task-1/occurrences/2026-05-08',
      { method: 'DELETE' },
    )
    const res = await DELETE(req, { params })
    expect(res.status).toBe(401)
  })

  it('marks the occurrence as deleted and returns 204', async () => {
    const deletedExcRow = { ...exceptionRow, is_deleted: true }
    const dbMock = {
      from: jest.fn(() => ({
        upsert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: deletedExcRow, error: null }),
      })),
    }
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(makeAuthMock())
    ;(createServiceRoleClient as jest.Mock).mockReturnValue(dbMock)
    const req = new NextRequest(
      'http://localhost/api/admin/calendar-tasks/task-1/occurrences/2026-05-08',
      { method: 'DELETE' },
    )
    const res = await DELETE(req, { params })
    expect(res.status).toBe(204)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- --testPathPattern="calendar-tasks-occurrences.test.ts" --no-coverage 2>&1 | tail -20
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create the route file**

Create `app/api/admin/calendar-tasks/[id]/occurrences/[date]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase'
import type { CalendarTask } from '@/types'

type Params = { params: Promise<{ id: string; date: string }> }

export async function PATCH(request: NextRequest, { params }: Params) {
  const serverClient = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await serverClient.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id, date } = await params

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const supabase = createServiceRoleClient()

  const upsertData: Record<string, unknown> = {
    task_id: id,
    occurrence_date: date,
    is_deleted: false,
  }
  if ('status' in body) upsertData.status = body.status
  if ('title' in body) upsertData.title = body.title
  if ('color' in body) upsertData.color = body.color
  if ('description' in body) upsertData.description = body.description

  const { data: exception, error: excError } = await supabase
    .from('task_exceptions')
    .upsert(upsertData, { onConflict: 'task_id,occurrence_date' })
    .select()
    .single()

  if (excError) {
    return NextResponse.json({ error: excError.message }, { status: 500 })
  }

  const { data: baseTask, error: taskError } = await supabase
    .from('calendar_tasks')
    .select('*')
    .eq('id', id)
    .single()

  if (taskError) {
    return NextResponse.json({ error: taskError.message }, { status: 500 })
  }

  const task: CalendarTask = {
    ...baseTask,
    due_date: date,
    occurrence_date: date,
    is_recurring: true,
    status: (exception.status ?? baseTask.status) as 'pending' | 'complete',
    title: exception.title ?? baseTask.title,
    color: exception.color ?? baseTask.color,
    description: exception.description ?? baseTask.description,
  }

  return NextResponse.json({ task })
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const serverClient = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await serverClient.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id, date } = await params

  const supabase = createServiceRoleClient()

  const { error } = await supabase
    .from('task_exceptions')
    .upsert(
      { task_id: id, occurrence_date: date, is_deleted: true },
      { onConflict: 'task_id,occurrence_date' },
    )
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return new NextResponse(null, { status: 204 })
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- --testPathPattern="calendar-tasks-occurrences.test.ts" --no-coverage 2>&1 | tail -20
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/calendar-tasks/[id]/occurrences/ __tests__/api/admin/calendar-tasks-occurrences.test.ts
git commit -m "feat: add per-occurrence PATCH and DELETE endpoints for recurring tasks"
```

---

## Task 5: Apply exceptions in calendar expansion

**Files:**
- Modify: `app/api/admin/calendar/route.ts`
- Modify: `__tests__/api/admin/calendar.test.ts`

- [ ] **Step 1: Write the failing tests**

In `__tests__/api/admin/calendar.test.ts`, add these two test cases inside the `describe` block:

```ts
it('filters out deleted occurrences when exceptions mark them as deleted', async () => {
  ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(makeAuthMock())

  const recurringTask = {
    id: 'task-r1',
    title: 'Weekly clean',
    due_date: '2026-05-01',
    recurrence_rule: 'FREQ=WEEKLY',
    recurrence_end_date: null,
    series_id: 'task-r1',
    room_id: null,
    property_id: null,
    status: 'pending',
    color: null,
    description: null,
    occurrence_date: null,
    is_recurring: null,
    created_at: '2026-05-01T00:00:00Z',
    updated_at: '2026-05-01T00:00:00Z',
  }
  const deletedException = {
    id: 'exc-1',
    task_id: 'task-r1',
    occurrence_date: '2026-05-08',
    is_deleted: true,
    status: null,
    title: null,
    color: null,
    description: null,
    created_at: '2026-05-01T00:00:00Z',
  }

  const dbWithRecurring = {
    from: jest.fn((table: string) => {
      if (table === 'rooms') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({ data: [], error: null }),
        }
      }
      if (table === 'calendar_tasks') {
        return {
          select: jest.fn().mockReturnThis(),
          or: jest.fn().mockResolvedValue({ data: [recurringTask], error: null }),
        }
      }
      if (table === 'task_exceptions') {
        return {
          select: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockResolvedValue({ data: [deletedException], error: null }),
        }
      }
      const resolved = { data: [], error: null }
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        lt: jest.fn().mockReturnThis(),
        or: jest.fn().mockResolvedValue(resolved),
        order: jest.fn().mockResolvedValue(resolved),
      }
    }),
  }

  ;(createServiceRoleClient as jest.Mock).mockReturnValue(dbWithRecurring)

  const req = new NextRequest('http://localhost/api/admin/calendar?from=2026-05-01&to=2026-05-31')
  const res = await GET(req)
  expect(res.status).toBe(200)
  const body = await res.json()

  const occurrenceDates = body.tasks.map((t: { due_date: string }) => t.due_date)
  expect(occurrenceDates).not.toContain('2026-05-08')
  expect(occurrenceDates).toContain('2026-05-01')
})

it('applies exception field overrides on expanded occurrences', async () => {
  ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(makeAuthMock())

  const recurringTask = {
    id: 'task-r2',
    title: 'Weekly clean',
    due_date: '2026-05-01',
    recurrence_rule: 'FREQ=WEEKLY',
    recurrence_end_date: null,
    series_id: 'task-r2',
    room_id: null,
    property_id: null,
    status: 'pending',
    color: '#6366F1',
    description: null,
    occurrence_date: null,
    is_recurring: null,
    created_at: '2026-05-01T00:00:00Z',
    updated_at: '2026-05-01T00:00:00Z',
  }
  const overrideException = {
    id: 'exc-2',
    task_id: 'task-r2',
    occurrence_date: '2026-05-08',
    is_deleted: false,
    status: 'complete',
    title: 'Deep clean',
    color: '#EF4444',
    description: 'Extra deep clean',
    created_at: '2026-05-01T00:00:00Z',
  }

  const dbWithOverride = {
    from: jest.fn((table: string) => {
      if (table === 'rooms') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({ data: [], error: null }),
        }
      }
      if (table === 'calendar_tasks') {
        return {
          select: jest.fn().mockReturnThis(),
          or: jest.fn().mockResolvedValue({ data: [recurringTask], error: null }),
        }
      }
      if (table === 'task_exceptions') {
        return {
          select: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockResolvedValue({ data: [overrideException], error: null }),
        }
      }
      const resolved = { data: [], error: null }
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        lt: jest.fn().mockReturnThis(),
        or: jest.fn().mockResolvedValue(resolved),
        order: jest.fn().mockResolvedValue(resolved),
      }
    }),
  }

  ;(createServiceRoleClient as jest.Mock).mockReturnValue(dbWithOverride)

  const req = new NextRequest('http://localhost/api/admin/calendar?from=2026-05-01&to=2026-05-31')
  const res = await GET(req)
  expect(res.status).toBe(200)
  const body = await res.json()

  const may8 = body.tasks.find(
    (t: { due_date: string; id: string }) => t.id === 'task-r2' && t.due_date === '2026-05-08',
  )
  expect(may8).toBeDefined()
  expect(may8.status).toBe('complete')
  expect(may8.title).toBe('Deep clean')
  expect(may8.color).toBe('#EF4444')
  expect(may8.is_recurring).toBe(true)
  expect(may8.occurrence_date).toBe('2026-05-08')
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- --testPathPattern="__tests__/api/admin/calendar.test.ts" --no-coverage 2>&1 | tail -20
```

Expected: FAIL — `task_exceptions` table not queried, `is_recurring` not set.

- [ ] **Step 3: Update `app/api/admin/calendar/route.ts`**

Replace the full file content with:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase'
import { RRule } from 'rrule'
import type { CalendarTask, TaskException } from '@/types'

export async function GET(request: NextRequest) {
  const serverClient = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await serverClient.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = request.nextUrl
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  if (!from || !to) {
    return NextResponse.json({ error: 'Missing from or to query params' }, { status: 400 })
  }

  const supabase = createServiceRoleClient()

  const [roomsRes, bookingsRes, icalRes, overridesRes, tasksRes] = await Promise.all([
    supabase
      .from('rooms')
      .select('*, property:properties(id, name)')
      .eq('is_active', true)
      .order('name'),

    supabase
      .from('bookings')
      .select('id, room_id, status, check_in, check_out, guest_first_name, guest_last_name, guest_email, guest_phone, booking_type, total_nights, total_amount, guest_count, source, notes')
      .in('status', ['confirmed', 'pending'])
      .lt('check_in', to)
      .gte('check_out', from),

    supabase
      .from('ical_blocks')
      .select('id, room_id, platform, start_date, end_date, last_synced_at')
      .lt('start_date', to)
      .gte('end_date', from),

    supabase
      .from('date_overrides')
      .select('id, room_id, date, price_override, is_blocked, block_reason, note, created_at')
      .gte('date', from)
      .lte('date', to),

    supabase
      .from('calendar_tasks')
      .select('*')
      .or(`recurrence_rule.not.is.null,and(due_date.gte.${from},due_date.lte.${to})`),
  ])

  if (roomsRes.error) return NextResponse.json({ error: roomsRes.error.message }, { status: 500 })
  if (bookingsRes.error) return NextResponse.json({ error: bookingsRes.error.message }, { status: 500 })
  if (icalRes.error) return NextResponse.json({ error: icalRes.error.message }, { status: 500 })
  if (overridesRes.error) return NextResponse.json({ error: overridesRes.error.message }, { status: 500 })
  if (tasksRes.error) return NextResponse.json({ error: tasksRes.error.message }, { status: 500 })

  const exceptionsRes = await supabase
    .from('task_exceptions')
    .select('*')
    .gte('occurrence_date', from)
    .lte('occurrence_date', to)

  const fromDate = new Date(from + 'T00:00:00Z')
  const toDate = new Date(to + 'T23:59:59Z')

  const expandedTasks = expandRecurringTasks(
    tasksRes.data ?? [],
    exceptionsRes.data ?? [],
    fromDate,
    toDate,
  )

  return NextResponse.json({
    rooms: roomsRes.data ?? [],
    bookings: bookingsRes.data ?? [],
    icalBlocks: icalRes.data ?? [],
    dateOverrides: overridesRes.data ?? [],
    tasks: expandedTasks,
  })
}

function expandRecurringTasks(
  tasks: CalendarTask[],
  exceptions: TaskException[],
  from: Date,
  to: Date,
): CalendarTask[] {
  const exceptionMap = new Map<string, TaskException>()
  for (const exc of exceptions) {
    exceptionMap.set(`${exc.task_id}|${exc.occurrence_date}`, exc)
  }

  const result: CalendarTask[] = []

  for (const task of tasks) {
    if (!task.recurrence_rule) {
      result.push(task)
      continue
    }

    try {
      const dtstart = new Date(task.due_date + 'T00:00:00Z')
      const rruleOptions = RRule.parseString(task.recurrence_rule)
      rruleOptions.dtstart = dtstart
      if (task.recurrence_end_date) {
        rruleOptions.until = new Date(task.recurrence_end_date + 'T23:59:59Z')
      }

      const rule = new RRule(rruleOptions)
      const occurrences = rule.between(from, to, true)
      const MAX_OCCURRENCES = 500

      for (const occ of occurrences.slice(0, MAX_OCCURRENCES)) {
        const dateStr = occ.toISOString().split('T')[0]
        const key = `${task.id}|${dateStr}`
        const exc = exceptionMap.get(key)

        if (exc?.is_deleted) continue

        result.push({
          ...task,
          due_date: dateStr,
          occurrence_date: dateStr,
          is_recurring: true,
          status: (exc?.status ?? task.status) as 'pending' | 'complete',
          title: exc?.title ?? task.title,
          color: exc?.color ?? task.color,
          description: exc?.description ?? task.description,
        })
      }
    } catch {
      result.push(task)
    }
  }

  return result
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- --testPathPattern="__tests__/api/admin/calendar.test.ts" --no-coverage 2>&1 | tail -20
```

Expected: PASS (all existing tests + 2 new ones).

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/calendar/route.ts __tests__/api/admin/calendar.test.ts
git commit -m "feat: apply task_exceptions in calendar RRULE expansion (deletions + field overrides)"
```

---

## Task 6: Thread occurrence context through CalendarClient

**Files:**
- Modify: `components/admin/CalendarClient.tsx`

- [ ] **Step 1: Read the current file**

Read `components/admin/CalendarClient.tsx` to confirm current state before editing.

- [ ] **Step 2: Update `ModalState` task type to include `occurrenceDate`**

Find the `ModalState` type definition (around line 55-63). Change the `task` variant from:

```ts
| { type: 'task'; task?: CalendarTask; roomId?: string | null; propertyId?: string | null; date?: string }
```

to:

```ts
| { type: 'task'; task?: CalendarTask; roomId?: string | null; propertyId?: string | null; date?: string; occurrenceDate?: string }
```

- [ ] **Step 3: Update `onTaskClick` to pass `occurrence_date`**

Find the `onTaskClick` prop passed to `CalendarGrid` (around line 392):

```ts
onTaskClick={(task) => setModal({ type: 'task', task })}
```

Replace with:

```ts
onTaskClick={(task) => setModal({ type: 'task', task, occurrenceDate: task.occurrence_date ?? undefined })}
```

- [ ] **Step 4: Update the TaskModal rendering block**

Find the TaskModal rendering (around line 527-551). Replace with:

```tsx
{/* Task modal */}
{modal.type === 'task' && (
  <TaskModal
    rooms={data.rooms}
    task={modal.task}
    initialRoomId={modal.roomId}
    initialPropertyId={modal.propertyId}
    initialDate={modal.date}
    occurrenceDate={modal.occurrenceDate}
    onClose={closeModal}
    onSuccess={(task) => {
      setData((prev) => {
        const key = `${task.id}|${task.due_date}`
        const existing = prev.tasks.findIndex((t) => `${t.id}|${t.due_date}` === key)
        if (existing >= 0) {
          const tasks = [...prev.tasks]
          tasks[existing] = task
          return { ...prev, tasks }
        }
        return { ...prev, tasks: [...prev.tasks, task] }
      })
      closeModal()
    }}
    onDelete={(taskId, occurrenceDate) => {
      if (occurrenceDate) {
        setData((prev) => ({
          ...prev,
          tasks: prev.tasks.filter(
            (t) => !(t.id === taskId && t.due_date === occurrenceDate),
          ),
        }))
      } else {
        setData((prev) => ({ ...prev, tasks: prev.tasks.filter((t) => t.id !== taskId) }))
      }
    }}
  />
)}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add components/admin/CalendarClient.tsx
git commit -m "feat: thread occurrence_date through CalendarClient modal state and delete handler"
```

---

## Task 7: Update TaskModal for occurrence editing

**Files:**
- Modify: `components/admin/TaskModal.tsx`

- [ ] **Step 1: Read the current file**

Read `components/admin/TaskModal.tsx` to confirm current state before editing.

- [ ] **Step 2: Add `occurrenceDate` to the props interface**

Find `TaskModalProps` (around line 16-25). Change:

```ts
interface TaskModalProps {
  rooms: Room[]
  task?: CalendarTask
  initialRoomId?: string | null
  initialPropertyId?: string | null
  initialDate?: string
  onClose: () => void
  onSuccess: (task: CalendarTask) => void
  onDelete?: (taskId: string) => void
}
```

to:

```ts
interface TaskModalProps {
  rooms: Room[]
  task?: CalendarTask
  initialRoomId?: string | null
  initialPropertyId?: string | null
  initialDate?: string
  occurrenceDate?: string
  onClose: () => void
  onSuccess: (task: CalendarTask) => void
  onDelete?: (taskId: string, occurrenceDate?: string) => void
}
```

- [ ] **Step 3: Destructure `occurrenceDate` and derive `isRecurringOccurrence`**

Find the function signature (around line 27-29):

```ts
export function TaskModal({
  rooms, task, initialRoomId = null, initialPropertyId = null, initialDate, onClose, onSuccess, onDelete,
}: TaskModalProps) {
```

Replace with:

```ts
export function TaskModal({
  rooms, task, initialRoomId = null, initialPropertyId = null, initialDate, occurrenceDate, onClose, onSuccess, onDelete,
}: TaskModalProps) {
  const isRecurringOccurrence = !!occurrenceDate && !!task?.recurrence_rule
```

Note: add `const isRecurringOccurrence = ...` as the first line inside the function body (after `const isEdit = !!task`).

- [ ] **Step 4: Update `handleSubmit` to route occurrence saves to the occurrence endpoint**

Find `handleSubmit` (around line 73-111). Replace the `url` and `method` derivation inside the try block:

```ts
const isOccurrenceEdit = isEdit && !!occurrenceDate
const url = isOccurrenceEdit
  ? `/api/admin/calendar-tasks/${task!.id}/occurrences/${occurrenceDate}`
  : isEdit
    ? `/api/admin/calendar-tasks/${task!.id}`
    : '/api/admin/calendar-tasks'
const method = isEdit ? 'PATCH' : 'POST'
```

For occurrence edits, only send the fields that the occurrence endpoint accepts (not `due_date`, `recurrence_rule`, or scope fields):

```ts
const payload = isOccurrenceEdit
  ? {
      title: title.trim(),
      description: description.trim() || null,
      status,
      color,
    }
  : {
      title: title.trim(),
      description: description.trim() || null,
      due_date: date,
      room_id: scope === 'room' && roomId ? roomId : null,
      property_id: scope === 'property' && propertyId ? propertyId : null,
      recurrence_rule: effectiveRRule || null,
      recurrence_end_date: recurrenceEnd || null,
      status,
      color,
    }
```

- [ ] **Step 5: Add `handleDeleteOccurrence` and `handleDeleteSeries` functions**

Add these two functions after the existing `handleDelete` function (around line 128):

```ts
async function handleDeleteOccurrence() {
  if (!task || !onDelete || !occurrenceDate) return
  setSaving(true)
  try {
    const res = await fetch(
      `/api/admin/calendar-tasks/${task.id}/occurrences/${occurrenceDate}`,
      { method: 'DELETE' },
    )
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error ?? `Failed to delete occurrence (${res.status})`)
    }
    onDelete(task.id, occurrenceDate)
    onClose()
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Unknown error')
    setSaving(false)
  }
}

async function handleDeleteSeries() {
  if (!task || !onDelete) return
  setSaving(true)
  try {
    const res = await fetch(`/api/admin/calendar-tasks/${task.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error ?? `Failed to delete series (${res.status})`)
    }
    onDelete(task.id)
    onClose()
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Unknown error')
    setSaving(false)
  }
}
```

- [ ] **Step 6: Add "Recurring" badge and hide series-level fields for occurrence edits**

In the JSX, find the Title label (around line 134):

```tsx
<div>
  <label className="block text-xs font-medium text-slate-600 mb-1">Title *</label>
```

Replace with:

```tsx
<div>
  <div className="flex items-center gap-2 mb-1">
    <label className="block text-xs font-medium text-slate-600">Title *</label>
    {isRecurringOccurrence && (
      <span className="text-[10px] font-semibold rounded-full px-2 py-0.5 bg-teal-100 text-teal-700">
        Recurring
      </span>
    )}
  </div>
```

Find the Date field block (around line 181-185) and wrap it:

```tsx
{!isRecurringOccurrence && (
  <div>
    <label className="block text-xs font-medium text-slate-600 mb-1">Date *</label>
    <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required
      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
  </div>
)}
```

Find the Recurrence block (around line 186-206) and wrap it similarly:

```tsx
{!isRecurringOccurrence && (
  <div>
    <label className="block text-xs font-medium text-slate-600 mb-1">Recurrence</label>
    {/* ... existing recurrence JSX unchanged ... */}
  </div>
)}
```

Find the Scope block (around line 145-178) and wrap it:

```tsx
{!isRecurringOccurrence && (
  <div>
    <label className="block text-xs font-medium text-slate-600 mb-2">Scope</label>
    {/* ... existing scope JSX unchanged ... */}
  </div>
)}
```

- [ ] **Step 7: Replace the delete confirmation block with occurrence-aware version**

Find `{confirmDelete ? (` (around line 231). Replace the entire `confirmDelete` branch with:

```tsx
{confirmDelete ? (
  isRecurringOccurrence ? (
    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-4 space-y-3">
      <p className="text-sm font-semibold text-red-700">Delete recurring task?</p>
      <div className="flex flex-col gap-2 pt-1">
        <button
          type="button"
          onClick={handleDeleteOccurrence}
          disabled={saving}
          className="w-full px-3 py-2 rounded-lg text-xs font-semibold text-white bg-orange-500 hover:bg-orange-600 transition-colors disabled:opacity-50"
        >
          {saving ? 'Deleting…' : 'Delete this occurrence'}
        </button>
        <button
          type="button"
          onClick={handleDeleteSeries}
          disabled={saving}
          className="w-full px-3 py-2 rounded-lg text-xs font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50"
        >
          {saving ? 'Deleting…' : 'Delete the whole series'}
        </button>
        <button
          type="button"
          onClick={() => setConfirmDelete(false)}
          className="w-full px-3 py-2 rounded-lg text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  ) : (
    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-4 space-y-3">
      <p className="text-sm font-semibold text-red-700">Delete this task?</p>
      <p className="text-xs text-red-500">
        &ldquo;{task?.title}&rdquo; will be permanently removed. This cannot be undone.
      </p>
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={() => setConfirmDelete(false)}
          className="flex-1 px-3 py-2 rounded-lg text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors">
          Cancel
        </button>
        <button type="button" onClick={handleDelete} disabled={saving}
          className="flex-1 px-3 py-2 rounded-lg text-xs font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50">
          {saving ? 'Deleting…' : 'Yes, Delete'}
        </button>
      </div>
    </div>
  )
) : (
```

- [ ] **Step 8: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 9: Run full test suite**

```bash
npm test -- --no-coverage 2>&1 | tail -30
```

Expected: all tests pass.

- [ ] **Step 10: Commit**

```bash
git add components/admin/TaskModal.tsx
git commit -m "feat: add occurrence-edit mode to TaskModal with recurring badge and split delete UX"
```

---

## Task 8: Manual smoke test

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Navigate to `/admin/calendar`**

- [ ] **Step 3: Create a recurring task**
  - Switch to Tasks view
  - Click any date cell
  - Set title "Weekly Check", recurrence = Weekly, no end date
  - Save — confirm the task chip appears on the first date and on subsequent same-day-of-week dates

- [ ] **Step 4: Verify task dots in Bookings view**
  - Switch to Bookings view
  - Confirm red dot appears on dates that have the recurring task for a room with an active booking

- [ ] **Step 5: Edit one occurrence**
  - Switch to Tasks view
  - Click a task chip that is NOT the first occurrence
  - Confirm "Recurring" badge is visible
  - Confirm Date, Recurrence, and Scope fields are hidden
  - Change title to "Deep Clean", change status to complete
  - Save — confirm only that one occurrence changes; other occurrences still show "Weekly Check"

- [ ] **Step 6: Delete one occurrence**
  - Click a different occurrence chip
  - Click Delete → confirm the two-option prompt appears ("Delete this occurrence" / "Delete the whole series")
  - Click "Delete this occurrence" — confirm that occurrence disappears, others remain

- [ ] **Step 7: Delete the whole series**
  - Click any remaining occurrence chip
  - Click Delete → "Delete the whole series"
  - Confirm all occurrences disappear from the calendar

- [ ] **Step 8: Final commit if any minor fixes were made during smoke test**

```bash
git add -p
git commit -m "fix: smoke test corrections for recurring tasks"
```
