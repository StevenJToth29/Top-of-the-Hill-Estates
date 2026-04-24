# Tothara — SaaS Conversion Design Spec

**Date:** 2026-04-24  
**Product name:** Tothara  
**Base codebase:** Top-of-the-Hill-Estates (tothrooms.com)  
**Reference repo:** StevenJToth29/tothara (patterns only — no code migration)  
**Author:** Steven J. Toth

---

## Overview

Tothara is a white-label direct booking SaaS platform for rental operators — furnished rooms, vacation rentals, RV parks, storage units, and any business that needs a public-facing booking website. It is built by adding a SaaS wrapper (multi-tenancy, billing, Stripe Connect, onboarding, super-admin) around the existing tothrooms.com codebase, which already contains a battle-tested booking engine, admin portal, calendar, email system, and property/room management.

The tothrooms.com design, UI, booking flow, calendar, email templates, and admin experience are preserved exactly. Your own property (Top of the Hill Rooms) migrates onto the platform as Tenant #1 when the SaaS version is stable.

---

## Target Customers

- Furnished room / co-living operators (5–50 rooms, multiple properties)
- Vacation rental / short-term hosts (1–10 units)
- Future expansion: RV parks, storage units, any direct-booking rental type

---

## Hosting & Domain Model

- Default: `{slug}.tothara.com` (subdomain per tenant)
- Upgrade: tenant connects their own custom domain (post-MVP)
- The Tothara marketing/signup site lives at `tothara.com` (root domain)

---

## Pricing Model

- TBD — architecture supports flat monthly subscription, per-booking fee, or hybrid
- MVP billing uses flat monthly subscription (Stripe subscriptions)
- Plan price constant lives in code (`PLAN_PRICE_BASE`) and is updated when pricing is finalized

---

## Architecture

### Strategy

Fork `Top-of-the-Hill-Estates` into a new `tothara` repo. The tothrooms.com codebase becomes the Tothara product. All existing features (booking, admin, calendar, email, iCal, properties, rooms) are preserved. The SaaS wrapper is layered on top.

The existing `tothara` GitHub repo is used as a **reference only** for:
- The `organizations` + `organization_members` schema pattern
- The Stripe Connect OAuth flow pattern
- The subscription billing / checkout flow pattern
- The `provision_landlord_org` provisioning function pattern

No code is directly copied from the reference repo.

### Tech Stack (unchanged)

- **Framework:** Next.js 14 (App Router)
- **Database:** Supabase (PostgreSQL + RLS)
- **Auth:** Supabase Auth
- **Payments:** Stripe (Connect for tenant payments + Subscriptions for platform billing)
- **Styling:** Tailwind CSS (Editorial Glassmorphism — unchanged)
- **Hosting:** Vercel

### Tenant Isolation

Single shared Supabase database. Every tenant-owned table gets an `organization_id` foreign key. Row-Level Security policies scope all queries to the authenticated user's organization. This is the industry-standard approach and is already proven in the reference repo.

### Request Routing

Next.js middleware intercepts every request and resolves the current tenant from:
1. Subdomain: `{slug}.tothara.com` → lookup `organizations.slug`
2. Custom domain (post-MVP): exact `Host` header match against `organizations.custom_domain`

The resolved `organization_id` is injected into request headers so all server components and API routes can scope queries without re-fetching the org.

---

## Sub-Project 1: Multi-Tenancy Foundation

**Estimated time:** 2 weeks  
**Must complete before:** everything else

### New tables

```sql
organizations (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  slug text UNIQUE NOT NULL,           -- subdomain slug
  custom_domain text UNIQUE,           -- post-MVP
  owner_user_id uuid REFERENCES auth.users(id),
  stripe_customer_id text,             -- platform billing (your Stripe account)
  stripe_subscription_id text,
  subscription_status text,            -- active | trialing | past_due | canceled | inactive
  subscription_current_period_end timestamptz,
  stripe_account_id text,              -- Stripe Connect (tenant's own account)
  stripe_connect_status text,          -- not_connected | pending | active | restricted
  created_at timestamptz DEFAULT now()
)

organization_members (
  id uuid PRIMARY KEY,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role text CHECK (role IN ('owner', 'admin', 'member')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, user_id)
)
```

### Schema changes to existing tables

Add `organization_id uuid NOT NULL REFERENCES organizations(id)` to:
- `properties`
- `rooms`
- `bookings`
- `ical_blocks`
- `ical_sources`
- `site_settings` (converts from single-row global to one row per org)
- `email_templates`
- `date_overrides`
- `calendar_tasks`
- `ai_prompts`

Note: `stripe_payout_accounts` is NOT migrated — it is superseded by `organizations.stripe_account_id` and removed as part of Sub-project 3.

### RLS policy pattern

Every table policy follows this pattern:

```sql
USING (
  organization_id IN (
    SELECT organization_id FROM organization_members
    WHERE user_id = auth.uid()
  )
)
```

Super-admin bypass is handled server-side via service role client, not via RLS.

### Middleware

`middleware.ts` is extended to:
1. Extract subdomain from `Host` header
2. Look up `organizations` by slug
3. Set `x-organization-id` request header
4. Pass through — all downstream queries use this header to scope data

---

## Sub-Project 2: Auth Overhaul

**Estimated time:** 1 week  
**Depends on:** Sub-project 1

### Changes

- **Public signup page** (`/signup`): business name, email, password, desired subdomain. This page initiates the Stripe Checkout flow (Sub-project 4). The Supabase Auth user and `organizations` row are created after payment succeeds — not before. Sub-project 2 wires up the post-payment provisioning callback and the magic-link email flow.
- **On successful payment + provisioning:** Supabase Auth user created → `organizations` row created → `organization_members` row created (role: owner) → magic link emailed → landlord sets password → redirected to onboarding wizard
- **Super-admin role:** a `super_admins` table with `user_id`. Super-admin check happens server-side before rendering `/super-admin` routes. Steven's account is the initial super-admin.
- **Middleware update:** after resolving org from subdomain, validate that the logged-in user is a member of that org before allowing access to `/admin` routes
- **Existing admin auth:** the current Supabase Auth single-user pattern is replaced by org-scoped membership checks

### No tenant or owner portals

The residential tenant portal and owner portal from the tothara reference repo are explicitly out of scope. The only user roles in Tothara MVP are:
- `owner` — the landlord/operator who signed up (full admin access)
- `admin` — team member with full access (post-MVP)
- `member` — team member with restricted access (post-MVP)
- Super-admin — platform owner (Steven)

---

## Sub-Project 3: Stripe Connect

**Estimated time:** 1 week  
**Depends on:** Sub-projects 1 & 2

### How it works

Each Tothara tenant connects their own Stripe account via Stripe Connect Express. When a guest books and pays on their site:
- The charge goes directly to the tenant's connected Stripe account
- Tothara collects a platform fee (`application_fee_amount`) on each transaction
- Platform fee percentage is set in code (start at 1%, configurable)

### Changes

- **Connect OAuth flow:** `/admin/settings/stripe` → "Connect Stripe" button → Stripe OAuth → callback stores `stripe_account_id` on `organizations`
- **Checkout sessions:** all `stripe.checkout.sessions.create()` calls add `stripeAccount: org.stripe_account_id` (or `payment_intent_data.application_fee_amount`)
- **Webhooks:** Stripe Connect webhooks use the account-level event routing. The existing webhook handler is extended to resolve `organization_id` from the connected account ID before processing events
- **Payout accounts:** the existing `stripe_payout_accounts` table is superseded by `organizations.stripe_account_id` and can be removed

### Onboarding gate

Guests cannot complete bookings until the tenant has connected Stripe. The booking widget shows a "coming soon" message if `stripe_connect_status != 'active'`.

---

## Sub-Project 4: Platform Billing

**Estimated time:** 1 week  
**Depends on:** Sub-projects 1 & 2

### How it works

Tothara charges landlords a monthly subscription fee via Stripe Subscriptions in **Steven's** Stripe account (separate from Connect). This is the platform's revenue.

### Signup flow

1. Landlord fills out signup form → clicks "Start Free Trial" (or pays immediately)
2. Stripe Checkout session created in platform Stripe account
3. On success: `provision_org` server action creates `organizations` row, creates Supabase Auth user (or links existing), sends setup email
4. Landlord sets password via emailed magic link → lands in onboarding wizard

### Subscription management

- `organizations.subscription_status` updated via Stripe webhook (subscription events)
- If `subscription_status` is `past_due` or `canceled`, tenant's public booking site stays live but admin access is gated with a "resubscribe" prompt
- Billing portal: "Manage Billing" in admin settings opens Stripe Customer Portal

### Tables

`organizations` already holds all subscription fields (see Sub-project 1). No additional tables needed.

---

## Sub-Project 5: Site Settings & White-Labeling

**Estimated time:** 3 days  
**Depends on:** Sub-project 1

### Changes

The existing `site_settings` table (currently a single global row) becomes org-scoped by adding `organization_id`. The existing fields are preserved:
- `logo_url`, `logo_size`
- `contact_phone`, `contact_email`, `contact_address`
- `about_text`, `global_house_rules`
- `stripe_fee_percent`, `stripe_fee_flat`
- `cancellation_policy`

New fields added:
- `site_name` — the operator's business name shown on their public site
- `primary_color` — hex color (optional, defaults to tothrooms.com teal)
- `accent_color` — hex color (optional)
- `favicon_url` (already exists per migration `020_favicon_urls.sql`)

### Public site rendering

The existing `getSiteSettings()` function is updated to accept `organization_id` and cache per-org. The public booking site reads these settings for logo, colors, and contact info — exactly as tothrooms.com already works, just scoped per tenant.

No design changes to the public booking site. Layout, fonts, and glassmorphism system are unchanged.

---

## Sub-Project 6: Onboarding Wizard

**Estimated time:** 1 week  
**Depends on:** Sub-projects 1–5

### Flow

After a landlord completes signup/payment, they land at `/onboarding`. The wizard is a 5-step flow:

| Step | What happens |
|------|-------------|
| 1. Connect Stripe | OAuth flow to connect their Stripe account (Sub-project 3) |
| 2. Your property | Add first property using the existing property form (tothrooms.com admin UI) |
| 3. Your first room | Add first room using the existing room form |
| 4. Branding | Upload logo, set site name, optional colors |
| 5. Go live | Show their subdomain URL. Checklist of what's done. Link to admin dashboard |

### Progress tracking

`organizations.onboarding_completed_steps` — a `jsonb` column storing which steps are done:
```json
{ "stripe": true, "property": true, "room": false, "branding": false }
```

If a landlord navigates away mid-wizard, returning to `/onboarding` resumes at the first incomplete step.

### Gate

The admin dashboard (`/admin`) checks `onboarding_completed_steps`. If onboarding is not complete, it redirects to `/onboarding` instead of showing the full admin.

---

## Sub-Project 7: Super-Admin Dashboard

**Estimated time:** 1 week  
**Depends on:** Sub-projects 1–4

### Access

Route: `/super-admin`  
Protected by: `super_admins` table check (server-side, service role). Steven's user ID is seeded into `super_admins` at deploy time.

### Views

**Tenants list**
- Name, subdomain, plan, subscription status, joined date
- Booking count (all-time), revenue (all-time)
- Quick actions: view their admin, suspend, activate

**Platform metrics**
- MRR (sum of active subscription amounts)
- Total active tenants
- Total bookings (platform-wide, last 30 days / all-time)
- Total booking revenue flowing through platform
- Total platform fees collected (application_fee_amount sum from Stripe)

**Tenant detail page** (click into a tenant)
- Their specific stats: properties, rooms, bookings, revenue
- Subscription status + billing info
- Stripe Connect status
- Last login

### Data sources

- Tenant/subscription data: Supabase `organizations` table
- Booking/revenue data: Supabase `bookings` table (aggregated, scoped by org)
- Platform fees: Stripe API (`application_fee` list endpoint)

---

## Post-MVP Features (explicitly deferred)

These are out of scope for the initial launch and should not be built until the MVP is live with paying customers:

- Custom domains (Vercel Domains API — complex DNS management)
- Team member invites (org admin inviting additional users)
- Advanced branding (full color system, font selection)
- Rental type flexibility (configurable unit types for RV parks, storage, etc.)
- Per-tenant GHL/CRM integration
- Per-tenant email sending domain
- Referral/affiliate program
- Tothara marketing landing page / pricing page

---

## Migration Plan

1. Fork `Top-of-the-Hill-Estates` into a new `tothara-platform` repo (or rename)
2. Build sub-projects 1–7 in order
3. When MVP is stable, create an org in the platform for Top of the Hill Rooms
4. Migrate existing tothrooms.com data (properties, rooms, bookings) into the new org
5. Point `tothrooms.com` to the platform (as a custom domain on Tenant #1's org)
6. Retire the standalone `Top-of-the-Hill-Estates` repo

---

## Timeline Summary

| Sub-project | Est. |
|-------------|------|
| 1. Multi-tenancy foundation | 2 weeks |
| 2. Auth overhaul | 1 week |
| 3. Stripe Connect | 1 week |
| 4. Platform billing | 1 week |
| 5. Site settings + white-labeling | 3 days |
| 6. Onboarding wizard | 1 week |
| 7. Super-admin dashboard | 1 week |
| **Total** | **~7–8 weeks** |
