# Enhanced Admin Calendar — Plan 2: API Routes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build four API route files that power the calendar page: a unified `GET /api/admin/calendar` endpoint, a `PUT /api/admin/date-overrides` upsert endpoint, and `POST/PATCH/DELETE /api/admin/calendar-tasks` CRUD endpoints.

**Architecture:** All routes follow the project auth pattern: `createServerSupabaseClient` for the auth check, `createServiceRoleClient` for database operations. The calendar GET endpoint expands recurring tasks via the `rrule` npm package server-side so the client receives flat task arrays. Tests use Jest with `jest.mock('@/lib/supabase')` and chained mock helpers.

**Tech Stack:** Next.js App Router Route Handlers, Supabase, TypeScript, `rrule`, Jest

**Dependency:** Plan 1 (Foundation) must be complete — types `DateOverride`, `CalendarTask`, `CalendarData` must exist in `types/index.ts`.

---

### Task 1: GET /api/admin/calendar

**Files:**
- Create: `app/api/admin/calendar/route.ts`
- Create: `__tests__/api/admin/calendar.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/api/admin/calendar.test.ts`:

```typescript
import { GET } from '@/app/api/admin/calendar/route'
import { NextRequest } from 'next/server'

jest.mock('@/lib/supabase', () => ({
  createServerSupabaseClient: jest.fn(),
  createServiceRoleClient: jest.fn(),
}))

import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase'

const mockUser = { id: 'user-1' }

function makeAuthMock(user: typeof mockUser | null = mockUser) {
  return {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user },
        error: user ? null : new Error('not auth'),
      }),
    },
  }
}

function makeDbMock(overrides: Record<string, unknown> = {}) {
  const rooms = [
    { id: 'r1', name: 'Room 1', nightly_rate: 100, price_min: 80, price_max: 150, property: { name: 'Prop 1' } },
  ]
  const bookings = [
    { id: 'b1', room_id: 'r1', check_in: '2026-05-01', check_out: '2026-05-04', status: 'confirmed' },
  ]
  const icalBlocks: unknown[] = []
  const dateOverrides: unknown[] = []
  const tasks: unknown[] = []

  const makeQuery = (data: unknown[]) => ({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    order: jest.fn().mockResolvedValue({ data: overrides[data as unknown as string] ?? data, error: null }),
  })

  return {
    from: jest.fn((table: string) => {
      if (table === 'rooms') return makeQuery(rooms)
      if (table === 'bookings') return makeQuery(bookings)
      if (table === 'ical_blocks') return makeQuery(icalBlocks)
      if (table === 'date_overrides') return makeQuery(dateOverrides)
      if (table === 'calendar_tasks') return makeQuery(tasks)
      return makeQuery([])
    }),
  }
}

describe('GET /api/admin/calendar', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 401 when not authenticated', async () => {
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(makeAuthMock(null))
    ;(createServiceRoleClient as jest.Mock).mockReturnValue(makeDbMock())

    const req = new NextRequest('http://localhost/api/admin/calendar?from=2026-05-01&to=2026-05-31')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 when from/to params are missing', async () => {
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(makeAuthMock())
    ;(createServiceRoleClient as jest.Mock).mockReturnValue(makeDbMock())

    const req = new NextRequest('http://localhost/api/admin/calendar')
    const res = await GET(req)
    expect(res.status).toBe(400)
  })

  it('returns calendar data shape when authenticated', async () => {
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(makeAuthMock())
    ;(createServiceRoleClient as jest.Mock).mockReturnValue(makeDbMock())

    const req = new NextRequest('http://localhost/api/admin/calendar?from=2026-05-01&to=2026-05-31')
    const res = await GET(req)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body).toHaveProperty('rooms')
    expect(body).toHaveProperty('bookings')
    expect(body).toHaveProperty('icalBlocks')
    expect(body).toHaveProperty('dateOverrides')
    expect(body).toHaveProperty('tasks')
    expect(Array.isArray(body.rooms)).toBe(true)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx jest __tests__/api/admin/calendar.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '@/app/api/admin/calendar/route'`

- [ ] **Step 3: Create the route**

Create `app/api/admin/calendar/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase'
import { RRule } from 'rrule'
import type { CalendarTask } from '@/types'

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
      .select('*')
      .in('status', ['confirmed', 'pending'])
      .lt('check_in', to)
      .gte('check_out', from),

    supabase
      .from('ical_blocks')
      .select('*')
      .lt('start_date', to)
      .gte('end_date', from),

    supabase
      .from('date_overrides')
      .select('*')
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

  const fromDate = new Date(from + 'T00:00:00Z')
  const toDate = new Date(to + 'T23:59:59Z')

  const expandedTasks = expandRecurringTasks(tasksRes.data ?? [], fromDate, toDate)

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
  from: Date,
  to: Date,
): CalendarTask[] {
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

      for (const occ of occurrences) {
        const dateStr = occ.toISOString().split('T')[0]
        result.push({ ...task, due_date: dateStr })
      }
    } catch {
      result.push(task)
    }
  }

  return result
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx jest __tests__/api/admin/calendar.test.ts --no-coverage
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/calendar/route.ts __tests__/api/admin/calendar.test.ts
git commit -m "feat: add GET /api/admin/calendar unified calendar data endpoint"
```

---

### Task 2: PUT /api/admin/date-overrides

**Files:**
- Create: `app/api/admin/date-overrides/route.ts`
- Create: `__tests__/api/admin/date-overrides.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/api/admin/date-overrides.test.ts`:

```typescript
import { PUT } from '@/app/api/admin/date-overrides/route'
import { NextRequest } from 'next/server'

jest.mock('@/lib/supabase', () => ({
  createServerSupabaseClient: jest.fn(),
  createServiceRoleClient: jest.fn(),
}))

import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase'

const mockUser = { id: 'user-1' }

function makeAuthMock(user: typeof mockUser | null = mockUser) {
  return {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user },
        error: user ? null : new Error('not auth'),
      }),
    },
  }
}

function makeDbMock(upsertError: Error | null = null) {
  const upsert = jest.fn().mockResolvedValue({ data: [], error: upsertError })
  const from = jest.fn().mockReturnValue({ upsert })
  return { from, upsert }
}

function makeReq(body: unknown) {
  return new NextRequest('http://localhost/api/admin/date-overrides', {
    method: 'PUT',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('PUT /api/admin/date-overrides', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 401 when not authenticated', async () => {
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(makeAuthMock(null))
    ;(createServiceRoleClient as jest.Mock).mockReturnValue(makeDbMock())

    const res = await PUT(makeReq({ room_id: 'r1', dates: ['2026-05-01'], is_blocked: true }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when room_id is missing', async () => {
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(makeAuthMock())
    ;(createServiceRoleClient as jest.Mock).mockReturnValue(makeDbMock())

    const res = await PUT(makeReq({ dates: ['2026-05-01'], is_blocked: true }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when dates array is missing', async () => {
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(makeAuthMock())
    ;(createServiceRoleClient as jest.Mock).mockReturnValue(makeDbMock())

    const res = await PUT(makeReq({ room_id: 'r1', is_blocked: true }))
    expect(res.status).toBe(400)
  })

  it('upserts date overrides and returns 200', async () => {
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(makeAuthMock())
    const { from, upsert } = makeDbMock()
    ;(createServiceRoleClient as jest.Mock).mockReturnValue({ from })

    const res = await PUT(makeReq({
      room_id: 'r1',
      dates: ['2026-05-01', '2026-05-02'],
      is_blocked: true,
      block_reason: 'Maintenance',
    }))
    expect(res.status).toBe(200)
    expect(upsert).toHaveBeenCalledTimes(1)
    const upsertArg = upsert.mock.calls[0][0] as unknown[]
    expect(upsertArg).toHaveLength(2)
  })

  it('returns 200 for unblock operation (is_blocked false)', async () => {
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(makeAuthMock())
    ;(createServiceRoleClient as jest.Mock).mockReturnValue(makeDbMock())

    const res = await PUT(makeReq({
      room_id: 'r1',
      dates: ['2026-05-01'],
      is_blocked: false,
    }))
    expect(res.status).toBe(200)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx jest __tests__/api/admin/date-overrides.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '@/app/api/admin/date-overrides/route'`

- [ ] **Step 3: Create the route**

Create `app/api/admin/date-overrides/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase'

export async function PUT(request: NextRequest) {
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

  const { room_id, dates, price_override, is_blocked, block_reason, note } = body

  if (!room_id || typeof room_id !== 'string') {
    return NextResponse.json({ error: 'Missing room_id' }, { status: 400 })
  }
  if (!Array.isArray(dates) || dates.length === 0) {
    return NextResponse.json({ error: 'Missing or empty dates array' }, { status: 400 })
  }

  const rows = (dates as string[]).map((date) => ({
    room_id,
    date,
    price_override: typeof price_override === 'number' ? price_override : null,
    is_blocked: is_blocked === true,
    block_reason: typeof block_reason === 'string' ? block_reason : null,
    note: typeof note === 'string' ? note : null,
  }))

  const supabase = createServiceRoleClient()
  const { error } = await supabase
    .from('date_overrides')
    .upsert(rows, { onConflict: 'room_id,date' })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, updated: rows.length })
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx jest __tests__/api/admin/date-overrides.test.ts --no-coverage
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/date-overrides/route.ts __tests__/api/admin/date-overrides.test.ts
git commit -m "feat: add PUT /api/admin/date-overrides upsert endpoint"
```

---

### Task 3: Calendar tasks CRUD — POST + collection route

**Files:**
- Create: `app/api/admin/calendar-tasks/route.ts`
- Create: `__tests__/api/admin/calendar-tasks.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/api/admin/calendar-tasks.test.ts`:

```typescript
import { POST } from '@/app/api/admin/calendar-tasks/route'
import { NextRequest } from 'next/server'

jest.mock('@/lib/supabase', () => ({
  createServerSupabaseClient: jest.fn(),
  createServiceRoleClient: jest.fn(),
}))

import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase'

const mockUser = { id: 'user-1' }

function makeAuthMock(user: typeof mockUser | null = mockUser) {
  return {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user },
        error: user ? null : new Error('not auth'),
      }),
    },
  }
}

function makeDbMock(insertError: Error | null = null) {
  const single = jest.fn().mockResolvedValue({
    data: { id: 'task-1', title: 'Clean Room', due_date: '2026-05-01', status: 'pending' },
    error: insertError,
  })
  const select = jest.fn().mockReturnValue({ single })
  const insert = jest.fn().mockReturnValue({ select })
  const from = jest.fn().mockReturnValue({ insert })
  return { from, insert, select, single }
}

function makeReq(body: unknown) {
  return new NextRequest('http://localhost/api/admin/calendar-tasks', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('POST /api/admin/calendar-tasks', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 401 when not authenticated', async () => {
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(makeAuthMock(null))
    ;(createServiceRoleClient as jest.Mock).mockReturnValue(makeDbMock())

    const res = await POST(makeReq({ title: 'Test', due_date: '2026-05-01' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when title is missing', async () => {
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(makeAuthMock())
    ;(createServiceRoleClient as jest.Mock).mockReturnValue(makeDbMock())

    const res = await POST(makeReq({ due_date: '2026-05-01' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when due_date is missing', async () => {
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(makeAuthMock())
    ;(createServiceRoleClient as jest.Mock).mockReturnValue(makeDbMock())

    const res = await POST(makeReq({ title: 'Clean Room' }))
    expect(res.status).toBe(400)
  })

  it('creates a task and returns 201', async () => {
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(makeAuthMock())
    ;(createServiceRoleClient as jest.Mock).mockReturnValue(makeDbMock())

    const res = await POST(makeReq({ title: 'Clean Room', due_date: '2026-05-01' }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.task.title).toBe('Clean Room')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx jest __tests__/api/admin/calendar-tasks.test.ts --no-coverage
```

Expected: FAIL

- [ ] **Step 3: Create the route**

Create `app/api/admin/calendar-tasks/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase'

export async function POST(request: NextRequest) {
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

  const { title, due_date, description, room_id, recurrence_rule, recurrence_end_date, status, color } = body

  if (!title || typeof title !== 'string') {
    return NextResponse.json({ error: 'Missing title' }, { status: 400 })
  }
  if (!due_date || typeof due_date !== 'string') {
    return NextResponse.json({ error: 'Missing due_date' }, { status: 400 })
  }

  const supabase = createServiceRoleClient()
  const { data: task, error } = await supabase
    .from('calendar_tasks')
    .insert({
      title,
      due_date,
      description: description ?? null,
      room_id: room_id ?? null,
      recurrence_rule: recurrence_rule ?? null,
      recurrence_end_date: recurrence_end_date ?? null,
      status: status ?? 'pending',
      color: color ?? null,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ task }, { status: 201 })
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx jest __tests__/api/admin/calendar-tasks.test.ts --no-coverage
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/calendar-tasks/route.ts __tests__/api/admin/calendar-tasks.test.ts
git commit -m "feat: add POST /api/admin/calendar-tasks create endpoint"
```

---

### Task 4: Calendar tasks CRUD — PATCH + DELETE by ID

**Files:**
- Create: `app/api/admin/calendar-tasks/[id]/route.ts`
- Create: `__tests__/api/admin/calendar-tasks-id.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/api/admin/calendar-tasks-id.test.ts`:

```typescript
import { PATCH, DELETE } from '@/app/api/admin/calendar-tasks/[id]/route'
import { NextRequest } from 'next/server'

jest.mock('@/lib/supabase', () => ({
  createServerSupabaseClient: jest.fn(),
  createServiceRoleClient: jest.fn(),
}))

import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase'

const mockUser = { id: 'user-1' }

function makeAuthMock(user: typeof mockUser | null = mockUser) {
  return {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user },
        error: user ? null : new Error('not auth'),
      }),
    },
  }
}

function makeDbMock() {
  const single = jest.fn().mockResolvedValue({
    data: { id: 'task-1', title: 'Updated', status: 'complete' },
    error: null,
  })
  const select = jest.fn().mockReturnValue({ single })
  const eqUpdate = jest.fn().mockReturnValue({ select })
  const update = jest.fn().mockReturnValue({ eq: eqUpdate })
  const eqDelete = jest.fn().mockResolvedValue({ error: null })
  const del = jest.fn().mockReturnValue({ eq: eqDelete })
  const from = jest.fn((table: string) => {
    if (table === 'calendar_tasks') return { update, delete: del }
    return {}
  })
  return { from }
}

function makeReq(method: string, body?: unknown, id = 'task-1') {
  return new NextRequest(`http://localhost/api/admin/calendar-tasks/${id}`, {
    method,
    ...(body ? { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } } : {}),
  })
}

const params = { params: Promise.resolve({ id: 'task-1' }) }

describe('PATCH /api/admin/calendar-tasks/[id]', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 401 when not authenticated', async () => {
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(makeAuthMock(null))
    ;(createServiceRoleClient as jest.Mock).mockReturnValue(makeDbMock())
    const res = await PATCH(makeReq('PATCH', { status: 'complete' }), params)
    expect(res.status).toBe(401)
  })

  it('updates the task and returns 200', async () => {
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(makeAuthMock())
    ;(createServiceRoleClient as jest.Mock).mockReturnValue(makeDbMock())
    const res = await PATCH(makeReq('PATCH', { status: 'complete', title: 'Updated' }), params)
    expect(res.status).toBe(200)
  })
})

describe('DELETE /api/admin/calendar-tasks/[id]', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 401 when not authenticated', async () => {
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(makeAuthMock(null))
    ;(createServiceRoleClient as jest.Mock).mockReturnValue(makeDbMock())
    const res = await DELETE(makeReq('DELETE'), params)
    expect(res.status).toBe(401)
  })

  it('deletes the task and returns 200', async () => {
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(makeAuthMock())
    ;(createServiceRoleClient as jest.Mock).mockReturnValue(makeDbMock())
    const res = await DELETE(makeReq('DELETE'), params)
    expect(res.status).toBe(200)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx jest __tests__/api/admin/calendar-tasks-id.test.ts --no-coverage
```

Expected: FAIL

- [ ] **Step 3: Create the route**

Create `app/api/admin/calendar-tasks/[id]/route.ts`:

```typescript
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
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const allowed = ['title', 'description', 'due_date', 'recurrence_rule', 'recurrence_end_date', 'status', 'color', 'room_id']
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }
  updates.updated_at = new Date().toISOString()

  const supabase = createServiceRoleClient()
  const { data: task, error } = await supabase
    .from('calendar_tasks')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ task })
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const serverClient = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await serverClient.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const supabase = createServiceRoleClient()
  const { error } = await supabase
    .from('calendar_tasks')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx jest __tests__/api/admin/calendar-tasks-id.test.ts --no-coverage
```

Expected: PASS

- [ ] **Step 5: Run all new tests together**

```bash
npx jest __tests__/api/admin/calendar.test.ts __tests__/api/admin/date-overrides.test.ts __tests__/api/admin/calendar-tasks.test.ts __tests__/api/admin/calendar-tasks-id.test.ts --no-coverage
```

Expected: all PASS

- [ ] **Step 6: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add app/api/admin/calendar-tasks/[id]/route.ts __tests__/api/admin/calendar-tasks-id.test.ts
git commit -m "feat: add PATCH/DELETE /api/admin/calendar-tasks/[id] endpoints"
```
