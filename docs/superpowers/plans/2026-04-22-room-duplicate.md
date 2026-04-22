# Room Duplicate Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins duplicate a room from the room list page via a modal that collects a new name, then creates the copy with all settings transferred and unique fields reset.

**Architecture:** A dedicated `POST /api/admin/rooms/[id]/duplicate` endpoint reads the source room + fees server-side, resets identity fields, and inserts the new records. A `DuplicateRoomModal` client component handles the name input and submission. `RoomCardWithIcal` gains a Duplicate button that opens the modal.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase (service role client), React, Tailwind CSS, Jest (node environment), `@heroicons/react`

---

## File Map

| Action | Path | Purpose |
|---|---|---|
| Create | `lib/slugify.ts` | Shared slugify utility (extracted from RoomForm) |
| Modify | `components/admin/RoomForm.tsx:20-25` | Import slugify from `@/lib/slugify` instead of local def |
| Create | `app/api/admin/rooms/[id]/duplicate/route.ts` | POST endpoint — reads source, inserts copy |
| Create | `components/admin/DuplicateRoomModal.tsx` | Modal: name input, slug preview, submit, error |
| Modify | `app/admin/(protected)/rooms/RoomCardWithIcal.tsx` | Add Duplicate button + modal state |
| Create | `__tests__/api/admin/rooms-duplicate.test.ts` | Unit tests for duplicate endpoint |

---

## Task 1: Extract slugify to a shared lib

**Files:**
- Create: `lib/slugify.ts`
- Modify: `components/admin/RoomForm.tsx`

- [ ] **Step 1: Create `lib/slugify.ts`**

```ts
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
```

- [ ] **Step 2: Update `RoomForm.tsx` to import from the shared lib**

Remove lines 20–25 in `components/admin/RoomForm.tsx` (the local `slugify` function definition):

```ts
function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
```

Add this import at the top of the file (after the existing imports):

```ts
import { slugify } from '@/lib/slugify'
```

- [ ] **Step 3: Verify the dev server still compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add lib/slugify.ts components/admin/RoomForm.tsx
git commit -m "refactor: extract slugify to shared lib"
```

---

## Task 2: Duplicate API endpoint (TDD)

**Files:**
- Create: `__tests__/api/admin/rooms-duplicate.test.ts`
- Create: `app/api/admin/rooms/[id]/duplicate/route.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/api/admin/rooms-duplicate.test.ts`:

```ts
/** @jest-environment node */

jest.mock('@/lib/supabase', () => ({
  createServerSupabaseClient: jest.fn(),
  createServiceRoleClient: jest.fn(),
}))

import { createServiceRoleClient, createServerSupabaseClient } from '@/lib/supabase'
import { POST } from '@/app/api/admin/rooms/[id]/duplicate/route'

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

function mockUnauthed() {
  ;(createServerSupabaseClient as jest.Mock).mockResolvedValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      }),
    },
  })
}

const sourceRoom = {
  id: 'room-src',
  property_id: 'prop-1',
  name: 'Mountain Suite',
  slug: 'mountain-suite',
  short_description: 'A cozy suite',
  description: 'Full description',
  guest_capacity: 2,
  bedrooms: 1,
  bathrooms: 1,
  nightly_rate: 150,
  monthly_rate: 3000,
  show_nightly_rate: true,
  show_monthly_rate: false,
  minimum_nights_short_term: 2,
  minimum_nights_long_term: 30,
  is_active: true,
  amenities: ['WiFi', 'Parking'],
  images: ['img1.jpg'],
  cleaning_fee: 80,
  security_deposit: 300,
  extra_guest_fee: 20,
  cancellation_window_hours: 48,
  cancellation_policy: null,
  use_property_cancellation_policy: true,
  price_min: null,
  price_max: null,
  ical_export_token: 'old-token-uuid',
}

const sourceFees = [
  { id: 'fee-1', room_id: 'room-src', label: 'Pet fee', amount: 25, booking_type: 'both' },
]

function createDbMocks({
  roomFetchError = null,
  insertError = null,
  feesInsertError = null,
} = {}) {
  const roomSelectChain = {
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(
      roomFetchError
        ? { data: null, error: { message: roomFetchError } }
        : { data: sourceRoom, error: null }
    ),
  }
  const feesSelectChain = {
    eq: jest.fn().mockResolvedValue({ data: sourceFees, error: null }),
  }
  const insertChain = {
    select: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(
      insertError
        ? { data: null, error: { message: insertError } }
        : { data: { id: 'room-new' }, error: null }
    ),
  }
  const roomsInsert = jest.fn().mockReturnValue(insertChain)
  const feesInsert = jest.fn().mockResolvedValue(
    feesInsertError ? { error: { message: feesInsertError } } : { error: null }
  )

  ;(createServiceRoleClient as jest.Mock).mockReturnValue({
    from: jest.fn((table: string) => {
      if (table === 'rooms') return { select: jest.fn().mockReturnValue(roomSelectChain), insert: roomsInsert }
      if (table === 'room_fees') return { select: jest.fn().mockReturnValue(feesSelectChain), insert: feesInsert }
    }),
  })

  return { roomsInsert, feesInsert }
}

function makeRequest(id: string, body: object) {
  return new Request(`http://localhost/api/admin/rooms/${id}/duplicate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/rooms/[id]/duplicate', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockUnauthed()
    createDbMocks()
    const res = await POST(makeRequest('room-src', { name: 'Copy' }), { params: Promise.resolve({ id: 'room-src' }) })
    expect(res.status).toBe(401)
  })

  it('returns 404 when source room does not exist', async () => {
    mockAuthed()
    createDbMocks({ roomFetchError: 'Not found' })
    const res = await POST(makeRequest('bad-id', { name: 'Copy' }), { params: Promise.resolve({ id: 'bad-id' }) })
    expect(res.status).toBe(404)
  })

  it('returns 400 when name is missing or empty', async () => {
    mockAuthed()
    createDbMocks()
    const res = await POST(makeRequest('room-src', { name: '  ' }), { params: Promise.resolve({ id: 'room-src' }) })
    expect(res.status).toBe(400)
  })

  it('inserts new room with correct fields and a derived slug', async () => {
    mockAuthed()
    const { roomsInsert } = createDbMocks()
    const res = await POST(makeRequest('room-src', { name: 'Garden Cottage' }), { params: Promise.resolve({ id: 'room-src' }) })

    expect(res.status).toBe(200)
    const inserted = roomsInsert.mock.calls[0][0]
    expect(inserted.name).toBe('Garden Cottage')
    expect(inserted.slug).toBe('garden-cottage')
    expect(inserted.property_id).toBe('prop-1')
    expect(inserted.nightly_rate).toBe(150)
    expect(inserted.amenities).toEqual(['WiFi', 'Parking'])
  })

  it('does NOT copy id, ical_export_token, created_at, or updated_at from source', async () => {
    mockAuthed()
    const { roomsInsert } = createDbMocks()
    await POST(makeRequest('room-src', { name: 'New Room' }), { params: Promise.resolve({ id: 'room-src' }) })

    const inserted = roomsInsert.mock.calls[0][0]
    expect(inserted.id).toBeUndefined()
    expect(inserted.ical_export_token).not.toBe('old-token-uuid')
    expect(inserted.ical_export_token).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    )
    expect(inserted.created_at).toBeUndefined()
    expect(inserted.updated_at).toBeUndefined()
  })

  it('copies room_fees to the new room', async () => {
    mockAuthed()
    const { feesInsert } = createDbMocks()
    await POST(makeRequest('room-src', { name: 'New Room' }), { params: Promise.resolve({ id: 'room-src' }) })

    expect(feesInsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ room_id: 'room-new', label: 'Pet fee', amount: 25, booking_type: 'both' }),
      ])
    )
    const feeArg = feesInsert.mock.calls[0][0][0]
    expect(feeArg.id).toBeUndefined()
  })

  it('returns the new room id on success', async () => {
    mockAuthed()
    createDbMocks()
    const res = await POST(makeRequest('room-src', { name: 'New Room' }), { params: Promise.resolve({ id: 'room-src' }) })
    const body = await res.json()
    expect(body.id).toBe('room-new')
  })

  it('returns 500 when room insert fails', async () => {
    mockAuthed()
    createDbMocks({ insertError: 'DB error' })
    const res = await POST(makeRequest('room-src', { name: 'New Room' }), { params: Promise.resolve({ id: 'room-src' }) })
    expect(res.status).toBe(500)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `npx jest __tests__/api/admin/rooms-duplicate.test.ts --no-coverage`
Expected: All tests FAIL with "Cannot find module" or similar — the route doesn't exist yet.

- [ ] **Step 3: Implement the duplicate endpoint**

Create `app/api/admin/rooms/[id]/duplicate/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase'
import { slugify } from '@/lib/slugify'
import { randomUUID } from 'crypto'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const serverClient = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await serverClient.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()
  const name: string = (body.name ?? '').trim()
  if (!name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }

  const supabase = createServiceRoleClient()

  const { data: source, error: fetchError } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !source) {
    return NextResponse.json({ error: 'Room not found' }, { status: 404 })
  }

  const { data: sourceFees } = await supabase
    .from('room_fees')
    .select('*')
    .eq('room_id', id)

  const { data: newRoom, error: insertError } = await supabase
    .from('rooms')
    .insert({
      property_id: source.property_id,
      name,
      slug: slugify(name),
      short_description: source.short_description,
      description: source.description,
      guest_capacity: source.guest_capacity,
      bedrooms: source.bedrooms,
      bathrooms: source.bathrooms,
      nightly_rate: source.nightly_rate,
      monthly_rate: source.monthly_rate,
      show_nightly_rate: source.show_nightly_rate,
      show_monthly_rate: source.show_monthly_rate,
      minimum_nights_short_term: source.minimum_nights_short_term,
      minimum_nights_long_term: source.minimum_nights_long_term,
      is_active: source.is_active,
      amenities: source.amenities,
      images: source.images,
      cleaning_fee: source.cleaning_fee,
      security_deposit: source.security_deposit,
      extra_guest_fee: source.extra_guest_fee,
      cancellation_window_hours: source.cancellation_window_hours,
      cancellation_policy: source.cancellation_policy,
      use_property_cancellation_policy: source.use_property_cancellation_policy,
      price_min: source.price_min,
      price_max: source.price_max,
      ical_export_token: randomUUID(),
    })
    .select('id')
    .single()

  if (insertError || !newRoom) {
    return NextResponse.json({ error: insertError?.message ?? 'Insert failed' }, { status: 500 })
  }

  if (sourceFees && sourceFees.length > 0) {
    const { error: feesError } = await supabase
      .from('room_fees')
      .insert(
        sourceFees.map((f: { label: string; amount: number; booking_type: string }) => ({
          room_id: newRoom.id,
          label: f.label,
          amount: f.amount,
          booking_type: f.booking_type,
        }))
      )
    if (feesError) {
      return NextResponse.json({ error: feesError.message }, { status: 500 })
    }
  }

  return NextResponse.json({ id: newRoom.id })
}
```

- [ ] **Step 4: Run tests to confirm they pass**

Run: `npx jest __tests__/api/admin/rooms-duplicate.test.ts --no-coverage`
Expected: All 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add __tests__/api/admin/rooms-duplicate.test.ts app/api/admin/rooms/[id]/duplicate/route.ts
git commit -m "feat: add POST /api/admin/rooms/[id]/duplicate endpoint"
```

---

## Task 3: DuplicateRoomModal component

**Files:**
- Create: `components/admin/DuplicateRoomModal.tsx`

- [ ] **Step 1: Create the modal component**

Create `components/admin/DuplicateRoomModal.tsx`:

```tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { slugify } from '@/lib/slugify'

interface Props {
  isOpen: boolean
  onClose: () => void
  roomId: string
  roomName: string
}

export default function DuplicateRoomModal({ isOpen, onClose, roomId, roomName }: Props) {
  const router = useRouter()
  const [name, setName] = useState(`${roomName} (Copy)`)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setName(`${roomName} (Copy)`)
      setError(null)
    }
  }, [isOpen, roomName])

  const slug = slugify(name)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/admin/rooms/${roomId}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Something went wrong. Please try again.')
        return
      }

      router.push(`/admin/rooms/${data.id}/edit`)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-background rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-on-surface">Duplicate Room</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-on-surface-variant mb-5">
          Duplicating: <span className="font-medium text-on-surface">{roomName}</span>
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-on-surface mb-1.5">
              New Room Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-outline-variant bg-surface px-3 py-2 text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-secondary/50"
              autoFocus
            />
            <p className="mt-1.5 text-xs text-on-surface-variant/60">
              Slug: <span className="font-mono">{slug || '—'}</span>
            </p>
          </div>

          {error && (
            <p className="text-sm text-error bg-error-container/20 rounded-xl px-3 py-2">{error}</p>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm rounded-xl text-on-surface-variant hover:bg-surface-container transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="px-4 py-2 text-sm rounded-xl bg-secondary text-on-secondary font-medium hover:bg-secondary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {loading && (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
              )}
              Duplicate
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add components/admin/DuplicateRoomModal.tsx
git commit -m "feat: add DuplicateRoomModal component"
```

---

## Task 4: Wire up Duplicate button in RoomCardWithIcal

**Files:**
- Modify: `app/admin/(protected)/rooms/RoomCardWithIcal.tsx`

- [ ] **Step 1: Update `RoomCardWithIcal.tsx`**

Replace the entire file contents with:

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PencilSquareIcon, ArrowPathIcon, ChevronDownIcon, DocumentDuplicateIcon } from '@heroicons/react/24/outline'
import RoomStatusToggle from './RoomStatusToggle'
import ICalSyncPanel from '@/components/admin/ICalSyncPanel'
import DuplicateRoomModal from '@/components/admin/DuplicateRoomModal'
import type { Room, Property, ICalSource } from '@/types'

type RoomWithIcal = Room & { property: Property; ical_sources: ICalSource[] }

interface Props {
  room: RoomWithIcal
  siteUrl: string
}

export default function RoomCardWithIcal({ room, siteUrl }: Props) {
  const [icalOpen, setIcalOpen] = useState(false)
  const [duplicateOpen, setDuplicateOpen] = useState(false)

  return (
    <div>
      <div className="flex items-center gap-4 px-6 py-4">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-on-surface truncate">{room.name}</p>
          <p className="text-sm text-on-surface-variant/60 mt-0.5">
            ${room.nightly_rate}/night · ${room.monthly_rate}/mo ·{' '}
            {room.bedrooms}bd / {room.bathrooms}ba
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span
            className={`text-xs rounded-full px-2.5 py-1 font-medium ${
              room.is_active
                ? 'bg-secondary/10 text-secondary'
                : 'bg-error-container/30 text-error'
            }`}
          >
            {room.is_active ? 'Active' : 'Inactive'}
          </span>

          <RoomStatusToggle roomId={room.id} isActive={room.is_active} />

          <Link
            href={`/admin/rooms/${room.id}/edit`}
            className="flex items-center gap-1.5 text-sm bg-surface-container rounded-xl px-3 py-1.5 text-on-surface-variant hover:bg-surface-high transition-colors"
          >
            <PencilSquareIcon className="w-4 h-4" />
            Edit
          </Link>

          <button
            type="button"
            onClick={() => setDuplicateOpen(true)}
            className="flex items-center gap-1.5 text-sm bg-surface-container rounded-xl px-3 py-1.5 text-on-surface-variant hover:bg-surface-high transition-colors"
          >
            <DocumentDuplicateIcon className="w-4 h-4" />
            Duplicate
          </button>

          <button
            type="button"
            onClick={() => setIcalOpen((o) => !o)}
            className={`flex items-center gap-1.5 text-sm rounded-xl px-3 py-1.5 transition-colors ${
              icalOpen
                ? 'bg-secondary/10 text-secondary'
                : 'bg-surface-container text-on-surface-variant hover:bg-surface-high'
            }`}
          >
            <ArrowPathIcon className="w-4 h-4" />
            iCal
            <ChevronDownIcon
              className={`w-3 h-3 transition-transform duration-200 ${icalOpen ? 'rotate-180' : ''}`}
            />
          </button>
        </div>
      </div>

      {icalOpen && (
        <div className="px-6 pb-6 pt-2 border-t border-outline-variant/40 bg-surface-container/20">
          <ICalSyncPanel room={room} siteUrl={siteUrl} />
        </div>
      )}

      <DuplicateRoomModal
        isOpen={duplicateOpen}
        onClose={() => setDuplicateOpen(false)}
        roomId={room.id}
        roomName={room.name}
      />
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Run the full test suite to check for regressions**

Run: `npx jest --no-coverage`
Expected: All tests pass, no regressions.

- [ ] **Step 4: Commit**

```bash
git add app/admin/(protected)/rooms/RoomCardWithIcal.tsx
git commit -m "feat: add Duplicate button to room list cards"
```

---

## Task 5: Manual smoke test

- [ ] **Step 1: Open the admin rooms list at `http://localhost:3000/admin/rooms`**

Confirm each room card now shows a "Duplicate" button alongside Edit and iCal.

- [ ] **Step 2: Click Duplicate on any room**

Confirm:
- Modal opens showing "Duplicating: [Room Name]"
- Name input is pre-filled with "[Room Name] (Copy)"
- Slug preview updates as you type

- [ ] **Step 3: Change the name and click Duplicate**

Confirm:
- Button shows a spinner while submitting
- On success, browser redirects to `/admin/rooms/[newId]/edit`
- The edit form is populated with all settings from the source room
- The name matches what you typed in the modal

- [ ] **Step 4: Verify the new room in the rooms list**

Go back to `/admin/rooms` and confirm the duplicated room appears with the correct name and settings.
