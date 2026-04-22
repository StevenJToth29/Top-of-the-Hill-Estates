# Long-Term Inquiry Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a guest selects the long-term booking tab and clicks the action button, route them to `/apply` — a lead-capture page that submits their info to GHL — instead of the Stripe checkout flow.

**Architecture:** BookingWidget detects `bookingType === 'long_term'` on click and navigates to `/apply?room=<slug>&move_in=<date>&occupants=<count>`. The `/apply` page server-fetches the room and renders `LongTermInquiryForm`. On submit, `POST /api/inquiries` calls a new `syncLongTermInquiryToGHL()` in `lib/ghl.ts` (reusing `GHL_CONTACT_WEBHOOK_URL` with a `long-term-inquiry` tag). Success navigates to `/apply/confirmation`.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, GoHighLevel API v2, Jest + React Testing Library

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `components/public/BookingWidget.tsx` | Route long-term clicks to `/apply` instead of `/checkout`; rename button |
| Add fn  | `lib/ghl.ts` | `syncLongTermInquiryToGHL()` — upsert GHL contact + webhook with `long-term-inquiry` tag |
| Create | `app/api/inquiries/route.ts` | `POST` handler — validate fields, call GHL sync, return `{ success: true }` |
| Create | `components/public/LongTermInquiryForm.tsx` | Client form (6 fields + consent), posts to `/api/inquiries` |
| Create | `app/(public)/apply/page.tsx` | Server page — fetches room, renders summary + form |
| Create | `app/(public)/apply/confirmation/page.tsx` | Static thank-you page |
| Create | `__tests__/api/inquiries.test.ts` | Unit tests for the API route |

---

## Task 1: Write failing test for `POST /api/inquiries`

**Files:**
- Create: `__tests__/api/inquiries.test.ts`

- [ ] **Step 1: Create the test file**

```typescript
/** @jest-environment node */

jest.mock('@/lib/ghl', () => ({
  syncLongTermInquiryToGHL: jest.fn().mockResolvedValue(undefined),
}))

import { syncLongTermInquiryToGHL } from '@/lib/ghl'
import { POST } from '@/app/api/inquiries/route'

function makeRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/inquiries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const validBody = {
  first_name: 'Jane',
  last_name: 'Smith',
  email: 'jane@example.com',
  phone: '5550000000',
  move_in: '2026-06-01',
  occupants: 2,
  room_slug: 'cozy-studio',
  room_name: 'Cozy Studio',
  property_name: 'Top of the Hill',
  sms_consent: true,
  marketing_consent: false,
}

describe('POST /api/inquiries', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 400 when first_name is missing', async () => {
    const res = await POST(makeRequest({ ...validBody, first_name: '' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('First name is required.')
  })

  it('returns 400 when last_name is missing', async () => {
    const res = await POST(makeRequest({ ...validBody, last_name: '' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Last name is required.')
  })

  it('returns 400 when email is invalid', async () => {
    const res = await POST(makeRequest({ ...validBody, email: 'not-an-email' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Valid email is required.')
  })

  it('returns 400 when phone has fewer than 10 digits', async () => {
    const res = await POST(makeRequest({ ...validBody, phone: '555123' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Valid phone number is required.')
  })

  it('returns 400 when move_in is missing', async () => {
    const res = await POST(makeRequest({ ...validBody, move_in: '' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Move-in date is required.')
  })

  it('returns 400 when occupants is less than 1', async () => {
    const res = await POST(makeRequest({ ...validBody, occupants: 0 }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Number of occupants is required.')
  })

  it('calls syncLongTermInquiryToGHL with correct shape and returns success', async () => {
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(syncLongTermInquiryToGHL).toHaveBeenCalledWith({
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane@example.com',
      phone: '5550000000',
      moveIn: '2026-06-01',
      occupants: 2,
      roomSlug: 'cozy-studio',
      roomName: 'Cozy Studio',
      propertyName: 'Top of the Hill',
      smsConsent: true,
      marketingConsent: false,
    })
  })

  it('returns 500 when syncLongTermInquiryToGHL throws', async () => {
    ;(syncLongTermInquiryToGHL as jest.Mock).mockRejectedValueOnce(new Error('GHL down'))
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toBe('Failed to submit inquiry. Please try again.')
  })
})
```

- [ ] **Step 2: Run test to confirm it fails (route doesn't exist yet)**

```bash
cd /workspaces/Top-of-the-Hill-Estates && npx jest __tests__/api/inquiries.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '@/app/api/inquiries/route'`

---

## Task 2: Add `syncLongTermInquiryToGHL` to `lib/ghl.ts` and create the API route

**Files:**
- Modify: `lib/ghl.ts` (append new function at the end)
- Create: `app/api/inquiries/route.ts`

- [ ] **Step 1: Append `syncLongTermInquiryToGHL` to `lib/ghl.ts`**

Add this block at the very end of `lib/ghl.ts` (after `notifyGHLBookingConfirmed`):

```typescript
/**
 * Syncs a long-term rental inquiry to GoHighLevel — creates/updates the contact
 * and triggers GHL_CONTACT_WEBHOOK_URL with a 'long-term-inquiry' tag.
 */
export async function syncLongTermInquiryToGHL(data: {
  firstName: string
  lastName: string
  email: string
  phone: string
  moveIn: string
  occupants: number
  roomSlug: string
  roomName: string
  propertyName: string
  smsConsent: boolean
  marketingConsent: boolean
}): Promise<void> {
  const tags = ['long-term-inquiry']
  if (data.smsConsent) tags.push('sms-opted-in')
  if (data.marketingConsent) tags.push('marketing-opted-in')

  const ghlContactId = await createOrUpdateGHLContact({
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email,
    phone: data.phone,
    tags,
    customFields: {
      move_in_date: data.moveIn,
      room_slug: data.roomSlug,
    },
  })

  const webhookUrl = process.env.GHL_CONTACT_WEBHOOK_URL ?? ''
  if (webhookUrl) {
    await triggerGHLWorkflow(webhookUrl, {
      contactId: ghlContactId,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      moveIn: data.moveIn,
      occupants: data.occupants,
      roomSlug: data.roomSlug,
      roomName: data.roomName,
      propertyName: data.propertyName,
      smsConsent: data.smsConsent,
      marketingConsent: data.marketingConsent,
    })
  }
}
```

- [ ] **Step 2: Create `app/api/inquiries/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { syncLongTermInquiryToGHL } from '@/lib/ghl'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: Request) {
  const body = await req.json()
  const {
    first_name,
    last_name,
    email,
    phone,
    move_in,
    occupants,
    room_slug,
    room_name,
    property_name,
    sms_consent,
    marketing_consent,
  } = body as Record<string, unknown>

  if (!String(first_name ?? '').trim())
    return NextResponse.json({ error: 'First name is required.' }, { status: 400 })
  if (!String(last_name ?? '').trim())
    return NextResponse.json({ error: 'Last name is required.' }, { status: 400 })
  if (!String(email ?? '').trim() || !EMAIL_RE.test(String(email).trim()))
    return NextResponse.json({ error: 'Valid email is required.' }, { status: 400 })
  if (String(phone ?? '').replace(/\D/g, '').length < 10)
    return NextResponse.json({ error: 'Valid phone number is required.' }, { status: 400 })
  if (!String(move_in ?? '').trim())
    return NextResponse.json({ error: 'Move-in date is required.' }, { status: 400 })
  if (!occupants || Number(occupants) < 1)
    return NextResponse.json({ error: 'Number of occupants is required.' }, { status: 400 })

  try {
    await syncLongTermInquiryToGHL({
      firstName: String(first_name).trim(),
      lastName: String(last_name).trim(),
      email: String(email).trim(),
      phone: String(phone ?? ''),
      moveIn: String(move_in),
      occupants: Number(occupants),
      roomSlug: String(room_slug ?? ''),
      roomName: String(room_name ?? ''),
      propertyName: String(property_name ?? ''),
      smsConsent: Boolean(sms_consent),
      marketingConsent: Boolean(marketing_consent),
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[inquiries] GHL sync failed:', err)
    return NextResponse.json(
      { error: 'Failed to submit inquiry. Please try again.' },
      { status: 500 },
    )
  }
}
```

- [ ] **Step 3: Run the test suite to verify all tests pass**

```bash
cd /workspaces/Top-of-the-Hill-Estates && npx jest __tests__/api/inquiries.test.ts --no-coverage
```

Expected: PASS — 8 tests passing

- [ ] **Step 4: Commit**

```bash
git add lib/ghl.ts app/api/inquiries/route.ts __tests__/api/inquiries.test.ts
git commit -m "feat: add syncLongTermInquiryToGHL and POST /api/inquiries route"
```

---

## Task 3: Create `LongTermInquiryForm` component

**Files:**
- Create: `components/public/LongTermInquiryForm.tsx`

- [ ] **Step 1: Create the component**

```typescript
'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  roomSlug: string
  roomName: string
  propertyName: string
  initialMoveIn?: string
  initialOccupants?: number
}

interface FieldErrors {
  first_name?: string
  last_name?: string
  email?: string
  phone?: string
  move_in?: string
  occupants?: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validate(fields: {
  first_name: string
  last_name: string
  email: string
  phone: string
  move_in: string
  occupants: string
}): FieldErrors {
  const errors: FieldErrors = {}
  if (!fields.first_name.trim()) errors.first_name = 'First name is required.'
  if (!fields.last_name.trim()) errors.last_name = 'Last name is required.'
  if (!fields.email.trim()) errors.email = 'Email is required.'
  else if (!EMAIL_RE.test(fields.email.trim())) errors.email = 'Please enter a valid email address.'
  const digits = fields.phone.replace(/\D/g, '')
  if (!fields.phone.trim()) errors.phone = 'Phone number is required.'
  else if (digits.length < 10) errors.phone = 'Please enter a valid phone number (at least 10 digits).'
  if (!fields.move_in) errors.move_in = 'Move-in date is required.'
  if (!fields.occupants || Number(fields.occupants) < 1)
    errors.occupants = 'Number of occupants is required.'
  return errors
}

export default function LongTermInquiryForm({
  roomSlug,
  roomName,
  propertyName,
  initialMoveIn = '',
  initialOccupants = 1,
}: Props) {
  const router = useRouter()
  const [fields, setFields] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    move_in: initialMoveIn,
    occupants: String(initialOccupants),
  })
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [smsConsent, setSmsConsent] = useState(false)
  const [marketingConsent, setMarketingConsent] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function updateField(key: keyof typeof fields, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }))
    if (fieldErrors[key]) setFieldErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const errors = validate(fields)
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }
    if (!smsConsent) {
      setError('You must consent to SMS messages to continue.')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...fields,
          occupants: Number(fields.occupants),
          room_slug: roomSlug,
          room_name: roomName,
          property_name: propertyName,
          sms_consent: smsConsent,
          marketing_consent: marketingConsent,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Unable to submit inquiry. Please try again.')
        return
      }
      router.push('/apply/confirmation')
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const inputBase =
    'w-full bg-surface-highest/40 rounded-xl px-4 py-3 text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary/50'
  const inputError =
    'w-full bg-surface-highest/40 rounded-xl px-4 py-3 text-on-surface focus:outline-none focus:ring-1 focus:ring-error ring-1 ring-error/60'

  function inputClass(field: keyof FieldErrors) {
    return fieldErrors[field] ? inputError : inputBase
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      <h2 className="font-display text-xl font-semibold text-on-surface">Your Information</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-on-surface-variant text-sm mb-1" htmlFor="first_name">
            First Name <span className="text-error">*</span>
          </label>
          <input
            id="first_name"
            type="text"
            autoComplete="given-name"
            value={fields.first_name}
            onChange={(e) => updateField('first_name', e.target.value)}
            className={inputClass('first_name')}
            placeholder="Jane"
          />
          {fieldErrors.first_name && (
            <p className="text-error text-xs mt-1">{fieldErrors.first_name}</p>
          )}
        </div>

        <div>
          <label className="block text-on-surface-variant text-sm mb-1" htmlFor="last_name">
            Last Name <span className="text-error">*</span>
          </label>
          <input
            id="last_name"
            type="text"
            autoComplete="family-name"
            value={fields.last_name}
            onChange={(e) => updateField('last_name', e.target.value)}
            className={inputClass('last_name')}
            placeholder="Smith"
          />
          {fieldErrors.last_name && (
            <p className="text-error text-xs mt-1">{fieldErrors.last_name}</p>
          )}
        </div>

        <div>
          <label className="block text-on-surface-variant text-sm mb-1" htmlFor="email">
            Email <span className="text-error">*</span>
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={fields.email}
            onChange={(e) => updateField('email', e.target.value)}
            className={inputClass('email')}
            placeholder="jane@example.com"
          />
          {fieldErrors.email && (
            <p className="text-error text-xs mt-1">{fieldErrors.email}</p>
          )}
        </div>

        <div>
          <label className="block text-on-surface-variant text-sm mb-1" htmlFor="phone">
            Phone <span className="text-error">*</span>
          </label>
          <input
            id="phone"
            type="tel"
            autoComplete="tel"
            value={fields.phone}
            onChange={(e) => updateField('phone', e.target.value.replace(/[^\d\s+\-.()]/g, ''))}
            className={inputClass('phone')}
            placeholder="+1 (555) 000-0000"
          />
          {fieldErrors.phone && (
            <p className="text-error text-xs mt-1">{fieldErrors.phone}</p>
          )}
        </div>

        <div>
          <label className="block text-on-surface-variant text-sm mb-1" htmlFor="move_in">
            Desired Move-in Date <span className="text-error">*</span>
          </label>
          <input
            id="move_in"
            type="date"
            value={fields.move_in}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(e) => updateField('move_in', e.target.value)}
            className={inputClass('move_in')}
          />
          {fieldErrors.move_in && (
            <p className="text-error text-xs mt-1">{fieldErrors.move_in}</p>
          )}
        </div>

        <div>
          <label className="block text-on-surface-variant text-sm mb-1" htmlFor="occupants">
            Number of Occupants <span className="text-error">*</span>
          </label>
          <input
            id="occupants"
            type="number"
            min={1}
            value={fields.occupants}
            onChange={(e) => updateField('occupants', e.target.value)}
            className={inputClass('occupants')}
            placeholder="1"
          />
          {fieldErrors.occupants && (
            <p className="text-error text-xs mt-1">{fieldErrors.occupants}</p>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <label className="flex items-start gap-3 bg-surface-highest/40 backdrop-blur-xl rounded-xl p-4 cursor-pointer">
          <input
            type="checkbox"
            checked={smsConsent}
            onChange={(e) => {
              setSmsConsent(e.target.checked)
              setError(null)
            }}
            className="mt-0.5 h-4 w-4 shrink-0 rounded accent-secondary cursor-pointer"
          />
          <span className="text-on-surface-variant text-sm leading-relaxed">
            By checking this box, I consent to receive non-marketing text messages from Top of the
            Hill Estates, LLC about wifi instructions, rental inquiry, application status,
            scheduling and account-related updates. Message frequency varies, message &amp; data
            rates may apply. Text HELP for assistance, reply STOP to opt out.{' '}
            <a
              href="/privacypolicy"
              className="underline hover:text-secondary transition-colors duration-150"
            >
              Privacy Policy
            </a>{' '}
            and{' '}
            <a
              href="/termsandconditions"
              className="underline hover:text-secondary transition-colors duration-150"
            >
              Terms of Service
            </a>
            <span className="text-error ml-1">*</span>
          </span>
        </label>

        <label className="flex items-start gap-3 bg-surface-highest/40 backdrop-blur-xl rounded-xl p-4 cursor-pointer">
          <input
            type="checkbox"
            checked={marketingConsent}
            onChange={(e) => setMarketingConsent(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded accent-secondary cursor-pointer"
          />
          <span className="text-on-surface-variant text-sm leading-relaxed">
            By checking this box, I consent to receive marketing and promotional messages including
            special offers, discounts, new product updates among others from Top of the Hill
            Estates, LLC at the phone number provided. Frequency may vary. Message &amp; data rates
            may apply. Text HELP for assistance, reply STOP to opt out.{' '}
            <a
              href="/privacypolicy"
              className="underline hover:text-secondary transition-colors duration-150"
            >
              Privacy Policy
            </a>{' '}
            and{' '}
            <a
              href="/termsandconditions"
              className="underline hover:text-secondary transition-colors duration-150"
            >
              Terms of Service
            </a>
          </span>
        </label>
      </div>

      {error && (
        <p className="text-error text-sm rounded-xl bg-error-container/30 px-4 py-3">{error}</p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-gradient-to-r from-primary to-secondary text-background font-display font-semibold py-3 rounded-2xl shadow-[0_0_10px_rgba(45,212,191,0.30)] hover:opacity-90 transition-opacity duration-150 disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        {isSubmitting ? 'Submitting…' : 'Submit Inquiry'}
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles cleanly**

```bash
cd /workspaces/Top-of-the-Hill-Estates && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors for the new file

- [ ] **Step 3: Commit**

```bash
git add components/public/LongTermInquiryForm.tsx
git commit -m "feat: add LongTermInquiryForm component"
```

---

## Task 4: Create the `/apply` page

**Files:**
- Create: `app/(public)/apply/page.tsx`

- [ ] **Step 1: Create the page**

```typescript
export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase'
import LongTermInquiryForm from '@/components/public/LongTermInquiryForm'

interface Props {
  searchParams: { room?: string; move_in?: string; occupants?: string }
}

export default async function ApplyPage({ searchParams }: Props) {
  const slug = searchParams.room
  if (!slug) redirect('/')

  const supabase = await createServerSupabaseClient()
  const { data: rawRoom } = await supabase
    .from('rooms')
    .select('id, name, slug, property:properties(name)')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (!rawRoom) redirect('/')

  const room = rawRoom as unknown as {
    id: string
    name: string
    slug: string
    property: { name: string } | null
  }

  const propertyName = room.property?.name ?? ''
  const moveIn = searchParams.move_in ?? ''
  const occupants = searchParams.occupants ? parseInt(searchParams.occupants, 10) : 1

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
        <div className="space-y-1">
          {propertyName && (
            <p className="text-xs uppercase tracking-widest text-secondary font-body">
              {propertyName}
            </p>
          )}
          <h1 className="font-display text-3xl font-bold text-primary">{room.name}</h1>
          <p className="text-on-surface-variant text-sm">Long-term rental inquiry</p>
          {moveIn && (
            <p className="text-on-surface-variant text-sm">
              Desired move-in:{' '}
              <span className="font-semibold text-on-surface">
                {new Date(moveIn + 'T00:00:00').toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            </p>
          )}
        </div>

        <div className="bg-surface-highest/40 backdrop-blur-xl shadow-[0_8px_40px_rgba(45,212,191,0.06)] rounded-2xl p-6">
          <LongTermInquiryForm
            roomSlug={room.slug}
            roomName={room.name}
            propertyName={propertyName}
            initialMoveIn={moveIn}
            initialOccupants={occupants}
          />
        </div>
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /workspaces/Top-of-the-Hill-Estates && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add "app/(public)/apply/page.tsx"
git commit -m "feat: add /apply page for long-term inquiry"
```

---

## Task 5: Create the `/apply/confirmation` page

**Files:**
- Create: `app/(public)/apply/confirmation/page.tsx`

- [ ] **Step 1: Create the page**

```typescript
import Link from 'next/link'
import { CheckCircleIcon } from '@heroicons/react/24/outline'

export default function ApplyConfirmationPage() {
  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <CheckCircleIcon className="w-16 h-16 text-secondary" />
        </div>
        <div className="space-y-2">
          <h1 className="font-display text-3xl font-bold text-on-surface">
            We&apos;ve received your inquiry
          </h1>
          <p className="text-on-surface-variant leading-relaxed">
            Thank you for your interest. Someone from our team will be in touch with you shortly
            to discuss next steps.
          </p>
        </div>
        <Link
          href="/"
          className="inline-block bg-gradient-to-r from-primary to-secondary text-background font-semibold rounded-2xl px-8 py-3 hover:opacity-90 transition-opacity"
        >
          Back to Home
        </Link>
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/(public)/apply/confirmation/page.tsx"
git commit -m "feat: add /apply/confirmation thank-you page"
```

---

## Task 6: Update `BookingWidget` to route long-term to `/apply`

**Files:**
- Modify: `components/public/BookingWidget.tsx`

- [ ] **Step 1: Replace the `handleBook` callback**

In `components/public/BookingWidget.tsx`, replace the entire `handleBook` callback (lines 151–188) with:

```typescript
  const handleBook = useCallback(() => {
    if (!validate()) return

    if (bookingType === 'long_term') {
      const params = new URLSearchParams({
        room: room.slug,
        room_name: room.name,
        property_name: room.property?.name ?? '',
        move_in: moveIn,
        occupants: String(guests),
      })
      router.push(`/apply?${params.toString()}`)
      return
    }

    const params = new URLSearchParams({
      room_id: room.id,
      room: room.slug,
      room_name: room.name,
      type: bookingType,
      guests: String(guests),
      nightly_rate: String(room.nightly_rate),
      monthly_rate: String(room.monthly_rate),
      cleaning_fee: String(cleaningFee),
      security_deposit: String(securityDeposit),
      extra_guest_fee: String(extraGuestFee),
      fees: JSON.stringify(roomFees),
      checkin: checkIn,
      checkout: checkOut,
      total_nights: String(nights),
      total_amount: String(stTotal),
      amount_to_pay: String(stTotal),
      amount_due: '0',
    })

    router.push(`/checkout?${params.toString()}`)
  }, [
    validate, room, bookingType, guests, checkIn, checkOut, moveIn, nights,
    cleaningFee, securityDeposit, extraGuestFee, roomFees, stTotal, router,
  ])
```

- [ ] **Step 2: Update the button label**

Replace:
```tsx
      Book Now
```
With:
```tsx
      {bookingType === 'long_term' ? 'Apply Now' : 'Book Now'}
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd /workspaces/Top-of-the-Hill-Estates && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 4: Run full test suite**

```bash
cd /workspaces/Top-of-the-Hill-Estates && npx jest --no-coverage 2>&1 | tail -20
```

Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add components/public/BookingWidget.tsx
git commit -m "feat: route long-term booking to /apply instead of /checkout"
```

---

## Verification Checklist

After all tasks are complete, manually verify the end-to-end flow:

1. Navigate to a room page that has `show_monthly_rate: true`
2. If both rates shown — click "Long-term (Monthly)" tab → confirm button reads "Apply Now"
3. Select a move-in date and guest count → click "Apply Now"
4. Confirm redirect to `/apply?room=<slug>&move_in=<date>&occupants=<n>`
5. Confirm room name, property, and move-in date are shown in the header
6. Confirm move-in date and occupant count fields are pre-filled
7. Submit the form with valid data → confirm redirect to `/apply/confirmation`
8. Confirm thank-you page renders with "Back to Home" link
9. Verify in GHL that a contact was created/updated with tag `long-term-inquiry`
10. Navigate to a room page that has `show_nightly_rate: true, show_monthly_rate: false` — confirm the widget starts on short-term and "Book Now" is unchanged
