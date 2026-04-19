# Stripe Per-Property Payout Routing

**Date:** 2026-04-19
**Status:** Approved

## Overview

Enable the admin to assign a Stripe connected account (and therefore a distinct bank account) to each property, so that guest payments are automatically routed to the correct bank account at the time of payment. The platform can also withhold a configurable fee percentage per property before the remainder transfers to the connected account.

## Context

- The platform uses Stripe for all guest payments via payment intents
- Currently all funds settle into a single main Stripe account with no per-property routing
- The operator owns some properties personally (each needing its own bank account) and manages others on behalf of third-party owners (who need their own bank accounts with a platform fee withheld)
- All Stripe connected account setup is done manually by the admin in the Stripe dashboard; no owner-facing onboarding flow is required

## Architecture

```
Stripe Dashboard (single login)
└── Main Platform Account
    ├── Custom Connected Account: "House A Bank"    (acct_aaa)
    ├── Custom Connected Account: "House B Bank"    (acct_bbb)
    ├── Custom Connected Account: "House C Bank"    (acct_ccc)
    └── Custom Connected Account: "Owner Smith"     (acct_ddd)

Admin Portal
└── New "Payout Accounts" section
    ├── CRUD for connected accounts (label + Stripe account ID)
    └── Referenced by a dropdown on each Property edit form

Payment Flow
Guest pays → Stripe collects full amount
→ application_fee_amount withheld (platform_fee_percent of total)
→ Remainder auto-transferred to property's connected account
→ Connected account's bank receives payout on Stripe's normal schedule
```

**Stripe Connect pattern:** Destination Charges. The platform creates the payment intent on its own account with `transfer_data.destination` pointing to the connected account. Stripe handles the transfer atomically — no custom transfer logic or webhook changes needed. Full refunds automatically reverse the destination transfer.

Properties with no connected account assigned continue to settle into the main platform account (safe fallback).

## Data Model

### New table: `stripe_accounts`

```sql
CREATE TABLE stripe_accounts (
  id                UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  label             TEXT    NOT NULL,
  stripe_account_id TEXT    NOT NULL UNIQUE,
  created_at        TIMESTAMPTZ DEFAULT now()
);
```

- `label` — human-readable name shown in the admin UI (e.g., "House A Bank", "Owner Smith Account")
- `stripe_account_id` — the `acct_xxx` value copied from the Stripe dashboard

### Updated table: `properties`

```sql
ALTER TABLE properties
  ADD COLUMN stripe_account_id    UUID    REFERENCES stripe_accounts(id) ON DELETE SET NULL,
  ADD COLUMN platform_fee_percent NUMERIC DEFAULT 0
    CHECK (platform_fee_percent >= 0 AND platform_fee_percent <= 100);
```

- `stripe_account_id` — nullable FK; null means funds stay in the main account
- `ON DELETE SET NULL` — removing a payout account degrades gracefully rather than blocking deletion
- `platform_fee_percent` — the platform's cut before transfer; 0 for owner-operated properties, >0 for managed properties

## Admin UI

### New page: `/admin/payout-accounts`

CRUD table listing all connected accounts. Columns: Label, Stripe Account ID, Properties (count of properties using this account), Edit, Delete.

- Delete is blocked with an error message if any properties reference the account
- Add/Edit form has two fields: Label and Stripe Account ID

Add "Payout Accounts" to the admin sidebar nav under the Properties/Rooms group.

### Updated: Property edit form

Two new fields appended to the existing property form:

| Field | Behavior |
|---|---|
| Payout Account (dropdown) | Lists all `stripe_accounts` rows + a "None" option (funds stay in main account) |
| Platform Fee % (number input) | Only visible when a payout account is selected; defaults to 0 |

No changes to any other admin pages.

## Payment Flow

**File:** `app/api/bookings/route.ts`

When creating a payment intent, fetch the property's connected account via the existing `room → property` join pattern:

```typescript
const { data: room } = await supabase
  .from('rooms')
  .select('*, property:properties(stripe_account_id, platform_fee_percent, stripe_account:stripe_accounts(stripe_account_id))')
  .eq('id', room_id)
  .single()

const connectedAccountId = room?.property?.stripe_account?.stripe_account_id
const platformFeePercent = room?.property?.platform_fee_percent ?? 0

const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
  amount: Math.round(amount_to_pay * 100),
  currency: 'usd',
  metadata: { room_id, booking_type, guest_email },
}

if (connectedAccountId) {
  const applicationFeeAmount = Math.round(amount_to_pay * (platformFeePercent / 100) * 100)
  paymentIntentParams.transfer_data = { destination: connectedAccountId }
  paymentIntentParams.application_fee_amount = applicationFeeAmount
}

const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams)
```

**Refunds:** No changes needed. Stripe automatically reverses the destination transfer on full refunds through the existing admin refund flow. Partial refunds also work without custom handling.

**Webhooks:** No changes needed. Stripe handles destination transfers atomically.

## New API Routes

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/admin/payout-accounts` | List all connected accounts |
| POST | `/api/admin/payout-accounts` | Create a connected account record |
| PATCH | `/api/admin/payout-accounts/[id]` | Update label or Stripe account ID |
| DELETE | `/api/admin/payout-accounts/[id]` | Delete (blocked if properties reference it) |

Property PATCH route (`/api/admin/properties/[id]`) updated to accept `stripe_account_id` and `platform_fee_percent`.

## Stripe Dashboard Setup (One-Time Per Bank Account)

Before any routing works, each destination bank account must be set up in Stripe as a Custom connected account:

1. In the Stripe Dashboard, go to **Connect → Accounts → Create account**
2. Choose **Custom** account type
3. Complete the required business/individual info and link the bank account
4. Copy the resulting **Account ID** (`acct_xxx`)
5. In the admin portal under **Payout Accounts**, add a new entry with a label and that Account ID
6. On each property's edit page, select the appropriate payout account

This is a one-time step per bank account destination. Multiple properties can share the same connected account.

## Out of Scope

- Owner-facing Stripe Connect onboarding (OAuth flow) — admin manages all connected accounts manually
- Per-property Stripe fee overrides (processing fee % / flat) — continues to use global site settings
- Automatic payout scheduling configuration — uses Stripe's default payout schedule per connected account
- Reporting or reconciliation views across connected accounts
