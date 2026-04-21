# Enhanced Admin Calendar — Plan 1: Foundation (DB + Types)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Install the `rrule` package, run three DB migrations, and extend `types/index.ts` with the new `DateOverride`, `CalendarTask` interfaces and `price_min`/`price_max` on `Room`.

**Architecture:** Three sequential migrations add `price_min`/`price_max` to `rooms`, create the `date_overrides` table, and create the `calendar_tasks` table. TypeScript types are updated last so subsequent agents can import them.

**Tech Stack:** Supabase migrations (SQL), TypeScript, npm

**Execution order:** This plan MUST complete before Plans 2, 3, 4, and 5 can start.

---

### Task 1: Install `rrule`

**Files:**
- Modify: `package.json` (via npm)

- [ ] **Step 1: Install the package**

```bash
npm install rrule
```

Expected output: `added 1 package` (or similar).

- [ ] **Step 2: Verify the types are available**

```bash
node -e "const { RRule } = require('rrule'); console.log('rrule ok');"
```

Expected: `rrule ok`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install rrule for recurring task expansion"
```

---

### Task 2: Migration — add price_min / price_max to rooms

**Files:**
- Create: `supabase/migrations/012_room_price_range.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/012_room_price_range.sql
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS price_min numeric;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS price_max numeric;
```

- [ ] **Step 2: Apply the migration**

```bash
npx supabase db push
```

Expected: migration applies without error.

- [ ] **Step 3: Verify columns exist**

```bash
npx supabase db execute --sql "SELECT column_name FROM information_schema.columns WHERE table_name = 'rooms' AND column_name IN ('price_min','price_max');"
```

Expected: two rows returned.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/012_room_price_range.sql
git commit -m "feat: add price_min and price_max columns to rooms"
```

---

### Task 3: Migration — create date_overrides table

**Files:**
- Create: `supabase/migrations/013_date_overrides.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/013_date_overrides.sql
CREATE TABLE IF NOT EXISTS date_overrides (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id        uuid        NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  date           date        NOT NULL,
  price_override numeric,
  is_blocked     boolean     NOT NULL DEFAULT false,
  block_reason   text,
  note           text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, date)
);

CREATE INDEX IF NOT EXISTS date_overrides_room_date ON date_overrides (room_id, date);
```

- [ ] **Step 2: Apply the migration**

```bash
npx supabase db push
```

Expected: migration applies without error.

- [ ] **Step 3: Verify table exists**

```bash
npx supabase db execute --sql "SELECT COUNT(*) FROM date_overrides;"
```

Expected: `0` rows (empty table).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/013_date_overrides.sql
git commit -m "feat: create date_overrides table for per-night price and block overrides"
```

---

### Task 4: Migration — create calendar_tasks table

**Files:**
- Create: `supabase/migrations/014_calendar_tasks.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/014_calendar_tasks.sql
CREATE TABLE IF NOT EXISTS calendar_tasks (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id             uuid        REFERENCES rooms(id) ON DELETE CASCADE,
  title               text        NOT NULL,
  description         text,
  due_date            date        NOT NULL,
  recurrence_rule     text,
  recurrence_end_date date,
  status              text        NOT NULL DEFAULT 'pending'
                                  CHECK (status IN ('pending', 'complete')),
  color               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS calendar_tasks_due_date ON calendar_tasks (due_date);
CREATE INDEX IF NOT EXISTS calendar_tasks_room_id  ON calendar_tasks (room_id);
```

- [ ] **Step 2: Apply the migration**

```bash
npx supabase db push
```

Expected: migration applies without error.

- [ ] **Step 3: Verify table exists**

```bash
npx supabase db execute --sql "SELECT COUNT(*) FROM calendar_tasks;"
```

Expected: `0` rows.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/014_calendar_tasks.sql
git commit -m "feat: create calendar_tasks table for operational task management"
```

---

### Task 5: Extend TypeScript types

**Files:**
- Modify: `types/index.ts`

- [ ] **Step 1: Add `price_min`, `price_max` to the `Room` interface**

In `types/index.ts`, after the `ical_export_token` line inside `Room`, add:

```typescript
  price_min?: number | null
  price_max?: number | null
```

The full updated `Room` interface should look like:

```typescript
export interface Room {
  id: string
  property_id: string
  name: string
  slug: string
  description: string
  short_description: string
  guest_capacity: number
  bedrooms: number
  bathrooms: number
  nightly_rate: number
  monthly_rate: number
  minimum_nights_short_term: number
  minimum_nights_long_term: number
  images: string[]
  amenities: string[]
  house_rules: string
  is_active: boolean
  show_nightly_rate: boolean
  show_monthly_rate: boolean
  cleaning_fee?: number
  security_deposit?: number
  extra_guest_fee?: number
  fees?: RoomFee[]
  cancellation_window_hours: number
  cancellation_policy?: string | null
  use_property_cancellation_policy?: boolean
  ical_export_token: string
  price_min?: number | null
  price_max?: number | null
  created_at: string
  updated_at: string
  // joined
  property?: Property
}
```

- [ ] **Step 2: Append `DateOverride` and `CalendarTask` interfaces**

At the end of `types/index.ts` add:

```typescript
// ── Calendar overrides & tasks ────────────────────────────────────────────────

export interface DateOverride {
  id: string
  room_id: string
  date: string            // ISO date "YYYY-MM-DD"
  price_override: number | null
  is_blocked: boolean
  block_reason: string | null
  note: string | null
  created_at: string
}

export interface CalendarTask {
  id: string
  room_id: string | null  // null = property-wide
  title: string
  description: string | null
  due_date: string        // ISO date "YYYY-MM-DD"
  recurrence_rule: string | null   // iCal RRULE string
  recurrence_end_date: string | null
  status: 'pending' | 'complete'
  color: string | null
  created_at: string
  updated_at: string
}

export interface CalendarData {
  rooms: Room[]
  bookings: Booking[]
  icalBlocks: ICalBlock[]
  dateOverrides: DateOverride[]
  tasks: CalendarTask[]
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add types/index.ts
git commit -m "feat: add DateOverride, CalendarTask types and price_min/max to Room"
```
