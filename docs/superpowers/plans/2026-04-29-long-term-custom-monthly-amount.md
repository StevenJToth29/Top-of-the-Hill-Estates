# Long-Term Custom Monthly Amount Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow admins to enter a custom monthly amount when creating a manual long-term booking, overriding the room's standard rate and bypassing the standard breakdown.

**Architecture:** Add a `Monthly Amount` number input to `ManualBookingForm` (long-term only, pre-filled with the room rate). The form sends `admin_monthly_amount` in the POST body. The API accepts the override for long-term bookings and stores it as both `monthly_rate` and `total_amount`, zeroing out the deposit/fee snapshots.

**Tech Stack:** Next.js App Router, React hooks, Jest + ts-jest for API unit tests

---

## File Map

| File | Change |
|------|--------|
| `__tests__/api/admin/bookings-manual.test.ts` | Add `admin_monthly_amount` test cases |
| `app/api/admin/bookings/manual/route.ts` | Accept and validate `admin_monthly_amount` |
| `components/admin/ManualBookingForm.tsx` | Add `monthlyAmount` state, input, updated summary |

---

### Task 1: Add failing tests for `admin_monthly_amount`

**Files:**
- Modify: `__tests__/api/admin/bookings-manual.test.ts`

- [ ] **Step 1: Append the new describe block to the test file**

Open `__tests__/api/admin/bookings-manual.test.ts` and add this block at the end of the file (after the last `describe` block):

```typescript
// ── admin_monthly_amount override ───────────────────────────────────────────

describe('POST /api/admin/bookings/manual — admin_monthly_amount override', () => {
  beforeEach(mockAuthed)

  it('uses admin_monthly_amount as both monthly_rate and total_amount for long-term', async () => {
    const { insert } = mockDb()
    const body = {
      ...baseBody,
      booking_type: 'long_term',
      check_out: undefined,
      admin_monthly_amount: 1800,
    }
    const res = await POST(makeRequest(body))
    expect(res.status).toBe(201)
    const insertArg = insert.mock.calls[0][0]
    expect(insertArg.monthly_rate).toBe(1800)
    expect(insertArg.total_amount).toBe(1800)
    expect(insertArg.security_deposit).toBe(0)
    expect(insertArg.extra_guest_fee).toBe(0)
  })

  it('returns 400 when admin_monthly_amount is zero', async () => {
    mockDb()
    const body = {
      ...baseBody,
      booking_type: 'long_term',
      check_out: undefined,
      admin_monthly_amount: 0,
    }
    const res = await POST(makeRequest(body))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/admin_monthly_amount/i)
  })

  it('returns 400 when admin_monthly_amount is negative', async () => {
    mockDb()
    const body = {
      ...baseBody,
      booking_type: 'long_term',
      check_out: undefined,
      admin_monthly_amount: -100,
    }
    const res = await POST(makeRequest(body))
    expect(res.status).toBe(400)
  })

  it('falls back to standard computation when admin_monthly_amount is absent', async () => {
    const { insert } = mockDb()
    const body = { ...baseBody, booking_type: 'long_term', check_out: undefined }
    await POST(makeRequest(body))
    const insertArg = insert.mock.calls[0][0]
    // baseRoom: monthly_rate 2500 + security_deposit 500 = 3000
    expect(insertArg.total_amount).toBe(3000)
    expect(insertArg.monthly_rate).toBe(2500)
    expect(insertArg.security_deposit).toBe(500)
  })
})
```

- [ ] **Step 2: Run the new tests — verify they all fail**

```bash
npx jest --config jest.config.cjs __tests__/api/admin/bookings-manual.test.ts --no-coverage -t "admin_monthly_amount"
```

Expected: 4 failing tests. If any pass, the implementation already exists and this plan is out of date — stop and investigate.

---

### Task 2: Implement API changes

**Files:**
- Modify: `app/api/admin/bookings/manual/route.ts`

- [ ] **Step 1: Add `monthlyRateSnapshot` variable and update the long-term branch**

Find this block (around line 119 in the route):

```typescript
  let total_amount: number
  let snapshotCleaningFee: number
  let snapshotSecurityDeposit: number
  let snapshotExtraGuestFee: number

  if (bookingType === 'short_term') {
    const nightlySubtotal = computeNightlySubtotal(
      body.check_in as string,
      checkOut,
      room.nightly_rate,
      overrideMap,
    )
    const extraGuestTotal = extraGuests * extra_guest_fee * totalNights
    total_amount = nightlySubtotal + cleaning_fee + extraGuestTotal
    snapshotCleaningFee = cleaning_fee
    snapshotSecurityDeposit = 0
    snapshotExtraGuestFee = extraGuestTotal
  } else {
    const extraGuestTotal = extraGuests * extra_guest_fee
    total_amount = room.monthly_rate + security_deposit + extraGuestTotal
    snapshotCleaningFee = 0
    snapshotSecurityDeposit = security_deposit
    snapshotExtraGuestFee = extraGuestTotal
  }
```

Replace it with:

```typescript
  let total_amount: number
  let snapshotCleaningFee: number
  let snapshotSecurityDeposit: number
  let snapshotExtraGuestFee: number
  let monthlyRateSnapshot = room.monthly_rate

  if (bookingType === 'short_term') {
    const nightlySubtotal = computeNightlySubtotal(
      body.check_in as string,
      checkOut,
      room.nightly_rate,
      overrideMap,
    )
    const extraGuestTotal = extraGuests * extra_guest_fee * totalNights
    total_amount = nightlySubtotal + cleaning_fee + extraGuestTotal
    snapshotCleaningFee = cleaning_fee
    snapshotSecurityDeposit = 0
    snapshotExtraGuestFee = extraGuestTotal
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
      total_amount = adminAmount
      snapshotCleaningFee = 0
      snapshotSecurityDeposit = 0
      snapshotExtraGuestFee = 0
    } else {
      const extraGuestTotal = extraGuests * extra_guest_fee
      total_amount = room.monthly_rate + security_deposit + extraGuestTotal
      snapshotCleaningFee = 0
      snapshotSecurityDeposit = security_deposit
      snapshotExtraGuestFee = extraGuestTotal
    }
  }
```

- [ ] **Step 2: Update the insert to use `monthlyRateSnapshot`**

Find this line inside the `.insert({...})` call:

```typescript
      monthly_rate: room.monthly_rate,
```

Replace it with:

```typescript
      monthly_rate: monthlyRateSnapshot,
```

- [ ] **Step 3: Run the new tests — verify they all pass**

```bash
npx jest --config jest.config.cjs __tests__/api/admin/bookings-manual.test.ts --no-coverage
```

Expected: all tests pass (including the existing ones — the fallback behaviour is unchanged).

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/bookings/manual/route.ts __tests__/api/admin/bookings-manual.test.ts
git commit -m "feat: accept admin_monthly_amount override on manual long-term bookings"
```

---

### Task 3: Update ManualBookingForm

**Files:**
- Modify: `components/admin/ManualBookingForm.tsx`

- [ ] **Step 1: Add `monthlyAmount` state**

Below the existing `const [guests, setGuests] = useState(1)` line (around line 33), add:

```tsx
  const [monthlyAmount, setMonthlyAmount] = useState(0)
```

- [ ] **Step 2: Add a `useEffect` to reset `monthlyAmount` when room or booking type changes**

Below the existing `useEffect` that loads rooms (after its closing `}, [])` around line 48), add:

```tsx
  useEffect(() => {
    if (bookingType === 'long_term') {
      const room = rooms.find((r) => r.id === roomId)
      setMonthlyAmount(room?.monthly_rate ?? 0)
    }
  }, [roomId, bookingType, rooms])
```

- [ ] **Step 3: Update `totalAmount` to use `monthlyAmount` for long-term**

Find:

```tsx
  const totalAmount = bookingType === 'long_term' ? rate : rate * nights
```

Replace with:

```tsx
  const totalAmount = bookingType === 'long_term' ? monthlyAmount : rate * nights
```

- [ ] **Step 4: Add validation for `monthlyAmount` in `handleSubmit`**

Find this validation block inside `handleSubmit`:

```tsx
    if (!roomId || !checkIn || (requiresCheckOut && !checkOut) || !firstName || !lastName || !email || !phone) {
      setError('Please fill in all required fields.')
      return
    }
```

Replace with:

```tsx
    if (!roomId || !checkIn || (requiresCheckOut && !checkOut) || !firstName || !lastName || !email || !phone) {
      setError('Please fill in all required fields.')
      return
    }
    if (bookingType === 'long_term' && monthlyAmount <= 0) {
      setError('Monthly amount must be greater than $0.')
      return
    }
```

- [ ] **Step 5: Add `admin_monthly_amount` to the POST body**

Find:

```tsx
          nightly_rate: selectedRoom?.nightly_rate ?? 0,
          monthly_rate: selectedRoom?.monthly_rate ?? 0,
          total_amount: totalAmount,
```

Replace with:

```tsx
          nightly_rate: selectedRoom?.nightly_rate ?? 0,
          monthly_rate: selectedRoom?.monthly_rate ?? 0,
          ...(bookingType === 'long_term' ? { admin_monthly_amount: monthlyAmount } : {}),
          total_amount: totalAmount,
```

- [ ] **Step 6: Add the Monthly Amount input to the form JSX**

Find this block (the "No end date" checkbox, around line 266):

```tsx
      {bookingType === 'long_term' && (
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={noEndDate}
            onChange={(e) => { setNoEndDate(e.target.checked); if (e.target.checked) setCheckOut('') }}
            className="mt-0.5 rounded"
          />
          <span className="text-sm text-on-surface-variant">No end date (open-ended tenancy)</span>
        </label>
      )}
```

Insert the new input **before** this block (directly above it):

```tsx
      {bookingType === 'long_term' && (
        <div className="space-y-1">
          <label className="text-xs text-on-surface-variant">
            Monthly Amount <span className="text-error">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-on-surface-variant">$</span>
            <input
              type="number"
              min={0.01}
              step={0.01}
              value={monthlyAmount}
              onChange={(e) => setMonthlyAmount(Number(e.target.value))}
              required
              className="w-full bg-surface-highest/40 rounded-xl pl-8 pr-4 py-3 text-sm text-on-surface focus:ring-1 focus:ring-secondary/50 outline-none"
            />
          </div>
        </div>
      )}
```

- [ ] **Step 7: Update the long-term price summary row to show `monthlyAmount`**

Find:

```tsx
          {bookingType === 'long_term' ? (
            <div className="flex justify-between text-sm">
              <span className="text-on-surface-variant">Monthly rate (deposit)</span>
              <span className="text-on-surface">{formatCurrency(rate)}</span>
            </div>
          ) : (
```

Replace with:

```tsx
          {bookingType === 'long_term' ? (
            <div className="flex justify-between text-sm">
              <span className="text-on-surface-variant">Monthly amount</span>
              <span className="text-on-surface">{formatCurrency(monthlyAmount)}</span>
            </div>
          ) : (
```

- [ ] **Step 8: Run the full test suite to confirm no regressions**

```bash
npx jest --config jest.config.cjs --no-coverage
```

Expected: all tests pass.

- [ ] **Step 9: Commit**

```bash
git add components/admin/ManualBookingForm.tsx
git commit -m "feat: add monthly amount input to manual long-term booking form"
```
