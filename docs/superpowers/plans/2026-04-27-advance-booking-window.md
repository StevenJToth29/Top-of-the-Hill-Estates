# Advance Booking Window Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-room "max advance booking window" setting that limits how far in the future guests can book, with an "all blocked" option that keeps the room visible but shows no available dates.

**Architecture:** Store `max_advance_booking_days` (integer, 0 = all blocked, null = unlimited) and `max_advance_booking_applies_to` ('short_term' | 'long_term' | 'both') on the rooms table. The admin RoomForm exposes presets + custom input. The public BookingWidget and AvailabilityCalendar enforce the window client-side via DatePicker's existing `max` prop. The admin CalendarGrid adds a `'window-exceeded'` visual state. The booking creation API validates server-side to prevent bypassing the limit.

**Tech Stack:** Next.js App Router, Supabase (Postgres), TypeScript, date-fns, React state

---

## File Map

| File | Change |
|------|--------|
| `supabase/migrations/034_advance_booking_window.sql` | **Create** — adds 2 columns to `rooms` |
| `types/index.ts` | **Modify** — add fields to Room interface |
| `app/api/admin/rooms/route.ts` | **Modify** — persist fields in POST + PATCH |
| `components/admin/RoomForm.tsx` | **Modify** — add Booking Window section in iCal tab |
| `app/(public)/rooms/[slug]/page.tsx` | **Modify** — pass window-end props to BookingWidget + AvailabilityCalendar |
| `components/public/BookingWidget.tsx` | **Modify** — compute windowEnd, pass max= to DatePickers |
| `components/public/AvailabilityCalendar.tsx` | **Modify** — accept + enforce windowEnd prop |
| `components/admin/CalendarGrid.tsx` | **Modify** — add window-exceeded CellStatus + style |
| `app/api/bookings/route.ts` | **Modify** — validate check_in against booking window |

---

## Task 1: DB Migration

**Files:**
- Create: `supabase/migrations/034_advance_booking_window.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/034_advance_booking_window.sql
ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS max_advance_booking_days integer,
  ADD COLUMN IF NOT EXISTS max_advance_booking_applies_to text NOT NULL DEFAULT 'both'
    CHECK (max_advance_booking_applies_to IN ('short_term', 'long_term', 'both'));

-- Default existing rooms to 6 months (182 days)
UPDATE rooms SET max_advance_booking_days = 182 WHERE max_advance_booking_days IS NULL;
```

- [ ] **Step 2: Apply the migration via Supabase MCP**

Use `mcp__supabase__apply_migration` with the SQL above.

Expected: migration succeeds, rooms table has two new columns.

- [ ] **Step 3: Verify columns exist**

Use `mcp__supabase__execute_sql`:
```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'rooms'
  AND column_name IN ('max_advance_booking_days', 'max_advance_booking_applies_to');
```

Expected: 2 rows returned.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/034_advance_booking_window.sql
git commit -m "feat: add max_advance_booking_days and applies_to columns to rooms"
```

---

## Task 2: TypeScript Type Update

**Files:**
- Modify: `types/index.ts:31-75`

- [ ] **Step 1: Add fields to the Room interface**

In `types/index.ts`, after the `airbnb_listing_id` line (currently line 66), add:

```typescript
  max_advance_booking_days?: number | null
  max_advance_booking_applies_to?: 'short_term' | 'long_term' | 'both'
```

The Room interface block should now include these two lines before `price_min`.

- [ ] **Step 2: Type-check**

```bash
cd /workspaces/Top-of-the-Hill-Estates && npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add types/index.ts
git commit -m "feat: add advance booking window fields to Room type"
```

---

## Task 3: Admin Rooms API — Persist New Fields

**Files:**
- Modify: `app/api/admin/rooms/route.ts:26-62` (POST insert) and `:104-142` (PATCH update)

- [ ] **Step 1: Add fields to the POST insert block**

In `app/api/admin/rooms/route.ts`, inside the `.insert({...})` call (after `price_max`), add:

```typescript
      max_advance_booking_days: body.max_advance_booking_days != null ? Number(body.max_advance_booking_days) : 182,
      max_advance_booking_applies_to: body.max_advance_booking_applies_to ?? 'both',
```

- [ ] **Step 2: Add fields to the PATCH update block**

In the `.update({...})` call (after `price_max`), add:

```typescript
      max_advance_booking_days: fields.max_advance_booking_days != null ? Number(fields.max_advance_booking_days) : 182,
      max_advance_booking_applies_to: fields.max_advance_booking_applies_to ?? 'both',
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/rooms/route.ts
git commit -m "feat: persist advance booking window fields in rooms API"
```

---

## Task 4: Admin RoomForm UI — Booking Window Section

**Files:**
- Modify: `components/admin/RoomForm.tsx`

This task adds state, a helper function, and a new UI section to the iCal tab.

- [ ] **Step 1: Add state variables**

After the `smartPricingAggressiveness` state line (~line 147), add:

```typescript
  const [maxAdvanceDays, setMaxAdvanceDays] = useState<number | null>(
    room?.max_advance_booking_days ?? 182
  )
  const [advanceAppliesTo, setAdvanceAppliesTo] = useState<'short_term' | 'long_term' | 'both'>(
    room?.max_advance_booking_applies_to ?? 'both'
  )
  const [advanceCustom, setAdvanceCustom] = useState(false)
```

- [ ] **Step 2: Add fields to the submit payload**

Inside the `payload` object in `handleSubmit` (after `price_max`), add:

```typescript
      max_advance_booking_days: maxAdvanceDays,
      max_advance_booking_applies_to: advanceAppliesTo,
```

- [ ] **Step 3: Add helper for preset buttons**

Add a small helper near the top of the component (before the return statement, after the state declarations):

```typescript
  const WINDOW_PRESETS = [
    { label: 'All Blocked', days: 0 },
    { label: '30 days', days: 30 },
    { label: '60 days', days: 60 },
    { label: '90 days', days: 90 },
    { label: '6 months', days: 182 },
    { label: '1 year', days: 365 },
  ]
```

- [ ] **Step 4: Add UI section in iCal tab**

Find the iCal tab section in the JSX (line ~1103: `{tab === 'ical' && (`). Add a new `<SCard>` block **before** the closing `)}` of that tab. The existing iCal tab already has SCards for iCal Export, Embedded Widget, and Airbnb. Add this after the last existing SCard:

```tsx
<SCard title="Booking Window" subtitle="Limit how far in advance guests can book this room">
  <div className="space-y-4">
    {/* Applies to */}
    <div>
      <label className={labelClass}>Applies to booking type</label>
      <div className="flex gap-2 flex-wrap">
        {(['both', 'short_term', 'long_term'] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setAdvanceAppliesTo(v)}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors',
              advanceAppliesTo === v
                ? 'bg-primary text-on-primary border-primary'
                : 'bg-surface-container text-on-surface-variant border-outline/30 hover:border-primary/50'
            )}
          >
            {v === 'both' ? 'Both' : v === 'short_term' ? 'Short-term only' : 'Long-term only'}
          </button>
        ))}
      </div>
    </div>

    {/* Presets */}
    <div>
      <label className={labelClass}>Window (days in advance)</label>
      <div className="flex gap-2 flex-wrap">
        {WINDOW_PRESETS.map((p) => (
          <button
            key={p.days}
            type="button"
            onClick={() => { setMaxAdvanceDays(p.days); setAdvanceCustom(false) }}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors',
              !advanceCustom && maxAdvanceDays === p.days
                ? 'bg-primary text-on-primary border-primary'
                : 'bg-surface-container text-on-surface-variant border-outline/30 hover:border-primary/50'
            )}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setAdvanceCustom(true)}
          className={clsx(
            'px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors',
            advanceCustom
              ? 'bg-primary text-on-primary border-primary'
              : 'bg-surface-container text-on-surface-variant border-outline/30 hover:border-primary/50'
          )}
        >
          Custom
        </button>
      </div>
    </div>

    {/* Custom input */}
    {advanceCustom && (
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={0}
          value={maxAdvanceDays ?? ''}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10)
            setMaxAdvanceDays(isNaN(v) ? null : Math.max(0, v))
          }}
          className="w-28 rounded-lg border border-outline/30 bg-surface px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
          placeholder="Days"
        />
        <span className="text-sm text-on-surface-variant">days in advance (0 = all blocked)</span>
      </div>
    )}

    {/* Summary */}
    <p className="text-xs text-on-surface-variant">
      {maxAdvanceDays === 0
        ? 'All dates will appear unavailable. The room remains visible on listings.'
        : maxAdvanceDays === null
        ? 'No limit — all future dates within the platform window are available.'
        : `Guests can book up to ${maxAdvanceDays} days in advance${advanceAppliesTo !== 'both' ? ` (${advanceAppliesTo === 'short_term' ? 'short-term only' : 'long-term only'})` : ''}.`}
    </p>
  </div>
</SCard>
```

- [ ] **Step 5: Type-check and verify build**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add components/admin/RoomForm.tsx
git commit -m "feat: add booking window UI to RoomForm iCal tab"
```

---

## Task 5: BookingWidget — Enforce Window

**Files:**
- Modify: `components/public/BookingWidget.tsx`

The room object is already available as a prop. We compute the window end date from `room.max_advance_booking_days` and `room.max_advance_booking_applies_to`, then pass it as `max=` to the DatePicker.

- [ ] **Step 1: Add the window computation (in component body, near the top of the function)**

After the `blockedSet` useMemo (around line 51), add:

```typescript
  const today = useMemo(() => startOfDay(new Date()), [])

  const shortTermWindowEnd = useMemo(() => {
    const applies = room.max_advance_booking_applies_to ?? 'both'
    if (applies === 'long_term') return undefined // no cap for short-term
    const days = room.max_advance_booking_days
    if (days == null) return undefined // unlimited
    if (days === 0) return format(addDays(today, -1), 'yyyy-MM-dd') // all blocked
    return format(addDays(today, days), 'yyyy-MM-dd')
  }, [room.max_advance_booking_days, room.max_advance_booking_applies_to, today])

  const longTermWindowEnd = useMemo(() => {
    const applies = room.max_advance_booking_applies_to ?? 'both'
    if (applies === 'short_term') return undefined // no cap for long-term
    const days = room.max_advance_booking_days
    if (days == null) return undefined // unlimited
    if (days === 0) return format(addDays(today, -1), 'yyyy-MM-dd') // all blocked
    return format(addDays(today, days), 'yyyy-MM-dd')
  }, [room.max_advance_booking_days, room.max_advance_booking_applies_to, today])
```

Make sure `startOfDay` is imported from `date-fns` (it likely already is; if not, add it to the existing date-fns imports).

- [ ] **Step 2: Pass shortTermWindowEnd as max to the short-term DatePicker**

Find the DatePicker for short-term check-in (search for `blockedDates={blockedDates}` around line 272 — the one inside the short-term section). It's rendered like:

```tsx
<DatePicker
  ...
  blockedDates={blockedDates}
  ...
/>
```

Add `max={shortTermWindowEnd}` to that DatePicker component. Also add it to the checkout DatePicker in the same section.

- [ ] **Step 3: Pass longTermWindowEnd as max to the long-term DatePicker**

Find the DatePicker for the long-term move-in date (around line 345: `blockedDates={blockedDates}` in the long-term section). Add `max={longTermWindowEnd}` to that component.

- [ ] **Step 4: Show unavailability note when window is 0 for the active booking type**

After the bookingType state determination but before the JSX return, add:

```typescript
  const isShortTermBlocked = bookingType === 'short_term' && shortTermWindowEnd !== undefined && shortTermWindowEnd < formatDate(today)
  const isLongTermBlocked = bookingType === 'long_term' && longTermWindowEnd !== undefined && longTermWindowEnd < formatDate(today)
  const currentTypeBlocked = isShortTermBlocked || isLongTermBlocked
```

Then in the JSX, wrap the date selection section with a conditional — if `currentTypeBlocked`, show a note instead:

```tsx
{currentTypeBlocked ? (
  <p className="text-sm text-on-surface-variant py-4 text-center">
    This room is not currently accepting {bookingType === 'short_term' ? 'short-term' : 'long-term'} reservations.
  </p>
) : (
  /* existing date picker / submit section */
)}
```

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add components/public/BookingWidget.tsx
git commit -m "feat: enforce advance booking window in BookingWidget"
```

---

## Task 6: AvailabilityCalendar — Enforce Window

**Files:**
- Modify: `components/public/AvailabilityCalendar.tsx:20-26`
- Modify: `app/(public)/rooms/[slug]/page.tsx`

- [ ] **Step 1: Add windowEnd prop to AvailabilityCalendar**

In `components/public/AvailabilityCalendar.tsx`, update the Props interface:

```typescript
interface Props {
  blockedDates: string[]
  roomName?: string
  selectedCheckIn?: string | null
  selectedCheckOut?: string | null
  onDateSelect?: (date: string) => void
  windowEnd?: string // YYYY-MM-DD — dates after this are treated as blocked
}
```

- [ ] **Step 2: Accept windowEnd in the component signature**

Find the component signature around line 130-131:
```typescript
export default function AvailabilityCalendar({
  blockedDates,
  roomName,
  ...
```

Add `windowEnd` to the destructured props.

- [ ] **Step 3: Merge window-blocked dates into the blocked set**

After the `blockedSet` useMemo (around line 139), add:

```typescript
  const effectiveBlockedSet = useMemo(() => {
    if (!windowEnd) return blockedSet
    // Add a marker so MonthGrid can check — easier to just expand the set isn't practical
    // for unlimited future dates. Instead pass windowEnd down to MonthGrid.
    return blockedSet
  }, [blockedSet, windowEnd])
```

Actually a cleaner approach: pass `windowEnd` down to `MonthGrid` as a prop and let each cell check `dateStr > windowEnd`.

Update `MonthGrid`'s props interface:

```typescript
function MonthGrid({
  month,
  today,
  blockedSet,
  selectedCheckIn,
  selectedCheckOut,
  onDateSelect,
  windowEnd,
}: {
  month: Date
  today: Date
  blockedSet: Set<string>
  selectedCheckIn?: string | null
  selectedCheckOut?: string | null
  onDateSelect?: (date: string) => void
  windowEnd?: string
})
```

Inside `MonthGrid`, where each day cell is rendered, add to the `isBlocked` computation:

```typescript
const isBlocked = blockedSet.has(ds) || (!!windowEnd && ds > windowEnd)
```

- [ ] **Step 4: Pass windowEnd to MonthGrid in AvailabilityCalendar's render**

Find where `<MonthGrid ... />` is rendered inside AvailabilityCalendar and add `windowEnd={windowEnd}`.

- [ ] **Step 5: Pass windowEnd from the room page**

In `app/(public)/rooms/[slug]/page.tsx`, compute the calendar window end date after fetching the room. Add this after the `minMoveIn` line:

```typescript
  const calendarWindowEnd: string | undefined = (() => {
    const days = rawRoom.max_advance_booking_days
    if (days == null) return undefined
    if (days === 0) return format(addDays(today, -1), 'yyyy-MM-dd')
    return format(addDays(today, days), 'yyyy-MM-dd')
  })()
```

Then find where `<AvailabilityCalendar blockedDates={blockedDates} roomName={room.name} />` is rendered (around line 317) and add:

```tsx
<AvailabilityCalendar
  blockedDates={blockedDates}
  roomName={room.name}
  windowEnd={calendarWindowEnd}
/>
```

- [ ] **Step 6: Type-check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add components/public/AvailabilityCalendar.tsx app/(public)/rooms/\[slug\]/page.tsx
git commit -m "feat: enforce advance booking window in AvailabilityCalendar"
```

---

## Task 7: Admin CalendarGrid — Window-Exceeded Visual State

**Files:**
- Modify: `components/admin/CalendarGrid.tsx:38-77` (CellStatus, getCellStatus, getCellStyle)

- [ ] **Step 1: Add window-exceeded to CellStatus**

On line 38, update:

```typescript
type CellStatus = 'available' | 'booked-first' | 'booked-cont' | 'blocked' | 'ical' | 'selected' | 'window-exceeded'
```

- [ ] **Step 2: Add windowEnd parameter to getCellStatus**

Update the function signature:

```typescript
function getCellStatus(
  roomId: string,
  dateStr: string,
  bookings: Booking[],
  icalBlocks: ICalBlock[],
  overrideMap: OverrideMap,
  selection: DragSelection | null,
  windowEnd?: string,
): CellStatus {
```

Add the window check as the **last** condition, just before `return 'available'`:

```typescript
  if (windowEnd && dateStr > windowEnd) return 'window-exceeded'

  return 'available'
}
```

- [ ] **Step 3: Add style for window-exceeded**

In `getCellStyle`, add a case:

```typescript
    case 'window-exceeded':
      return { background: 'rgba(251,191,36,0.08)', borderTop: '2px solid rgba(251,191,36,0.35)' }
```

(Amber tint — distinct from blocked's slate and booking's teal.)

- [ ] **Step 4: Compute windowEnd per room in CalendarGrid and pass to getCellStatus**

The CalendarGrid already receives `rooms: Room[]`. Find where `getCellStatus(...)` is called (around line 400+, inside the cell render loop). The call currently is:

```typescript
const status = getCellStatus(room.id, ds, bookings, icalBlocks, overrideMap, selection)
```

Replace with:

```typescript
const roomWindowEnd = (() => {
  const days = room.max_advance_booking_days
  if (days == null) return undefined
  if (days === 0) return format(addDays(new Date(), -1), 'yyyy-MM-dd')
  return format(addDays(new Date(), days), 'yyyy-MM-dd')
})()
const status = getCellStatus(room.id, ds, bookings, icalBlocks, overrideMap, selection, roomWindowEnd)
```

Make sure `addDays` and `format` from `date-fns` are imported in CalendarGrid (they may already be). If not, add:

```typescript
import { addDays } from 'date-fns/addDays'
import { format } from 'date-fns/format'
```

- [ ] **Step 5: Add legend entry in the calendar UI (optional but recommended)**

In `components/admin/CalendarClient.tsx`, find the legend section (where booked/blocked/ical legend items are shown). Add:

```tsx
<span className="flex items-center gap-1.5 text-xs text-on-surface-variant">
  <span className="inline-block w-3 h-3 rounded-sm" style={{ background: 'rgba(251,191,36,0.3)', border: '1px solid rgba(251,191,36,0.5)' }} />
  Beyond booking window
</span>
```

- [ ] **Step 6: Type-check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add components/admin/CalendarGrid.tsx components/admin/CalendarClient.tsx
git commit -m "feat: show window-exceeded state in admin CalendarGrid"
```

---

## Task 8: Booking API Server Validation

**Files:**
- Modify: `app/api/bookings/route.ts:80-101`

- [ ] **Step 1: Include new fields in the room select query**

Find the room fetch (around line 80-86):

```typescript
const { data: room, error: roomError } = await supabase
  .from('rooms')
  .select('nightly_rate, monthly_rate, cleaning_fee, security_deposit, extra_guest_fee, property:properties(platform_fee_percent, stripe_account:stripe_accounts(stripe_account_id))')
  .eq('id', room_id)
  .eq('is_active', true)
  .single()
```

Add the new fields to the select string:

```typescript
.select('nightly_rate, monthly_rate, cleaning_fee, security_deposit, extra_guest_fee, max_advance_booking_days, max_advance_booking_applies_to, property:properties(platform_fee_percent, stripe_account:stripe_accounts(stripe_account_id))')
```

- [ ] **Step 2: Add validation after the room is fetched**

After the `if (roomError || !room)` guard (around line 91), add the window validation before the `nightCount` check:

```typescript
    // Validate advance booking window
    const windowDays = room.max_advance_booking_days
    const windowAppliesTo = (room.max_advance_booking_applies_to as string | null) ?? 'both'
    const windowApplies = windowAppliesTo === 'both' || windowAppliesTo === booking_type
    if (windowDays !== null && windowDays !== undefined && windowApplies) {
      if (windowDays === 0) {
        return NextResponse.json({ error: 'This room is not currently accepting reservations.' }, { status: 409 })
      }
      const todayMs = startOfDay(new Date())
      const windowEndMs = addDays(todayMs, windowDays)
      const checkInMs = parseISO(check_in)
      if (isAfter(checkInMs, windowEndMs)) {
        return NextResponse.json(
          { error: `Check-in must be within ${windowDays} days of today.` },
          { status: 409 },
        )
      }
    }
```

Make sure these date-fns functions are imported at the top of the file. Check existing imports and add any missing ones:

```typescript
import { startOfDay, isAfter } from 'date-fns'
// addDays and parseISO likely already imported
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/bookings/route.ts
git commit -m "feat: validate advance booking window in booking creation API"
```

---

## Self-Review

**Spec coverage check:**

| Requirement | Covered by |
|-------------|------------|
| Per-room setting | Task 1 (DB), Task 2 (types), Task 3 (API), Task 4 (form) |
| Custom days input + presets (30/60/90/6mo/1yr) | Task 4 (WINDOW_PRESETS + custom input) |
| Applies to short-term, long-term, or both | Task 4 (advanceAppliesTo), Task 5 (shortTermWindowEnd/longTermWindowEnd), Task 8 (windowAppliesTo) |
| Admin calendar respects limit | Task 7 (window-exceeded state) |
| Default 6 months (182 days) | Task 1 (UPDATE rooms SET), Task 3 (API defaults), Task 4 (initial state) |
| "All blocked" = 0 days, room stays active | Task 1 (0 allowed), Task 5 (currentTypeBlocked message), Task 7 (window-exceeded for all cells), Task 8 (windowDays === 0 → 409) |
| Public booking widget enforces window | Task 5 (max= on DatePickers) |
| Public calendar enforces window | Task 6 (windowEnd prop, MonthGrid) |
| Server-side validation (bypass prevention) | Task 8 |

**No placeholders found** — all steps include full code.

**Type consistency check:**
- `max_advance_booking_days: number | null` — consistent across DB, types, form state, API, widget
- `max_advance_booking_applies_to: 'short_term' | 'long_term' | 'both'` — consistent throughout
- `windowEnd: string | undefined` — consistent in CalendarGrid, AvailabilityCalendar, room page
- `shortTermWindowEnd` / `longTermWindowEnd: string | undefined` — used only in BookingWidget (Task 5)
