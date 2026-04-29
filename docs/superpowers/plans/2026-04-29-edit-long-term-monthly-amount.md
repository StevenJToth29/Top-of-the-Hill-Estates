# Edit Long-Term Monthly Amount Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow admins to edit the monthly amount on an existing long-term booking, bypassing the standard rate breakdown and updating both `monthly_rate` and `total_amount` on the booking record.

**Architecture:** Mirror the creation-flow pattern: the form holds `monthlyAmount` state (initialized from `booking.monthly_rate`), sends `admin_monthly_amount` in the PATCH body, and the API validates and uses it as `newTotal` while updating `monthly_rate` in the DB. The existing Stripe delta logic fires unchanged based on the difference between new and original totals.

**Tech Stack:** Next.js App Router, React hooks, Jest + ts-jest for API unit tests

---

## File Map

| File | Change |
|------|--------|
| `__tests__/api/bookings-edit.test.ts` | Add `admin_monthly_amount` test cases |
| `app/api/admin/bookings/[id]/edit/route.ts` | Accept and validate `admin_monthly_amount` |
| `components/admin/EditBookingForm.tsx` | Add `monthlyAmount` state, input, updated preview |

---

### Task 1: Add failing tests for `admin_monthly_amount` in the edit API

**Files:**
- Modify: `__tests__/api/bookings-edit.test.ts`

- [ ] **Step 1: Append the new describe block at the end of the file**

Open `__tests__/api/bookings-edit.test.ts` and add this block after the closing `})` of the existing `describe('PATCH /api/admin/bookings/[id]/edit', ...)` block:

```typescript
// ── admin_monthly_amount override ───────────────────────────────────────────

describe('PATCH /api/admin/bookings/[id]/edit — admin_monthly_amount override', () => {
  const ltBooking = {
    ...baseBooking,
    booking_type: 'long_term',
    check_out: '9999-12-31',
    total_nights: 0,
    total_amount: 3000,
    amount_paid: 3000,
    monthly_rate: 3000,
    stripe_payment_intent_id: null as string | null,
  }
  const ltRoom = { ...baseRoom, monthly_rate: 3000, security_deposit: 500, extra_guest_fee: 0 }

  beforeEach(() => jest.clearAllMocks())

  it('uses admin_monthly_amount as both total_amount and monthly_rate for long-term', async () => {
    const { update } = setupMocks(ltBooking, ltRoom)
    const res = await PATCH(makeRequest({ admin_monthly_amount: 2200 }), mockParams)
    expect(res.status).toBe(200)
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        total_amount: 2200,
        monthly_rate: 2200,
      }),
    )
  })

  it('returns 400 when admin_monthly_amount is zero', async () => {
    setupMocks(ltBooking, ltRoom)
    const res = await PATCH(makeRequest({ admin_monthly_amount: 0 }), mockParams)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/admin_monthly_amount/i)
  })

  it('returns 400 when admin_monthly_amount is negative', async () => {
    setupMocks(ltBooking, ltRoom)
    const res = await PATCH(makeRequest({ admin_monthly_amount: -500 }), mockParams)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/admin_monthly_amount/i)
  })

  it('adds booking_fees on top of admin_monthly_amount', async () => {
    const { update } = setupMocks(ltBooking, ltRoom, [{ amount: 100 }])
    const res = await PATCH(makeRequest({ admin_monthly_amount: 2200 }), mockParams)
    expect(res.status).toBe(200)
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ total_amount: 2300 }),
    )
  })

  it('falls back to standard long-term computation when admin_monthly_amount is absent', async () => {
    const { update } = setupMocks(ltBooking, ltRoom)
    // standard: 3000 monthly + 500 deposit + 0 extra = 3500
    const res = await PATCH(makeRequest({ guest_count: 1 }), mockParams)
    expect(res.status).toBe(200)
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ total_amount: 3500 }),
    )
  })
})
```

- [ ] **Step 2: Run the new tests — verify they fail**

```bash
npx jest --config jest.config.cjs __tests__/api/bookings-edit.test.ts --no-coverage -t "admin_monthly_amount"
```

Expected: 4 fail (feature not yet implemented), 1 may pass (fallback already works). If all 5 fail, proceed. If the fallback test passes, that is also acceptable — note it and continue.

---

### Task 2: Implement API changes

**Files:**
- Modify: `app/api/admin/bookings/[id]/edit/route.ts`

- [ ] **Step 1a: Add `monthlyRateSnapshot` variable**

Find this exact line (around line 141):

```typescript
    let newTotalNights: number
```

Replace it with:

```typescript
    let newTotalNights: number
    let monthlyRateSnapshot = b.monthly_rate ?? 0
```

- [ ] **Step 1b: Replace the long-term `else` branch**

Find this exact block (the full `else` clause of the short-term/long-term if/else):

```typescript
    } else {
      // long_term: only extra_guest_fee changes with guest count; base is monthly_rate + security_deposit
      const securityDeposit = room.security_deposit ?? 0
      newTotal = room.monthly_rate + securityDeposit + extraGuestFee * extraGuests + additionalFees
      if (checkOut === OPEN_ENDED_DATE) {
        newTotalNights = 0
      } else {
        const [ltciY, ltciM, ltciD] = checkIn.split('-').map(Number)
        const [ltcoY, ltcoM, ltcoD] = checkOut.split('-').map(Number)
        newTotalNights = Math.round(
          (Date.UTC(ltcoY, ltcoM - 1, ltcoD) - Date.UTC(ltciY, ltciM - 1, ltciD)) / 86400000,
        )
      }
    }
```

Replace it with:

```typescript
    } else {
      if (body.admin_monthly_amount !== undefined) {
        const adminAmount = Number(body.admin_monthly_amount)
        if (!isFinite(adminAmount) || adminAmount <= 0) {
          return NextResponse.json(
            { error: 'admin_monthly_amount must be a positive number' },
            { status: 400 },
          )
        }
        monthlyRateSnapshot = adminAmount
        newTotal = adminAmount + additionalFees
      } else {
        // long_term: only extra_guest_fee changes with guest count; base is monthly_rate + security_deposit
        const securityDeposit = room.security_deposit ?? 0
        newTotal = room.monthly_rate + securityDeposit + extraGuestFee * extraGuests + additionalFees
      }
      if (checkOut === OPEN_ENDED_DATE) {
        newTotalNights = 0
      } else {
        const [ltciY, ltciM, ltciD] = checkIn.split('-').map(Number)
        const [ltcoY, ltcoM, ltcoD] = checkOut.split('-').map(Number)
        newTotalNights = Math.round(
          (Date.UTC(ltcoY, ltcoM - 1, ltcoD) - Date.UTC(ltciY, ltciM - 1, ltciD)) / 86400000,
        )
      }
    }
```

- [ ] **Step 2: Add `monthly_rate` to the DB update object**

Find the `.update({...})` call (around line 187). It currently contains these fields:

```typescript
      .update({
        check_in: checkIn,
        check_out: checkOut,
        guest_first_name: guestFirstName,
        guest_last_name: guestLastName,
        guest_email: guestEmail,
        guest_phone: guestPhone,
        guest_count: guestCount,
        total_nights: newTotalNights,
        total_amount: newTotal,
        amount_due_at_checkin: amountDueAtCheckin,
        notes,
        updated_at: new Date().toISOString(),
      })
```

Replace it with:

```typescript
      .update({
        check_in: checkIn,
        check_out: checkOut,
        guest_first_name: guestFirstName,
        guest_last_name: guestLastName,
        guest_email: guestEmail,
        guest_phone: guestPhone,
        guest_count: guestCount,
        total_nights: newTotalNights,
        monthly_rate: monthlyRateSnapshot,
        total_amount: newTotal,
        amount_due_at_checkin: amountDueAtCheckin,
        notes,
        updated_at: new Date().toISOString(),
      })
```

- [ ] **Step 3: Run the tests — verify all pass**

```bash
npx jest --config jest.config.cjs __tests__/api/bookings-edit.test.ts --no-coverage
```

Expected: all tests pass (existing + new). Count should be at least 16 (11 existing + 5 new).

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/bookings/[id]/edit/route.ts __tests__/api/bookings-edit.test.ts
git commit -m "feat: accept admin_monthly_amount override on long-term booking edits"
```

---

### Task 3: Update EditBookingForm

**Files:**
- Modify: `components/admin/EditBookingForm.tsx`

- [ ] **Step 1: Add `monthlyAmount` state**

Below the existing `const [notes, setNotes] = useState(booking.notes ?? '')` line (around line 55), add:

```tsx
  const [monthlyAmount, setMonthlyAmount] = useState(booking.monthly_rate ?? 0)
```

- [ ] **Step 2: Update `newTotal` for long-term to use `monthlyAmount`**

Find this block inside the `newTotal` IIFE (around line 65):

```tsx
    if (isLongTerm) {
      return computeLongTermTotal(
        room.monthly_rate,
        room.security_deposit ?? 0,
        room.extra_guest_fee ?? 0,
        extraGuests,
      ) + additionalFees
    }
```

Replace it with:

```tsx
    if (isLongTerm) {
      return monthlyAmount + additionalFees
    }
```

- [ ] **Step 3: Add client-side validation in `handleSubmit`**

Find this block at the top of `handleSubmit`:

```tsx
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
```

Replace it with:

```tsx
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (isLongTerm && monthlyAmount <= 0) {
      setError('Monthly amount must be greater than $0.')
      return
    }
    setSaving(true)
```

- [ ] **Step 4: Add `admin_monthly_amount` to the PATCH body**

Find the `body: JSON.stringify({...})` inside `handleSubmit`. It currently ends with:

```tsx
        body: JSON.stringify({
          check_in: checkIn,
          check_out: openEnded ? OPEN_ENDED_DATE : checkOut,
          guest_first_name: firstName,
          guest_last_name: lastName,
          guest_email: email,
          guest_phone: phone,
          guest_count: guestCount,
          notes: notes || null,
        }),
```

Replace it with:

```tsx
        body: JSON.stringify({
          check_in: checkIn,
          check_out: openEnded ? OPEN_ENDED_DATE : checkOut,
          guest_first_name: firstName,
          guest_last_name: lastName,
          guest_email: email,
          guest_phone: phone,
          guest_count: guestCount,
          notes: notes || null,
          ...(isLongTerm ? { admin_monthly_amount: monthlyAmount } : {}),
        }),
```

- [ ] **Step 5: Add the Monthly Amount input and Pricing section to the form JSX**

Find this line in the JSX (the `<hr>` that separates Stay Dates from Guest):

```tsx
            <hr className="border-slate-100" />

            {/* Guest */}
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Guest</p>
```

Replace it with:

```tsx
            <hr className="border-slate-100" />

            {/* Pricing — long-term only */}
            {isLongTerm && (
              <>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Pricing</p>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Monthly Amount</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
                      <input
                        type="number"
                        min={0.01}
                        step={0.01}
                        value={monthlyAmount}
                        onChange={(e) => setMonthlyAmount(Number(e.target.value))}
                        className="w-full pl-7 pr-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-400/40 focus:border-teal-400"
                      />
                    </div>
                  </div>
                </div>
                <hr className="border-slate-100" />
              </>
            )}

            {/* Guest */}
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Guest</p>
```

- [ ] **Step 6: Run the full test suite to confirm no regressions**

```bash
npx jest --config jest.config.cjs --no-coverage
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add components/admin/EditBookingForm.tsx
git commit -m "feat: add monthly amount input to edit booking form for long-term bookings"
```
