# Tothara — SaaS Conversion Roadmap

**Full spec:** `docs/superpowers/specs/2026-04-24-tothara-saas-conversion-design.md`  
**Total estimated time:** 7–8 weeks  
**Build order is strict** — each sub-project depends on the one before it.

---

## Sub-Project 1 — Multi-Tenancy Foundation
**Plan:** `docs/superpowers/plans/2026-04-24-tothara-sp1-multitenancy.md`  
**Status:** Plan written — ready to execute  
**Estimated tasks:** 20  
**Estimated time:** 2 weeks

### What it builds
- `organizations` and `organization_members` tables
- `organization_id` column added to every existing table (properties, rooms, bookings, ical_blocks, ical_sources, site_settings, email_templates, date_overrides, calendar_tasks, ai_prompts, payment configs)
- RLS policies rewritten to scope all data by organization
- Subdomain routing middleware (`{slug}.tothara.com` → `x-organization-id` header)
- `lib/organizations.ts` — org lookup by slug/domain
- `lib/org-context.ts` — `getOrgId()` / `getOrgIdFromRequest()` helpers
- Every public route, admin route, and API route scoped by org

### Done when
Every page and API route returns only data belonging to the tenant identified by subdomain. Two organizations on the same database cannot see each other's data. All tests pass.

---

## Sub-Project 2 — Auth Overhaul
**Plan:** To be written when SP1 is complete  
**Depends on:** SP1  
**Estimated tasks:** 12–15  
**Estimated time:** 1 week

### What it builds
- Public `/signup` page: business name, email, password, desired slug
- On signup: create Supabase Auth user → create `organizations` row → create `organization_members` row (role: owner) → redirect to onboarding wizard
- Supabase Auth trigger or server action: `provision_org(userId, orgName, slug)`
- `super_admins` table: `id, user_id, created_at` — Steven's user ID seeded at deploy time
- `/super-admin` route protection: server-side `super_admins` check
- Admin middleware update: validate logged-in user is a member of the org in the subdomain (not just any valid Supabase user)
- `/admin/login` page: works per-tenant (user logs into their org's subdomain)

### Done when
A new landlord can visit `tothara.com/signup`, fill out the form, and land in a working admin panel scoped to their new organization. The super-admin route is only accessible to Steven's account.

---

## Sub-Project 3 — Stripe Connect
**Plan:** To be written when SP2 is complete  
**Depends on:** SP1, SP2  
**Estimated tasks:** 12–15  
**Estimated time:** 1 week

### What it builds
- Stripe Connect Express OAuth flow: `/admin/settings/stripe` → "Connect Stripe" button → Stripe OAuth → `/api/stripe/connect/callback` → stores `stripe_account_id` on `organizations`
- `organizations.stripe_connect_status` updated via webhook
- All `stripe.checkout.sessions.create()` calls updated to use `payment_intent_data: { application_fee_amount, on_behalf_of: org.stripe_account_id }` (money flows to tenant, platform fee goes to Tothara)
- Stripe webhook handler updated: resolves `organization_id` from `stripe_account_id` before processing booking events
- `stripe_payout_accounts` table removed (superseded by `organizations.stripe_account_id`)
- Booking widget shows "Payment setup required" if `stripe_connect_status !== 'active'`
- Platform fee constant: `PLATFORM_FEE_PERCENT = 0.01` (1%, configurable)

### Done when
A tenant connects their Stripe account and a test guest booking routes payment directly to the tenant's Stripe account with a 1% platform fee deducted.

---

## Sub-Project 4 — Platform Billing
**Plan:** To be written when SP3 is complete  
**Depends on:** SP1, SP2  
**Estimated tasks:** 10–12  
**Estimated time:** 1 week

### What it builds
- Stripe product + price created in **Steven's** Stripe account (not Connect)
- Public `/signup` page updated: clicking "Start Free Trial" → creates Stripe Checkout session in platform account → on success, calls `provision_org` server action
- `provision_org` server action: creates Supabase Auth user (or finds existing), creates `organizations` row, creates `organization_members` row, sends magic-link setup email
- Landlord receives email → clicks link → sets password → lands in onboarding wizard
- `organizations.stripe_customer_id` and `stripe_subscription_id` populated on provision
- Stripe webhook (platform account events): updates `organizations.subscription_status` on `customer.subscription.updated`, `customer.subscription.deleted`
- Admin gate: if `subscription_status` is `past_due` or `canceled`, admin routes redirect to `/admin/resubscribe`
- `/admin/resubscribe` page: link to Stripe Customer Portal
- "Manage Billing" link in admin settings → Stripe Customer Portal session

### Done when
A new signup pays via Stripe Checkout, receives a setup email, sets their password, and lands in the admin. If their subscription lapses, admin access is gated until they resubscribe.

---

## Sub-Project 5 — Site Settings & White-Labeling
**Plan:** To be written when SP4 is complete  
**Depends on:** SP1  
**Estimated tasks:** 8–10  
**Estimated time:** 3 days

### What it builds
- New columns added to `site_settings`: `site_name TEXT`, `primary_color TEXT`, `accent_color TEXT`
- Admin settings page updated: fields for site name, primary color, accent color
- `getSiteSettings()` already org-scoped (done in SP1) — just needs new fields surfaced
- Public layout uses `site_name` for `<title>` and og tags (replaces hardcoded "Top of the Hill Rooms")
- Public layout injects CSS variables for `primary_color` and `accent_color` when set (falls back to existing teal defaults)
- Logo upload already works via existing `logo_url` / `logo_size` fields

### Done when
A tenant can set their business name, logo, and brand colors in admin settings. Their public booking site reflects those settings. Two tenants on the same platform have visually distinct sites.

---

## Sub-Project 6 — Onboarding Wizard
**Plan:** To be written when SP5 is complete  
**Depends on:** SP1–SP5  
**Estimated tasks:** 12–15  
**Estimated time:** 1 week

### What it builds
- New column: `organizations.onboarding_completed_steps JSONB DEFAULT '{}'`
- New route: `/onboarding` — 5-step wizard, only accessible to org owner
- Admin guard: if `onboarding_completed_steps` missing required steps, `/admin` redirects to `/onboarding`
- **Step 1 — Connect Stripe:** Stripe Connect OAuth button (SP3 flow). Marks `stripe: true` on completion.
- **Step 2 — Add Property:** Renders existing property creation form from tothrooms.com admin. Marks `property: true` on save.
- **Step 3 — Add First Room:** Renders existing room creation form. Marks `room: true` on save.
- **Step 4 — Branding:** Logo upload + site name + optional colors. Marks `branding: true` on save.
- **Step 5 — Go Live:** Shows their subdomain URL. Checklist of completed steps. "Go to Dashboard" button.
- Progress is persisted — navigating away and returning resumes at first incomplete step

### Done when
A newly signed-up landlord is guided through all 5 steps without needing to find anything in the admin. Completing the wizard unlocks the full admin dashboard.

---

## Sub-Project 7 — Super-Admin Dashboard
**Plan:** To be written when SP6 is complete  
**Depends on:** SP1–SP4  
**Estimated tasks:** 10–12  
**Estimated time:** 1 week

### What it builds
- New route: `/super-admin` — protected by `super_admins` table check (server-side, service role)
- `/super-admin` — tenant list:
  - Name, subdomain, subscription status, joined date
  - All-time booking count, all-time booking revenue
  - Quick actions: suspend (sets `subscription_status = 'canceled'`), activate
- `/super-admin` — platform metrics panel:
  - MRR: sum of active subscription amounts from Stripe API
  - Total active tenants: count where `subscription_status = 'active'`
  - Total bookings last 30 days (across all orgs)
  - Total platform fees collected: Stripe `application_fee` list API
- `/super-admin/[orgId]` — tenant detail page:
  - Properties count, rooms count, bookings count, revenue
  - Subscription status + billing info
  - Stripe Connect status
  - Last admin login

### Done when
Steven can visit `/super-admin`, see all tenants and their statuses, view platform-wide MRR and booking volume, and suspend/activate individual tenants.

---

## Post-MVP (after all 7 are done)

These are explicitly deferred until there are paying customers:

| Feature | Notes |
|---------|-------|
| Custom domains | Vercel Domains API — complex DNS management |
| Team member invites | Org admin inviting additional users |
| Advanced branding | Full color system, font selection |
| Rental type flexibility | Configurable unit types for RV parks, storage, etc. |
| Per-tenant GHL integration | Optional CRM per org |
| Tothara marketing site | Landing page, pricing page |
| Referral program | Post product-market fit |

---

## Migration (after MVP is live)

1. Create a `tothrooms` org in the Tothara platform
2. Migrate existing tothrooms.com data (properties, rooms, bookings) into that org
3. Point `tothrooms.com` DNS to Tothara platform (custom domain on Tenant #1)
4. Retire the standalone `Top-of-the-Hill-Estates` repo
