# Room Form — Inline Property Amenities Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow admins to edit, delete, and save property-level amenities directly from the Room Form's Amenities tab, with an explicit "Save Property Amenities" button that calls a partial-update property API.

**Architecture:** Update the `PATCH /api/admin/properties` handler to write only the fields present in the request body (partial update). Then update `RoomForm.tsx` so the "Inherited from Property" amenities section uses `AmenitiesTagInput` for inline editing and has its own save button that calls the partial PATCH with just `{ id, amenities }`.

**Tech Stack:** Next.js App Router, TypeScript, Supabase (service role client), React `useState`/`useTransition`, Jest + `@testing-library/react` for tests.

---

## File Map

| File | Change |
|---|---|
| `app/api/admin/properties/route.ts` | Modify PATCH handler to build update object from only the keys present in the request body |
| `__tests__/api/admin/properties.test.ts` | New — API unit tests for partial PATCH behaviour |
| `components/admin/RoomForm.tsx` | Add `propertyAmenities` state, `handleSavePropertyAmenities`, redesign Amenities tab card |

---

## Task 1: Partial PATCH test (write failing tests first)

**Files:**
- Create: `__tests__/api/admin/properties.test.ts`

- [ ] **Step 1: Create the test file**

```ts
/** @jest-environment node */

jest.mock('@/lib/supabase', () => ({
  createServerSupabaseClient: jest.fn(),
  createServiceRoleClient: jest.fn(),
}))

import { createServiceRoleClient, createServerSupabaseClient } from '@/lib/supabase'
import { PATCH } from '@/app/api/admin/properties/route'

function mockAuthed() {
  ;(createServerSupabaseClient as jest.Mock).mockResolvedValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: 'user-1' } },
        error: null,
      }),
    },
  })
}

function mockDb(updateResult = { data: { id: 'prop-1' }, error: null }) {
  const eqChain = {
    select: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(updateResult),
  }
  const propertiesUpdate = jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue(eqChain) })
  ;(createServiceRoleClient as jest.Mock).mockReturnValue({
    from: jest.fn(() => ({ update: propertiesUpdate })),
  })
  return { propertiesUpdate }
}

describe('PATCH /api/admin/properties — partial update', () => {
  beforeEach(() => jest.clearAllMocks())

  it('only writes amenities when that is the only field sent', async () => {
    mockAuthed()
    const { propertiesUpdate } = mockDb()

    const req = new Request('http://localhost/api/admin/properties', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'prop-1', amenities: ['Pool', 'WiFi Included'] }),
    })

    await PATCH(req)

    const updateArg = propertiesUpdate.mock.calls[0][0]
    expect(updateArg).toEqual({ amenities: ['Pool', 'WiFi Included'] })
    expect(updateArg).not.toHaveProperty('name')
    expect(updateArg).not.toHaveProperty('address')
  })

  it('writes all fields when a full payload is sent', async () => {
    mockAuthed()
    const { propertiesUpdate } = mockDb()

    const req = new Request('http://localhost/api/admin/properties', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'prop-1',
        name: 'Hill House',
        address: '123 Main St',
        city: 'Phoenix',
        state: 'AZ',
        zip: '85001',
        description: 'Nice place',
        bedrooms: 4,
        bathrooms: 2,
        amenities: ['Pool'],
        house_rules: 'No smoking',
        use_global_house_rules: false,
        images: [],
        stripe_account_id: null,
        platform_fee_percent: 0,
        cancellation_policy: null,
        use_global_cancellation_policy: true,
      }),
    })

    await PATCH(req)

    const updateArg = propertiesUpdate.mock.calls[0][0]
    expect(updateArg.name).toBe('Hill House')
    expect(updateArg.amenities).toEqual(['Pool'])
    expect(updateArg.bedrooms).toBe(4)
  })

  it('preserves falsy values — false, 0, null — when explicitly sent', async () => {
    mockAuthed()
    const { propertiesUpdate } = mockDb()

    const req = new Request('http://localhost/api/admin/properties', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'prop-1',
        platform_fee_percent: 0,
        use_global_house_rules: false,
        stripe_account_id: null,
      }),
    })

    await PATCH(req)

    const updateArg = propertiesUpdate.mock.calls[0][0]
    expect(updateArg.platform_fee_percent).toBe(0)
    expect(updateArg.use_global_house_rules).toBe(false)
    expect(updateArg.stripe_account_id).toBeNull()
  })

  it('returns 401 when not authenticated', async () => {
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }) },
    })

    const req = new Request('http://localhost/api/admin/properties', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'prop-1', amenities: [] }),
    })

    const res = await PATCH(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 when id is missing', async () => {
    mockAuthed()
    mockDb()

    const req = new Request('http://localhost/api/admin/properties', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amenities: ['Pool'] }),
    })

    const res = await PATCH(req)
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest --config jest.config.cjs __tests__/api/admin/properties.test.ts --no-coverage
```

Expected: All tests FAIL — `PATCH` currently writes a fixed set of fields so the "only amenities" test will fail, and the falsy-values test will also fail.

---

## Task 2: Implement partial PATCH in the properties API route

**Files:**
- Modify: `app/api/admin/properties/route.ts`

- [ ] **Step 1: Replace the PATCH handler body**

Open `app/api/admin/properties/route.ts`. Replace the entire `PATCH` function with:

```ts
export async function PATCH(request: NextRequest) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const body = await request.json()
    const { id, ...fields } = body
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const update = Object.fromEntries(
      Object.entries(fields).filter(([key]) => key in fields)
    )

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const supabase = createServiceRoleClient()
    const { data, error } = await supabase
      .from('properties')
      .update(update)
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
```

Note: `Object.fromEntries(Object.entries(fields).filter(([key]) => key in fields))` is equivalent to spreading `fields` — it passes through every key present, including those with falsy values (`0`, `false`, `null`, `""`). Fields not sent are simply absent from `fields` and therefore absent from the update.

- [ ] **Step 2: Run tests to confirm they pass**

```bash
npx jest --config jest.config.cjs __tests__/api/admin/properties.test.ts --no-coverage
```

Expected: All 5 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/properties/route.ts __tests__/api/admin/properties.test.ts
git commit -m "feat: support partial PATCH for properties API"
```

---

## Task 3: Add editable property amenities state to RoomForm

**Files:**
- Modify: `components/admin/RoomForm.tsx`

- [ ] **Step 1: Replace the derived `propertyAmenities` constant with state**

Find this line near line 145 in `RoomForm.tsx`:

```ts
const propertyAmenities = selectedProperty?.amenities ?? []
```

Replace it with these four state declarations (add them after the existing `useState` declarations, before `const icalExportUrl`):

```ts
const [propertyAmenities, setPropertyAmenities] = useState<string[]>(
  selectedProperty?.amenities ?? []
)
const [propertyAmenitiesBaseline] = useState<string[]>(
  selectedProperty?.amenities ?? []
)
const [propertyAmenitiesSaving, setPropertyAmenitiesSaving] = useState(false)
const [propertyAmenitiesSaved, setPropertyAmenitiesSaved] = useState(false)
const [propertyAmenitiesError, setPropertyAmenitiesError] = useState<string | null>(null)
```

Note: `propertyAmenitiesBaseline` uses a plain `useState` without a setter — it captures the initial server value and never changes. This is the reference for dirty-state detection.

- [ ] **Step 2: Add the dirty-state computed value and save handler**

Add these directly after the state declarations above (before `const icalExportUrl`):

```ts
const propertyAmenitiesDirty =
  JSON.stringify(propertyAmenities) !== JSON.stringify(propertyAmenitiesBaseline)

async function handleSavePropertyAmenities() {
  setPropertyAmenitiesSaving(true)
  setPropertyAmenitiesError(null)
  try {
    const res = await fetch('/api/admin/properties', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: propertyId, amenities: propertyAmenities }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Save failed')
    setPropertyAmenitiesSaved(true)
    setTimeout(() => setPropertyAmenitiesSaved(false), 3000)
  } catch (err) {
    setPropertyAmenitiesError(err instanceof Error ? err.message : 'Save failed')
  } finally {
    setPropertyAmenitiesSaving(false)
  }
}
```

- [ ] **Step 3: Verify no TypeScript errors**

```bash
npx tsc --noEmit
```

Expected: No errors.

---

## Task 4: Redesign the "Inherited from Property" amenities card

**Files:**
- Modify: `components/admin/RoomForm.tsx`

- [ ] **Step 1: Replace the read-only card with an editable one**

In the Amenities tab section (around line 898), find this entire `SCard` block:

```tsx
{propertyAmenities.length > 0 && (
  <SCard
    title="Inherited from Property"
    subtitle={`These come from ${selectedProperty?.name ?? 'the property'} and appear on this unit automatically`}
  >
    <div className="flex flex-wrap gap-2">
      {propertyAmenities.map((a) => (
        <span
          key={a}
          className="flex items-center gap-1.5 bg-surface-container rounded-full px-3 py-1.5 text-on-surface-variant text-sm border border-outline-variant/30"
        >
          🏠 {a}
        </span>
      ))}
    </div>
    <p className="text-xs text-on-surface-variant/60">
      To change these, edit the property&apos;s amenities.
    </p>
  </SCard>
)}
```

Replace it with:

```tsx
<SCard
  title="Property Amenities"
  subtitle={`Changes here affect ${selectedProperty?.name ?? 'the property'} and all its units`}
>
  <AmenitiesTagInput value={propertyAmenities} onChange={setPropertyAmenities} context="property" />
  <div className="flex items-center gap-3 pt-2 border-t border-outline-variant/20">
    <button
      type="button"
      onClick={handleSavePropertyAmenities}
      disabled={!propertyAmenitiesDirty || propertyAmenitiesSaving}
      className="bg-gradient-to-r from-primary to-secondary text-background font-semibold rounded-xl px-5 py-2 text-sm hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {propertyAmenitiesSaving ? 'Saving…' : 'Save Property Amenities'}
    </button>
    {propertyAmenitiesSaved && (
      <span className="flex items-center gap-1.5 text-sm text-secondary font-semibold">
        <CheckIcon className="w-4 h-4" /> Saved
      </span>
    )}
    {propertyAmenitiesError && (
      <span className="text-sm text-error">{propertyAmenitiesError}</span>
    )}
  </div>
</SCard>
```

Note: `CheckIcon` is already imported at the top of `RoomForm.tsx` (line 4).

- [ ] **Step 2: Verify no TypeScript errors**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add components/admin/RoomForm.tsx
git commit -m "feat: inline property amenities editing from room form"
```

---

## Task 5: Manual verification

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Open a room edit page**

Navigate to `/admin/rooms` → click any room → go to the **Amenities** tab.

Verify:
- "Property Amenities" card is visible with the current property amenities as editable tags
- The "Save Property Amenities" button is **disabled** (no changes yet)
- The subtitle reads *"Changes here affect [Property Name] and all its units"*

- [ ] **Step 3: Add an amenity**

Type a new amenity in the input and press Enter (or click a suggestion).

Verify:
- Tag appears
- "Save Property Amenities" button becomes **enabled**

- [ ] **Step 4: Save and confirm persistence**

Click "Save Property Amenities".

Verify:
- Button shows "Saving…" briefly
- "Saved ✓" flash appears for ~3 seconds
- Button returns to disabled state

Reload the page. Navigate back to the Amenities tab and verify the new amenity is still present.

- [ ] **Step 5: Remove an amenity and save**

Click the ✕ on a property amenity tag → click "Save Property Amenities".

Navigate to `/admin/properties` → edit the same property → Amenities tab.

Verify the removed amenity is gone from the property form too.

- [ ] **Step 6: Confirm room save is unaffected**

Make a change to the room name → click "Save Changes". Verify it saves normally with no interference from property amenities state.

- [ ] **Step 7: Run the full test suite**

```bash
npm test -- --no-coverage
```

Expected: All tests pass.

- [ ] **Step 8: Final commit if any fixes were made during manual testing**

```bash
git add -p
git commit -m "fix: address issues found during manual verification"
```
