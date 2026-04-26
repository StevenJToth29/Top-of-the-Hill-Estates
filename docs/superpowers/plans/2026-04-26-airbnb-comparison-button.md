# Airbnb Comparison Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow admins to link each room to its Airbnb listing; show a comparison button on the public booking widget that pre-fills dates and guests in the Airbnb URL.

**Architecture:** Store only the numeric Airbnb listing ID in the DB. Two pure utility functions (`extractAirbnbListingId`, `buildAirbnbUrl`) in `lib/airbnb.ts` handle all parsing and URL construction and are unit-tested in isolation. The admin form accepts a full URL or bare ID and extracts the numeric ID on save. The booking widget renders a subtle always-visible link and a prominent button inside the price breakdown once dates are selected.

**Tech Stack:** Next.js App Router, Supabase PostgreSQL, TypeScript, React, Tailwind CSS, Jest

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `supabase/migrations/031_add_airbnb_listing_id.sql` | Create | Add nullable `airbnb_listing_id` column to `rooms` |
| `types/index.ts` | Modify | Add `airbnb_listing_id?: string \| null` to `Room` interface |
| `lib/airbnb.ts` | Create | Pure functions: extract ID from URL/string, build Airbnb URL |
| `__tests__/lib/airbnb.test.ts` | Create | Unit tests for both utility functions |
| `components/admin/RoomForm.tsx` | Modify | Add Airbnb listing input field with validation and preview |
| `components/public/BookingWidget.tsx` | Modify | Add always-visible link + date-selected prominent button |

---

### Task 1: DB Migration

**Files:**
- Create: `supabase/migrations/031_add_airbnb_listing_id.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/031_add_airbnb_listing_id.sql
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS airbnb_listing_id TEXT DEFAULT NULL;
```

- [ ] **Step 2: Apply the migration**

```bash
npx supabase db push
```

Expected: Migration applied with no errors. If using MCP, use `mcp__supabase__apply_migration` with the SQL above.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/031_add_airbnb_listing_id.sql
git commit -m "feat: add airbnb_listing_id column to rooms table"
```

---

### Task 2: TypeScript Types

**Files:**
- Modify: `types/index.ts` — `Room` interface (lines 29–70)

- [ ] **Step 1: Add the field to the Room interface**

Find the `Room` interface in `types/index.ts`. Locate the line:
```ts
  iframe_booking_url?: string | null
```
Add directly after it:
```ts
  airbnb_listing_id?: string | null
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add types/index.ts
git commit -m "feat: add airbnb_listing_id to Room type"
```

---

### Task 3: Utility Functions + Tests

**Files:**
- Create: `lib/airbnb.ts`
- Create: `__tests__/lib/airbnb.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/lib/airbnb.test.ts`:

```ts
import { extractAirbnbListingId, buildAirbnbUrl } from '@/lib/airbnb'

describe('extractAirbnbListingId', () => {
  it('extracts ID from a full Airbnb URL with query params', () => {
    expect(
      extractAirbnbListingId(
        'https://www.airbnb.com/rooms/1234804626518653126?check_in=2026-04-26&guests=2'
      )
    ).toBe('1234804626518653126')
  })

  it('extracts ID from a bare Airbnb URL', () => {
    expect(extractAirbnbListingId('https://www.airbnb.com/rooms/9876543210')).toBe('9876543210')
  })

  it('returns a bare numeric string as-is', () => {
    expect(extractAirbnbListingId('1234804626518653126')).toBe('1234804626518653126')
  })

  it('returns null for an empty string', () => {
    expect(extractAirbnbListingId('')).toBeNull()
  })

  it('returns null for whitespace-only input', () => {
    expect(extractAirbnbListingId('   ')).toBeNull()
  })

  it('returns null for a non-Airbnb URL', () => {
    expect(extractAirbnbListingId('https://www.vrbo.com/rooms/123')).toBeNull()
  })

  it('returns null for a non-numeric string', () => {
    expect(extractAirbnbListingId('not-a-listing')).toBeNull()
  })

  it('trims whitespace before parsing', () => {
    expect(extractAirbnbListingId('  1234804626518653126  ')).toBe('1234804626518653126')
  })
})

describe('buildAirbnbUrl', () => {
  it('builds a bare listing URL when no params given', () => {
    expect(buildAirbnbUrl('12345')).toBe('https://www.airbnb.com/rooms/12345')
  })

  it('includes check_in and check_out when provided', () => {
    const url = buildAirbnbUrl('12345', { checkIn: '2026-04-26', checkOut: '2026-04-29' })
    expect(url).toContain('check_in=2026-04-26')
    expect(url).toContain('check_out=2026-04-29')
  })

  it('includes guests and adults when guests provided', () => {
    const url = buildAirbnbUrl('12345', { guests: 2 })
    expect(url).toContain('guests=2')
    expect(url).toContain('adults=2')
  })

  it('omits date params when only guests provided', () => {
    const url = buildAirbnbUrl('12345', { guests: 1 })
    expect(url).not.toContain('check_in')
    expect(url).not.toContain('check_out')
  })

  it('omits guest params when guests is 0 or undefined', () => {
    const url = buildAirbnbUrl('12345', { checkIn: '2026-04-26', checkOut: '2026-04-29', guests: 0 })
    expect(url).not.toContain('guests')
    expect(url).not.toContain('adults')
  })

  it('handles only checkIn (long-term move-in with no checkout)', () => {
    const url = buildAirbnbUrl('12345', { checkIn: '2026-05-01', guests: 2 })
    expect(url).toContain('check_in=2026-05-01')
    expect(url).not.toContain('check_out')
    expect(url).toContain('guests=2')
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test -- --testPathPattern=__tests__/lib/airbnb
```

Expected: FAIL — "Cannot find module '@/lib/airbnb'"

- [ ] **Step 3: Implement the utility functions**

Create `lib/airbnb.ts`:

```ts
export function extractAirbnbListingId(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  const urlMatch = trimmed.match(/\/rooms\/(\d+)/)
  if (urlMatch) return urlMatch[1]
  if (/^\d+$/.test(trimmed)) return trimmed
  return null
}

export function buildAirbnbUrl(
  listingId: string,
  params?: { checkIn?: string; checkOut?: string; guests?: number },
): string {
  const url = new URL(`https://www.airbnb.com/rooms/${listingId}`)
  if (params?.checkIn) url.searchParams.set('check_in', params.checkIn)
  if (params?.checkOut) url.searchParams.set('check_out', params.checkOut)
  if (params?.guests && params.guests > 0) {
    url.searchParams.set('guests', String(params.guests))
    url.searchParams.set('adults', String(params.guests))
  }
  return url.toString()
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm test -- --testPathPattern=__tests__/lib/airbnb
```

Expected: All 13 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/airbnb.ts __tests__/lib/airbnb.test.ts
git commit -m "feat: add airbnb utility functions with tests"
```

---

### Task 4: Admin RoomForm Field

**Files:**
- Modify: `components/admin/RoomForm.tsx`

The "Booking Widget" SCard is at approximately line 1051. The Airbnb field goes in a new SCard inserted immediately after the closing `</SCard>` of the "Booking Widget" card (around line 1066), before the error block.

- [ ] **Step 1: Add the import for extractAirbnbListingId**

At the top of `components/admin/RoomForm.tsx`, find the existing imports and add:

```ts
import { extractAirbnbListingId } from '@/lib/airbnb'
```

- [ ] **Step 2: Add state for the Airbnb input**

Find the line (around line 140):
```ts
const [iframeBookingUrl, setIframeBookingUrl] = useState(room?.iframe_booking_url ?? '')
```
Add directly after it:
```ts
const [airbnbInput, setAirbnbInput] = useState(room?.airbnb_listing_id ?? '')
```

- [ ] **Step 3: Add the derived listing ID**

Directly after the new state line, add:
```ts
const airbnbListingId = extractAirbnbListingId(airbnbInput)
```

- [ ] **Step 4: Include in the save payload**

Find the line in the save/upsert object (around line 299):
```ts
      iframe_booking_url: iframeBookingUrl || null,
```
Add directly after it:
```ts
      airbnb_listing_id: airbnbListingId,
```

- [ ] **Step 5: Add the Airbnb SCard to the form**

Find the closing tag of the "Booking Widget" SCard:
```tsx
            </SCard>
          </div>
        )}

        {/* Error */}
```

Insert a new SCard between `</SCard>` and `{/* Error */}`:

```tsx
            </SCard>

            <SCard title="Airbnb Comparison" subtitle="Link this unit's Airbnb listing so guests can compare prices">
              <p className="text-xs text-on-surface-variant/60">
                Paste the Airbnb listing URL or bare listing ID. The comparison button will appear on the booking widget.
              </p>
              <div>
                <label className={labelClass}>Airbnb Listing URL or ID</label>
                <input
                  type="text"
                  value={airbnbInput}
                  onChange={(e) => setAirbnbInput(e.target.value)}
                  placeholder="https://www.airbnb.com/rooms/1234804626518653126 or 1234804626518653126"
                  className={inputClass}
                />
                {airbnbInput && !airbnbListingId && (
                  <p className="text-xs text-error mt-1">Enter a valid Airbnb listing URL or numeric listing ID.</p>
                )}
                {airbnbListingId && (
                  <p className="text-xs text-on-surface-variant mt-1">
                    Preview:{' '}
                    <a
                      href={`https://www.airbnb.com/rooms/${airbnbListingId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-secondary underline"
                    >
                      airbnb.com/rooms/{airbnbListingId}
                    </a>
                  </p>
                )}
              </div>
            </SCard>
          </div>
        )}

        {/* Error */}
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add components/admin/RoomForm.tsx
git commit -m "feat: add Airbnb listing field to room admin form"
```

---

### Task 5: BookingWidget — Airbnb Comparison Buttons

**Files:**
- Modify: `components/public/BookingWidget.tsx`

The widget has three insertion points:
1. Short-term price breakdown — just before "Due today" border line (~line 299)
2. Long-term price breakdown — just before "Due today" border line (~line 363)
3. Bottom of widget — after the approval note (~line 389)

- [ ] **Step 1: Add imports**

At the top of `components/public/BookingWidget.tsx`, find the existing imports and add:

```ts
import { buildAirbnbUrl } from '@/lib/airbnb'
```

- [ ] **Step 2: Add the AirbnbLogoIcon component**

After the imports (before the `const pillBase = ...` line), add:

```tsx
function AirbnbLogoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M16 2C9.373 2 4 7.373 4 14c0 2.95 1.05 5.66 2.785 7.775L16 30l9.215-8.225C27.05 19.66 28 16.95 28 14c0-6.627-5.373-12-12-12zm0 16a5 5 0 110-10 5 5 0 010 10z" />
    </svg>
  )
}
```

- [ ] **Step 3: Add prominent button in short-term price breakdown**

Find this block in the short-term section (around line 299):
```tsx
              <div className="flex justify-between pt-2 border-t border-outline-variant">
                <span className="text-on-surface font-medium">Due today</span>
                <span className="text-primary font-bold text-lg">${stTotal.toLocaleString()}</span>
              </div>
              <p className="text-xs text-on-surface-variant/60 italic">Processing fee added at checkout</p>
```

Insert the Airbnb button **before** that block (before the `<div className="flex justify-between pt-2 border-t ...`):

```tsx
              {room.airbnb_listing_id && (
                <a
                  href={buildAirbnbUrl(room.airbnb_listing_id, { checkIn, checkOut, guests })}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full border border-secondary/50 text-secondary rounded-xl py-2 text-sm font-medium hover:bg-secondary/5 transition-colors"
                >
                  <AirbnbLogoIcon className="w-4 h-4 text-[#FF5A5F]" />
                  See these dates on Airbnb ↗
                </a>
              )}
              <div className="flex justify-between pt-2 border-t border-outline-variant">
```

- [ ] **Step 4: Add prominent button in long-term price breakdown**

Find this block in the long-term section (around line 363):
```tsx
              <div className="flex justify-between pt-2 border-t border-outline-variant">
                <span className="text-on-surface font-medium">Due today</span>
                <span className="text-primary font-bold text-2xl">${ltTotal.toLocaleString()}</span>
              </div>
              <p className="text-xs text-on-surface-variant/60 italic">Processing fee added at checkout</p>
```

Insert the Airbnb button **before** that block:

```tsx
              {room.airbnb_listing_id && (
                <a
                  href={buildAirbnbUrl(room.airbnb_listing_id, { checkIn: moveIn, guests })}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full border border-secondary/50 text-secondary rounded-xl py-2 text-sm font-medium hover:bg-secondary/5 transition-colors"
                >
                  <AirbnbLogoIcon className="w-4 h-4 text-[#FF5A5F]" />
                  Compare on Airbnb ↗
                </a>
              )}
              <div className="flex justify-between pt-2 border-t border-outline-variant">
```

- [ ] **Step 5: Add always-visible subtle link at the bottom**

Find the closing of the widget (around line 387):
```tsx
      <p className="text-center text-xs text-on-surface-variant mt-2">
        Bookings require admin approval. You will not be charged until approved.
      </p>
    </div>
  )
}
```

Insert the subtle link **after** that `<p>` and before the closing `</div>`:

```tsx
      <p className="text-center text-xs text-on-surface-variant mt-2">
        Bookings require admin approval. You will not be charged until approved.
      </p>
      {room.airbnb_listing_id && (
        <a
          href={buildAirbnbUrl(
            room.airbnb_listing_id,
            checkIn && checkOut
              ? { checkIn, checkOut, guests }
              : moveIn
              ? { checkIn: moveIn, guests }
              : undefined,
          )}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 text-xs text-on-surface-variant hover:text-[#FF5A5F] transition-colors"
        >
          <AirbnbLogoIcon className="w-3.5 h-3.5 text-[#FF5A5F]" />
          Compare on Airbnb
          <span aria-hidden="true">↗</span>
        </a>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 7: Run all tests**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 8: Commit**

```bash
git add components/public/BookingWidget.tsx
git commit -m "feat: add Airbnb comparison buttons to booking widget"
```

---

## Manual Verification Checklist

After all tasks are complete:

1. Go to admin → a room → scroll to the bottom of any tab that shows the "Airbnb Comparison" card
2. Paste `https://www.airbnb.com/rooms/1234804626518653126?check_in=2026-04-26&guests=2` — verify preview link shows `airbnb.com/rooms/1234804626518653126`
3. Save the room
4. Go to the public room page → verify the subtle "Compare on Airbnb ↗" link appears at the bottom of the booking widget
5. Select check-in and check-out dates → verify the "See these dates on Airbnb ↗" button appears in the price breakdown
6. Click it → verify a new tab opens with the correct dates and guest count pre-filled
7. Switch to long-term tab → select a move-in date → verify "Compare on Airbnb ↗" appears in the long-term breakdown
8. Go to a room with **no** `airbnb_listing_id` → verify no Airbnb button appears anywhere
