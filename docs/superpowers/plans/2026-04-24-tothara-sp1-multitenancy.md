# Tothara Sub-Project 1: Multi-Tenancy Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the single-tenant tothrooms.com codebase into the multi-tenant Tothara platform by adding an `organizations` table, scoping every database table by `organization_id`, and routing every request to the correct tenant via subdomain detection in middleware.

**Architecture:** A single Supabase database shared across all tenants. Every tenant-owned table gets an `organization_id` foreign key. The Next.js middleware detects the tenant from the subdomain (`{slug}.tothara.com`) and injects `x-organization-id` into request headers. All server components and API routes read this header to scope their queries. RLS policies provide defense-in-depth. For local development, a `DEFAULT_ORG_SLUG` env var bypasses subdomain detection.

**Tech Stack:** Next.js 14 App Router, Supabase (PostgreSQL + RLS), `next/headers` for server-side header access, `@supabase/ssr` for auth middleware.

---

## File Map

**New files:**
- `supabase/migrations/025_organizations.sql` — organizations + organization_members tables + RLS
- `supabase/migrations/026_add_org_id.sql` — add organization_id to all existing tables + rewrite RLS + backfill
- `supabase/migrations/027_dev_seed_org.sql` — seed a default org for local development
- `lib/organizations.ts` — server-side org lookup functions
- `lib/org-context.ts` — `getOrgId()` helper for server components and API routes
- `__tests__/lib/organizations.test.ts` — unit tests for org lookup

**Modified files:**
- `middleware.ts` — add subdomain detection + org header injection (runs on all routes)
- `types/index.ts` — add `Organization` and `OrganizationMember` types
- `lib/site-settings.ts` — accept `orgId` parameter
- `app/(public)/layout.tsx` — pass `orgId` to `getSiteSettings()`
- `app/(public)/page.tsx` — scope rooms/properties queries by org
- `app/(public)/rooms/[slug]/page.tsx` — scope room query by org
- `app/(public)/booking/page.tsx` — scope booking lookup by org
- `app/(public)/checkout/page.tsx` — scope checkout by org
- `app/(public)/apply/page.tsx` — scope apply by org
- `app/(public)/contact/page.tsx` — scope contact by org
- `app/admin/(protected)/layout.tsx` — verify user belongs to org from header
- `app/api/rooms/route.ts` — scope by org
- `app/api/rooms/[slug]/route.ts` — scope by org
- `app/api/bookings/route.ts` — scope by org
- `app/api/bookings/[id]/cancel/route.ts` — scope by org
- `app/api/bookings/[id]/cancel/guest/route.ts` — scope by org
- `app/api/bookings/[id]/confirm/route.ts` — scope by org
- `app/api/bookings/[id]/edit/route.ts` — scope by org
- `app/api/bookings/[id]/modify/route.ts` — scope by org
- `app/api/bookings/[id]/reinstate/route.ts` — scope by org
- `app/api/bookings/[id]/payment-method/route.ts` — scope by org
- `app/api/bookings/[id]/modification-requests/[reqId]/route.ts` — scope by org
- `app/api/contact/route.ts` — scope by org
- `app/api/inquiries/route.ts` — scope by org
- `app/api/admin/properties/route.ts` — scope by org
- `app/api/admin/rooms/route.ts` — scope by org
- `app/api/admin/rooms/[id]/route.ts` — scope by org
- `app/api/admin/rooms/[id]/calendar/route.ts` — scope by org
- `app/api/admin/rooms/[id]/duplicate/route.ts` — scope by org
- `app/api/admin/settings/route.ts` — scope by org
- `app/api/admin/calendar/route.ts` — scope by org
- `app/api/admin/calendar-tasks/route.ts` — scope by org
- `app/api/admin/calendar-tasks/[id]/route.ts` — scope by org
- `app/api/admin/date-overrides/route.ts` — scope by org
- `app/api/admin/ical-sources/route.ts` — scope by org
- `app/api/admin/ical-sources/[id]/route.ts` — scope by org
- `app/api/admin/ical-sources/sync/route.ts` — scope by org
- `app/api/admin/ical-sync/route.ts` — scope by org
- `app/api/admin/payout-accounts/route.ts` — scope by org (deprecated in SP3, keep for now)
- `app/api/admin/payout-accounts/[id]/route.ts` — scope by org
- `app/api/admin/payment-method-configs/route.ts` — scope by org
- `app/api/admin/payment-method-configs/[id]/route.ts` — scope by org
- `app/api/admin/email/templates/route.ts` — scope by org
- `app/api/admin/email/templates/[id]/route.ts` — scope by org
- `app/api/admin/email/automations/route.ts` — scope by org
- `app/api/admin/email/automations/[id]/route.ts` — scope by org
- `app/api/admin/email/settings/route.ts` — scope by org
- `app/api/admin/bookings/manual/route.ts` — scope by org
- `app/api/admin/bookings/[id]/status/route.ts` — scope by org
- `app/api/admin/bookings/[id]/edit/route.ts` — scope by org
- `app/api/admin/bookings/[id]/reinstate/route.ts` — scope by org
- `app/api/admin/bookings/[id]/modification-requests/[reqId]/route.ts` — scope by org
- `app/api/admin/ai/generate/route.ts` — scope by org
- `app/api/admin/stripe/account-session/route.ts` — scope by org
- `app/api/ical/[token]/route.ts` — resolve org from room token (no subdomain needed)
- `app/api/ical/sync/route.ts` — iterate all orgs (cron — no org filter)
- `app/api/cron/expire-pending-bookings/route.ts` — iterate all orgs (no org filter)
- `app/api/cron/process-email-queue/route.ts` — iterate all orgs (no org filter)
- `app/api/stripe/webhook/route.ts` — resolve org from booking's org_id

---

## Task 1: Fork repo and initialize Tothara project

**Files:**
- Modify: `package.json`
- Modify: `.env.example`
- Modify: `README.md`

- [ ] **Step 1: Create new GitHub repo**

In GitHub, go to `StevenJToth29/Top-of-the-Hill-Estates` → "Use this template" or manually: create `StevenJToth29/tothara-platform`, then push a copy:
```bash
# Run these manually in your terminal
git clone https://github.com/StevenJToth29/Top-of-the-Hill-Estates.git tothara-platform
cd tothara-platform
git remote set-url origin https://github.com/StevenJToth29/tothara-platform.git
git push -u origin main
```

- [ ] **Step 2: Update package.json name**

In `package.json`, change:
```json
{
  "name": "tothara-platform",
  "version": "0.1.0"
}
```

- [ ] **Step 3: Add org env vars to .env.example**

Add to `.env.example`:
```bash
# Multi-tenancy
# Used in local development when there is no subdomain.
# Set to the slug of your default organization (e.g. "tothrooms").
DEFAULT_ORG_SLUG=tothrooms

# The root domain for tenant subdomains (no protocol, no trailing slash).
# e.g. "tothara.com" → tenants get "{slug}.tothara.com"
NEXT_PUBLIC_ROOT_DOMAIN=tothara.com
```

- [ ] **Step 4: Commit**

```bash
git add package.json .env.example
git commit -m "chore: initialize tothara-platform repo"
```

---

## Task 2: Add Organization types

**Files:**
- Modify: `types/index.ts`

- [ ] **Step 1: Read current types**

Open `types/index.ts` and find the end of the file.

- [ ] **Step 2: Add Organization types**

Append to the end of `types/index.ts`:
```typescript
export type Organization = {
  id: string
  name: string
  slug: string
  custom_domain: string | null
  owner_user_id: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  subscription_status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'inactive'
  subscription_current_period_end: string | null
  stripe_account_id: string | null
  stripe_connect_status: 'not_connected' | 'pending' | 'active' | 'restricted'
  onboarding_completed_steps: {
    stripe?: boolean
    property?: boolean
    room?: boolean
    branding?: boolean
  }
  created_at: string
}

export type OrganizationMember = {
  id: string
  organization_id: string
  user_id: string
  role: 'owner' | 'admin' | 'member'
  created_at: string
}
```

- [ ] **Step 3: Commit**

```bash
git add types/index.ts
git commit -m "feat: add Organization and OrganizationMember types"
```

---

## Task 3: Organizations schema migration

**Files:**
- Create: `supabase/migrations/025_organizations.sql`

- [ ] **Step 1: Create migration file**

Create `supabase/migrations/025_organizations.sql`:
```sql
-- organizations table
CREATE TABLE organizations (
  id                              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                            TEXT NOT NULL,
  slug                            TEXT UNIQUE NOT NULL,
  custom_domain                   TEXT UNIQUE,
  owner_user_id                   UUID REFERENCES auth.users(id),
  stripe_customer_id              TEXT,
  stripe_subscription_id          TEXT,
  subscription_status             TEXT NOT NULL DEFAULT 'inactive'
    CHECK (subscription_status IN ('active', 'trialing', 'past_due', 'canceled', 'inactive')),
  subscription_current_period_end TIMESTAMPTZ,
  stripe_account_id               TEXT,
  stripe_connect_status           TEXT NOT NULL DEFAULT 'not_connected'
    CHECK (stripe_connect_status IN ('not_connected', 'pending', 'active', 'restricted')),
  onboarding_completed_steps      JSONB NOT NULL DEFAULT '{}',
  created_at                      TIMESTAMPTZ DEFAULT NOW()
);

-- organization_members table
CREATE TABLE organization_members (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role            TEXT NOT NULL DEFAULT 'owner'
    CHECK (role IN ('owner', 'admin', 'member')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (organization_id, user_id)
);

-- Indexes
CREATE INDEX idx_organizations_slug         ON organizations(slug);
CREATE INDEX idx_organizations_custom_domain ON organizations(custom_domain);
CREATE INDEX idx_org_members_user_id        ON organization_members(user_id);
CREATE INDEX idx_org_members_org_id         ON organization_members(organization_id);

-- RLS
ALTER TABLE organizations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

-- Organizations: readable by members, writable by owner
CREATE POLICY "org_read_by_members" ON organizations
  FOR SELECT USING (
    id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "org_update_by_owner" ON organizations
  FOR UPDATE USING (owner_user_id = auth.uid());

-- Organization members: readable by members of same org
CREATE POLICY "org_members_read_own_org" ON organization_members
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members om2
      WHERE om2.user_id = auth.uid()
    )
  );
```

- [ ] **Step 2: Run migration against local Supabase**

```bash
supabase db reset
```
Expected: migration runs without errors, tables `organizations` and `organization_members` exist.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/025_organizations.sql
git commit -m "feat: add organizations and organization_members tables"
```

---

## Task 4: Add organization_id to all existing tables

**Files:**
- Create: `supabase/migrations/026_add_org_id.sql`

- [ ] **Step 1: Create migration file**

Create `supabase/migrations/026_add_org_id.sql`:
```sql
-- ─── 1. Add organization_id columns (nullable first for backfill) ───────────

ALTER TABLE properties        ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE rooms              ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE bookings           ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE ical_blocks        ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE ical_sources       ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE site_settings      ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE email_templates    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE email_automations  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE email_settings     ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE date_overrides     ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE calendar_tasks     ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE ai_prompts         ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

-- stripe_payout_accounts is superseded by organizations.stripe_account_id in SP3.
-- Add org_id now for safety; it will be dropped in the SP3 migration.
ALTER TABLE stripe_payout_accounts ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE payment_method_configs ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

-- ─── 2. Create default org for existing data ─────────────────────────────────

-- This seeds the initial organization that owns all existing single-tenant data.
-- Update the slug and name to match your production property.
INSERT INTO organizations (id, name, slug, subscription_status, stripe_connect_status)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Top of the Hill Rooms',
  'tothrooms',
  'active',
  'not_connected'
)
ON CONFLICT (id) DO NOTHING;

-- ─── 3. Backfill all existing rows with default org ───────────────────────────

UPDATE properties              SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE rooms                   SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE bookings                SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE ical_blocks             SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE ical_sources            SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE site_settings           SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE email_templates         SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE email_automations       SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE email_settings          SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE date_overrides          SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE calendar_tasks          SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE ai_prompts              SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE stripe_payout_accounts  SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE payment_method_configs  SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;

-- ─── 4. Make columns NOT NULL ────────────────────────────────────────────────

ALTER TABLE properties              ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE rooms                   ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE bookings                ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE ical_blocks             ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE ical_sources            ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE site_settings           ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE email_templates         ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE email_automations       ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE email_settings          ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE date_overrides          ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE calendar_tasks          ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE ai_prompts              ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE stripe_payout_accounts  ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE payment_method_configs  ALTER COLUMN organization_id SET NOT NULL;

-- ─── 5. Indexes ───────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_properties_org_id      ON properties(organization_id);
CREATE INDEX IF NOT EXISTS idx_rooms_org_id           ON rooms(organization_id);
CREATE INDEX IF NOT EXISTS idx_bookings_org_id        ON bookings(organization_id);
CREATE INDEX IF NOT EXISTS idx_ical_blocks_org_id     ON ical_blocks(organization_id);
CREATE INDEX IF NOT EXISTS idx_ical_sources_org_id    ON ical_sources(organization_id);
CREATE INDEX IF NOT EXISTS idx_site_settings_org_id   ON site_settings(organization_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_org_id ON email_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_date_overrides_org_id  ON date_overrides(organization_id);
CREATE INDEX IF NOT EXISTS idx_calendar_tasks_org_id  ON calendar_tasks(organization_id);

-- ─── 6. Rewrite RLS policies ──────────────────────────────────────────────────
-- The multi-tenant RLS pattern: a row is accessible if the authenticated user
-- is a member of the row's organization. Service role bypasses RLS (used by API routes).

-- Helper: returns the org IDs the current user belongs to.
-- Inlined in every policy to avoid function call overhead.

-- properties
DROP POLICY IF EXISTS "Allow authenticated access" ON properties;
DROP POLICY IF EXISTS "properties_org_access" ON properties;
CREATE POLICY "properties_org_access" ON properties
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- rooms
DROP POLICY IF EXISTS "Allow authenticated access" ON rooms;
DROP POLICY IF EXISTS "rooms_org_access" ON rooms;
CREATE POLICY "rooms_org_access" ON rooms
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );
-- Public read for active rooms (guests browse without auth)
CREATE POLICY "rooms_public_read" ON rooms
  FOR SELECT USING (is_active = true);

-- bookings
DROP POLICY IF EXISTS "Allow authenticated access" ON bookings;
DROP POLICY IF EXISTS "bookings_org_access" ON bookings;
CREATE POLICY "bookings_org_access" ON bookings
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- ical_blocks
DROP POLICY IF EXISTS "Allow authenticated access" ON ical_blocks;
CREATE POLICY "ical_blocks_org_access" ON ical_blocks
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- ical_sources
DROP POLICY IF EXISTS "Allow authenticated access" ON ical_sources;
CREATE POLICY "ical_sources_org_access" ON ical_sources
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- site_settings
DROP POLICY IF EXISTS "Allow authenticated access" ON site_settings;
CREATE POLICY "site_settings_org_access" ON site_settings
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- email_templates
DROP POLICY IF EXISTS "Allow authenticated access" ON email_templates;
CREATE POLICY "email_templates_org_access" ON email_templates
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- email_automations
DROP POLICY IF EXISTS "Allow authenticated access" ON email_automations;
CREATE POLICY "email_automations_org_access" ON email_automations
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- email_settings
DROP POLICY IF EXISTS "Allow authenticated access" ON email_settings;
CREATE POLICY "email_settings_org_access" ON email_settings
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- date_overrides
DROP POLICY IF EXISTS "Allow authenticated access" ON date_overrides;
CREATE POLICY "date_overrides_org_access" ON date_overrides
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- calendar_tasks
DROP POLICY IF EXISTS "Allow authenticated access" ON calendar_tasks;
CREATE POLICY "calendar_tasks_org_access" ON calendar_tasks
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- ai_prompts
DROP POLICY IF EXISTS "Allow authenticated access" ON ai_prompts;
CREATE POLICY "ai_prompts_org_access" ON ai_prompts
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- stripe_payout_accounts
DROP POLICY IF EXISTS "Allow authenticated access" ON stripe_payout_accounts;
CREATE POLICY "payout_accounts_org_access" ON stripe_payout_accounts
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- payment_method_configs
DROP POLICY IF EXISTS "Allow authenticated access" ON payment_method_configs;
CREATE POLICY "payment_method_configs_org_access" ON payment_method_configs
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );
```

- [ ] **Step 2: Run migration**

```bash
supabase db reset
```
Expected: all tables gain `organization_id`, existing rows backfilled, migration completes without errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/026_add_org_id.sql
git commit -m "feat: add organization_id to all tables and rewrite RLS policies"
```

---

## Task 5: Dev seed — link admin user to default org

**Files:**
- Create: `supabase/migrations/027_dev_seed_org.sql`

- [ ] **Step 1: Create migration**

This migration links your existing Supabase Auth admin user to the default org. **Replace the placeholder email** with your actual admin email.

Create `supabase/migrations/027_dev_seed_org.sql`:
```sql
-- Links the existing admin user to the default organization.
-- Replace 'your-admin@email.com' with the actual admin email used in local dev.
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'your-admin@email.com'
  LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    -- Set as owner of the default org
    UPDATE organizations
    SET owner_user_id = v_user_id
    WHERE id = '00000000-0000-0000-0000-000000000001';

    -- Add to organization_members if not already there
    INSERT INTO organization_members (organization_id, user_id, role)
    VALUES ('00000000-0000-0000-0000-000000000001', v_user_id, 'owner')
    ON CONFLICT (organization_id, user_id) DO NOTHING;
  END IF;
END $$;
```

- [ ] **Step 2: Run migration**

```bash
supabase db reset
```
Expected: your admin user is now linked to the default org.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/027_dev_seed_org.sql
git commit -m "feat: dev seed — link admin user to default organization"
```

---

## Task 6: Organization lookup library

**Files:**
- Create: `lib/organizations.ts`
- Create: `__tests__/lib/organizations.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/organizations.test.ts`:
```typescript
import { resolveOrgSlug } from '@/lib/organizations'

jest.mock('@/lib/supabase', () => ({
  createServiceRoleClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          maybeSingle: jest.fn().mockResolvedValue({
            data: { id: 'org-123', slug: 'testorg', name: 'Test Org' },
            error: null,
          }),
        })),
      })),
    })),
  })),
}))

describe('resolveOrgSlug', () => {
  it('returns org when found', async () => {
    const org = await resolveOrgSlug('testorg')
    expect(org).not.toBeNull()
    expect(org?.id).toBe('org-123')
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx jest __tests__/lib/organizations.test.ts
```
Expected: FAIL — `Cannot find module '@/lib/organizations'`

- [ ] **Step 3: Create lib/organizations.ts**

Create `lib/organizations.ts`:
```typescript
import { createServiceRoleClient } from '@/lib/supabase'
import type { Organization } from '@/types'

export async function resolveOrgSlug(slug: string): Promise<Organization | null> {
  const supabase = createServiceRoleClient()
  const { data } = await supabase
    .from('organizations')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()
  return data ?? null
}

export async function resolveOrgDomain(domain: string): Promise<Organization | null> {
  const supabase = createServiceRoleClient()
  const { data } = await supabase
    .from('organizations')
    .select('*')
    .eq('custom_domain', domain)
    .maybeSingle()
  return data ?? null
}

export async function getOrgForUser(userId: string): Promise<Organization | null> {
  const supabase = createServiceRoleClient()
  const { data } = await supabase
    .from('organization_members')
    .select('organizations(*)')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()
  return (data?.organizations as unknown as Organization) ?? null
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npx jest __tests__/lib/organizations.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/organizations.ts __tests__/lib/organizations.test.ts
git commit -m "feat: add organization lookup library"
```

---

## Task 7: Organization context helper

**Files:**
- Create: `lib/org-context.ts`

This helper is the single source of truth for getting `orgId` in server components and API routes. It reads the `x-organization-id` header that middleware will set (Task 8).

- [ ] **Step 1: Create lib/org-context.ts**

Create `lib/org-context.ts`:
```typescript
import { headers } from 'next/headers'

/**
 * Returns the organization ID for the current request.
 * The middleware sets x-organization-id on every request based on subdomain.
 * Returns null if no org is in context (should not happen in production).
 */
export async function getOrgId(): Promise<string | null> {
  const headersList = await headers()
  return headersList.get('x-organization-id')
}

/**
 * Like getOrgId() but throws if missing. Use in routes where org is required.
 */
export async function requireOrgId(): Promise<string> {
  const orgId = await getOrgId()
  if (!orgId) throw new Error('No organization in request context')
  return orgId
}

/**
 * API route version — reads from NextRequest headers directly.
 * Use this in route handlers (they receive the request object).
 */
export function getOrgIdFromRequest(request: Request): string | null {
  return request.headers.get('x-organization-id')
}

/**
 * API route version that throws if missing.
 */
export function requireOrgIdFromRequest(request: Request): string {
  const orgId = getOrgIdFromRequest(request)
  if (!orgId) throw new Error('No organization in request context')
  return orgId
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/org-context.ts
git commit -m "feat: add org-context helper for server components and API routes"
```

---

## Task 8: Update middleware for subdomain detection

**Files:**
- Modify: `middleware.ts`

- [ ] **Step 1: Replace middleware.ts**

Replace the entire contents of `middleware.ts`:
```typescript
import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { resolveOrgSlug, resolveOrgDomain } from '@/lib/organizations'

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'tothara.com'
const DEFAULT_ORG_SLUG = process.env.DEFAULT_ORG_SLUG ?? ''

async function resolveOrg(request: NextRequest): Promise<string | null> {
  const host = request.headers.get('host') ?? ''

  // Local development: no subdomain, use DEFAULT_ORG_SLUG env var
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    if (!DEFAULT_ORG_SLUG) return null
    const org = await resolveOrgSlug(DEFAULT_ORG_SLUG)
    return org?.id ?? null
  }

  // Check for custom domain match first
  const byDomain = await resolveOrgDomain(host)
  if (byDomain) return byDomain.id

  // Subdomain: e.g. "acme.tothara.com" → slug "acme"
  if (host.endsWith(`.${ROOT_DOMAIN}`)) {
    const slug = host.replace(`.${ROOT_DOMAIN}`, '')
    // Ignore www and root domain itself
    if (slug && slug !== 'www') {
      const org = await resolveOrgSlug(slug)
      return org?.id ?? null
    }
  }

  return null
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Resolve org for this request
  const orgId = await resolveOrg(request)

  // Build response — we'll mutate headers on it
  const response = NextResponse.next({
    request: {
      headers: new Headers(request.headers),
    },
  })

  // Inject org ID into request headers so server components can read it
  if (orgId) {
    response.headers.set('x-organization-id', orgId)
    // Also set on the forwarded request headers
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-organization-id', orgId)
    return NextResponse.next({
      request: { headers: requestHeaders },
    })
  }

  // Admin auth guard — unchanged from original
  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
      {
        cookies: {
          getAll() { return request.cookies.getAll() },
          setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
            cookiesToSet.forEach(({ name, value, options }) => {
              request.cookies.set(name, value)
              response.cookies.set(name, value, options)
            })
          },
        },
      },
    )

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      const loginUrl = new URL('/admin/login', request.url)
      loginUrl.searchParams.set('redirectTo', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

- [ ] **Step 2: Start dev server and verify no errors**

```bash
npm run dev
```
Expected: server starts without TypeScript errors. Visit `http://localhost:3000` — the page loads (may show no data yet since DEFAULT_ORG_SLUG isn't set in .env.local).

- [ ] **Step 3: Add DEFAULT_ORG_SLUG to .env.local**

Add to `.env.local`:
```
DEFAULT_ORG_SLUG=tothrooms
NEXT_PUBLIC_ROOT_DOMAIN=tothara.com
```

- [ ] **Step 4: Restart dev server and confirm org resolves**

```bash
npm run dev
```
Visit `http://localhost:3000` — should now load rooms from the `tothrooms` org.

- [ ] **Step 5: Commit**

```bash
git add middleware.ts .env.example
git commit -m "feat: add subdomain-based org detection to middleware"
```

---

## Task 9: Update site-settings to be org-scoped

**Files:**
- Modify: `lib/site-settings.ts`

- [ ] **Step 1: Replace lib/site-settings.ts**

```typescript
import { unstable_cache } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase'

export const getSiteSettings = (orgId: string) =>
  unstable_cache(
    async () => {
      const supabase = createServiceRoleClient()
      const { data } = await supabase
        .from('site_settings')
        .select(
          'logo_url, logo_size, contact_phone, contact_email, contact_address, about_text, global_house_rules, stripe_fee_percent, stripe_fee_flat, cancellation_policy',
        )
        .eq('organization_id', orgId)
        .limit(1)
        .maybeSingle()
      return data ?? null
    },
    [`site_settings_${orgId}`],
    { revalidate: 3600, tags: [`site_settings_${orgId}`] },
  )()
```

- [ ] **Step 2: Commit**

```bash
git add lib/site-settings.ts
git commit -m "feat: scope site-settings to organization"
```

---

## Task 10: Update public layout

**Files:**
- Modify: `app/(public)/layout.tsx`

- [ ] **Step 1: Replace app/(public)/layout.tsx**

```typescript
import Script from 'next/script'
import Navbar from '@/components/public/Navbar'
import Footer from '@/components/public/Footer'
import { getSiteSettings } from '@/lib/site-settings'
import { getOrgId } from '@/lib/org-context'

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const orgId = await getOrgId()
  const settings = orgId ? await getSiteSettings(orgId) : null

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar logoUrl={settings?.logo_url ?? undefined} logoSize={settings?.logo_size ?? 52} />
      <main className="flex-1">{children}</main>
      <Footer
        logoUrl={settings?.logo_url ?? undefined}
        logoSize={settings?.logo_size ?? 52}
        phone={settings?.contact_phone ?? undefined}
        email={settings?.contact_email ?? undefined}
        address={settings?.contact_address ?? undefined}
      />
      <Script
        src="https://widgets.leadconnectorhq.com/loader.js"
        data-resources-url="https://widgets.leadconnectorhq.com/chat-widget/loader.js"
        data-widget-id="69c47f3613ad148094a417bf"
        strategy="lazyOnload"
      />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/(public)/layout.tsx"
git commit -m "feat: scope public layout to org"
```

---

## Task 11: Update public homepage

**Files:**
- Modify: `app/(public)/page.tsx`

- [ ] **Step 1: Replace app/(public)/page.tsx**

```typescript
import type { Metadata } from 'next'
import { createServiceRoleClient } from '@/lib/supabase'
import type { Property, Room } from '@/types'
import { getSiteSettings } from '@/lib/site-settings'
import { getOrgId } from '@/lib/org-context'
import Hero from '@/components/public/Hero'
import AboutSection from '@/components/public/AboutSection'
import PropertiesSection from '@/components/public/PropertiesSection'
import ReviewsSection from '@/components/public/ReviewsSection'
import ContactForm from '@/components/public/ContactForm'

export const metadata: Metadata = {
  title: 'Room Rentals — Book Direct',
  description: 'Book direct and skip the platform fees.',
}

const DEFAULT_ABOUT = 'Welcome. Book directly with us for the best rates and no platform fees.'

async function getData(orgId: string) {
  try {
    const supabase = createServiceRoleClient()

    const [roomsResult, settings] = await Promise.all([
      supabase
        .from('rooms')
        .select('*, property:properties(*)')
        .eq('organization_id', orgId)
        .eq('is_active', true)
        .order('name'),
      getSiteSettings(orgId),
    ])

    const rooms: Array<Room & { property: Property }> = roomsResult.data ?? []

    const propertyMap = new Map<string, Property & { rooms: Room[] }>()
    for (const room of rooms) {
      if (!room.property) continue
      const existing = propertyMap.get(room.property_id)
      if (existing) {
        existing.rooms.push(room)
      } else {
        propertyMap.set(room.property_id, { ...room.property, rooms: [room] })
      }
    }

    return {
      properties: Array.from(propertyMap.values()),
      aboutText: settings?.about_text ?? DEFAULT_ABOUT,
    }
  } catch {
    return { properties: [], aboutText: DEFAULT_ABOUT }
  }
}

export default async function HomePage() {
  const orgId = await getOrgId()
  if (!orgId) return <div>Site not found.</div>

  const { properties, aboutText } = await getData(orgId)

  return (
    <>
      <Hero />
      <AboutSection aboutText={aboutText} />
      <PropertiesSection properties={properties} />
      <ReviewsSection />
      <section id="contact" className="bg-background py-16 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <h2 className="font-display text-3xl font-bold text-primary mb-2">Get in Touch</h2>
          <p className="text-on-surface-variant font-body mb-8">
            Questions about availability or pricing? We&apos;d love to hear from you.
          </p>
          <ContactForm />
        </div>
      </section>
    </>
  )
}
```

- [ ] **Step 2: Visit the homepage and verify rooms load**

```bash
npm run dev
```
Visit `http://localhost:3000` — properties and rooms for the `tothrooms` org should appear.

- [ ] **Step 3: Commit**

```bash
git add "app/(public)/page.tsx"
git commit -m "feat: scope public homepage to org"
```

---

## Task 12: Update admin layout

**Files:**
- Modify: `app/admin/(protected)/layout.tsx`

- [ ] **Step 1: Replace app/admin/(protected)/layout.tsx**

```typescript
import type { Metadata } from 'next'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import AdminSidebar from '@/components/admin/AdminSidebar'
import { getOrgId } from '@/lib/org-context'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/admin/login')
  }

  const orgId = await getOrgId()

  // Verify the authenticated user belongs to this org
  if (orgId) {
    const serviceClient = createServiceRoleClient()
    const { data: membership } = await serviceClient
      .from('organization_members')
      .select('id')
      .eq('organization_id', orgId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!membership) {
      redirect('/admin/login')
    }
  }

  const serviceClient = createServiceRoleClient()
  const { data: settings } = await serviceClient
    .from('site_settings')
    .select('logo_url, logo_size')
    .eq('organization_id', orgId ?? '')
    .limit(1)
    .maybeSingle()

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AdminSidebar logoUrl={settings?.logo_url ?? undefined} logoSize={settings?.logo_size ?? 52} />
      <main className="flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  )
}
```

- [ ] **Step 2: Verify admin still loads**

Visit `http://localhost:3000/admin` — should redirect to login. Log in and confirm the admin panel loads.

- [ ] **Step 3: Commit**

```bash
git add "app/admin/(protected)/layout.tsx"
git commit -m "feat: verify org membership in admin layout"
```

---

## Task 13: Update public API routes

**Files:**
- Modify: `app/api/rooms/route.ts`
- Modify: `app/api/rooms/[slug]/route.ts`
- Modify: `app/api/contact/route.ts`
- Modify: `app/api/inquiries/route.ts`

- [ ] **Step 1: Update app/api/rooms/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase'
import { getAvailableRoomIds } from '@/lib/availability'
import { getOrgIdFromRequest } from '@/lib/org-context'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const MAX_STAY_DAYS = 365

export async function GET(request: NextRequest) {
  const orgId = getOrgIdFromRequest(request)
  if (!orgId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { searchParams } = new URL(request.url)
  const propertyFilter = searchParams.get('property')
  const guestsFilter = searchParams.get('guests')
  const checkin = searchParams.get('checkin')
  const checkout = searchParams.get('checkout')

  if (checkin && checkout) {
    if (!DATE_RE.test(checkin) || !DATE_RE.test(checkout)) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 })
    }
    const checkinDate = new Date(checkin)
    const checkoutDate = new Date(checkout)
    if (checkoutDate <= checkinDate) {
      return NextResponse.json({ error: 'checkout must be after checkin' }, { status: 400 })
    }
    const stayDays = (checkoutDate.getTime() - checkinDate.getTime()) / 86_400_000
    if (stayDays > MAX_STAY_DAYS) {
      return NextResponse.json({ error: 'Date range too large' }, { status: 400 })
    }
  }

  const supabase = createServiceRoleClient()

  let query = supabase
    .from('rooms')
    .select('*, property:properties(*)')
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .order('name')

  if (guestsFilter) {
    query = query.gte('guest_capacity', parseInt(guestsFilter))
  }

  const { data: rooms, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let filteredRooms = (rooms ?? []).filter(
    (room) => !propertyFilter || room.property?.name === propertyFilter,
  )

  if (checkin && checkout) {
    const availableIds = await getAvailableRoomIds(
      filteredRooms.map((r) => r.id),
      checkin,
      checkout,
    )
    filteredRooms = filteredRooms.filter((r) => availableIds.has(r.id))
  }

  return NextResponse.json({ rooms: filteredRooms })
}
```

- [ ] **Step 2: Update app/api/rooms/[slug]/route.ts**

Read the current file first, then add `organization_id` filter to the rooms query. The key change is adding `.eq('organization_id', orgId)`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase'
import { getOrgIdFromRequest } from '@/lib/org-context'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const orgId = getOrgIdFromRequest(request)
  if (!orgId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { slug } = await params
  const supabase = createServiceRoleClient()

  const { data: room, error } = await supabase
    .from('rooms')
    .select('*, property:properties(*)')
    .eq('slug', slug)
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 })

  return NextResponse.json({ room })
}
```

- [ ] **Step 3: Update app/api/contact/route.ts**

Read the current file. Add `organization_id` to any DB inserts or queries. The contact route stores inquiries — add `orgId` to the insert:

```typescript
// At the top of the handler, add:
const orgId = getOrgIdFromRequest(request)
if (!orgId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

// Add to any DB insert:
// .insert({ ...data, organization_id: orgId })
```

Open `app/api/contact/route.ts`, import `getOrgIdFromRequest`, extract `orgId`, and add `.eq('organization_id', orgId)` to reads and include `organization_id: orgId` in writes.

- [ ] **Step 4: Update app/api/inquiries/route.ts**

Same pattern as contact — add `getOrgIdFromRequest`, scope reads with `.eq('organization_id', orgId)`, and include `organization_id: orgId` in inserts.

- [ ] **Step 5: Commit**

```bash
git add "app/api/rooms/route.ts" "app/api/rooms/[slug]/route.ts" "app/api/contact/route.ts" "app/api/inquiries/route.ts"
git commit -m "feat: scope public API routes to organization"
```

---

## Task 14: Update bookings API routes

**Files:**
- Modify: `app/api/bookings/route.ts`
- Modify: `app/api/bookings/[id]/cancel/route.ts`
- Modify: `app/api/bookings/[id]/cancel/guest/route.ts`
- Modify: `app/api/bookings/[id]/confirm/route.ts`
- Modify: `app/api/bookings/[id]/modify/route.ts`
- Modify: `app/api/bookings/[id]/reinstate/route.ts`
- Modify: `app/api/bookings/[id]/payment-method/route.ts`
- Modify: `app/api/bookings/[id]/modification-requests/[reqId]/route.ts`

**Pattern for every booking route:**

```typescript
import { getOrgIdFromRequest } from '@/lib/org-context'

// At the start of every handler:
const orgId = getOrgIdFromRequest(request)
if (!orgId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

// Add to every INSERT:
// organization_id: orgId

// Add to every SELECT on bookings:
// .eq('organization_id', orgId)
```

- [ ] **Step 1: Update app/api/bookings/route.ts** — add `getOrgIdFromRequest`, scope all booking queries with `.eq('organization_id', orgId)`, add `organization_id: orgId` to the booking INSERT.

- [ ] **Step 2: Update app/api/bookings/[id]/cancel/route.ts** — add `orgId` guard. When fetching the booking by ID, add `.eq('organization_id', orgId)` to prevent cross-tenant access.

- [ ] **Step 3: Update app/api/bookings/[id]/cancel/guest/route.ts** — same org guard on the booking fetch.

- [ ] **Step 4: Update app/api/bookings/[id]/confirm/route.ts** — same org guard.

- [ ] **Step 5: Update app/api/bookings/[id]/modify/route.ts** — same org guard.

- [ ] **Step 6: Update app/api/bookings/[id]/reinstate/route.ts** — same org guard.

- [ ] **Step 7: Update app/api/bookings/[id]/payment-method/route.ts** — same org guard.

- [ ] **Step 8: Update app/api/bookings/[id]/modification-requests/[reqId]/route.ts** — same org guard.

- [ ] **Step 9: Commit**

```bash
git add "app/api/bookings/"
git commit -m "feat: scope booking API routes to organization"
```

---

## Task 15: Update admin API routes

**Files:** All routes under `app/api/admin/`

**Pattern for admin API routes** — these use the service role client and get `orgId` from the `x-organization-id` header injected by middleware:

```typescript
import { getOrgIdFromRequest } from '@/lib/org-context'

// At start of every handler:
const orgId = getOrgIdFromRequest(request)
if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

// Add to every SELECT:
// .eq('organization_id', orgId)

// Add to every INSERT:
// organization_id: orgId
```

- [ ] **Step 1: Update app/api/admin/properties/route.ts** — add orgId guard, scope GET `.eq('organization_id', orgId)`, add `organization_id: orgId` to POST inserts.

- [ ] **Step 2: Update app/api/admin/rooms/route.ts** — same pattern.

- [ ] **Step 3: Update app/api/admin/rooms/[id]/route.ts** — add orgId guard, add `.eq('organization_id', orgId)` to the room fetch (prevents editing another tenant's room).

- [ ] **Step 4: Update app/api/admin/rooms/[id]/calendar/route.ts** — add orgId guard, scope queries.

- [ ] **Step 5: Update app/api/admin/rooms/[id]/duplicate/route.ts** — add orgId guard, include `organization_id: orgId` in the duplicated room insert.

- [ ] **Step 6: Update app/api/admin/settings/route.ts** — scope site_settings by orgId.

- [ ] **Step 7: Update app/api/admin/calendar/route.ts** — scope by orgId.

- [ ] **Step 8: Update app/api/admin/calendar-tasks/route.ts** — scope by orgId, include orgId in inserts.

- [ ] **Step 9: Update app/api/admin/calendar-tasks/[id]/route.ts** — add orgId guard on fetch.

- [ ] **Step 10: Update app/api/admin/date-overrides/route.ts** — scope by orgId.

- [ ] **Step 11: Update app/api/admin/ical-sources/route.ts** — scope by orgId.

- [ ] **Step 12: Update app/api/admin/ical-sources/[id]/route.ts** — add orgId guard.

- [ ] **Step 13: Update app/api/admin/ical-sources/sync/route.ts** — scope by orgId.

- [ ] **Step 14: Update app/api/admin/ical-sync/route.ts** — scope by orgId.

- [ ] **Step 15: Update app/api/admin/payout-accounts/route.ts** — scope by orgId.

- [ ] **Step 16: Update app/api/admin/payout-accounts/[id]/route.ts** — add orgId guard.

- [ ] **Step 17: Update app/api/admin/payment-method-configs/route.ts** — scope by orgId.

- [ ] **Step 18: Update app/api/admin/payment-method-configs/[id]/route.ts** — add orgId guard.

- [ ] **Step 19: Update app/api/admin/email/templates/route.ts** — scope by orgId.

- [ ] **Step 20: Update app/api/admin/email/templates/[id]/route.ts** — add orgId guard.

- [ ] **Step 21: Update app/api/admin/email/automations/route.ts** — scope by orgId.

- [ ] **Step 22: Update app/api/admin/email/automations/[id]/route.ts** — add orgId guard.

- [ ] **Step 23: Update app/api/admin/email/settings/route.ts** — scope by orgId.

- [ ] **Step 24: Update app/api/admin/bookings/manual/route.ts** — scope by orgId, include `organization_id: orgId` in insert.

- [ ] **Step 25: Update app/api/admin/bookings/[id]/status/route.ts** — add orgId guard on booking fetch.

- [ ] **Step 26: Update app/api/admin/bookings/[id]/edit/route.ts** — add orgId guard.

- [ ] **Step 27: Update app/api/admin/bookings/[id]/reinstate/route.ts** — add orgId guard.

- [ ] **Step 28: Update app/api/admin/bookings/[id]/modification-requests/[reqId]/route.ts** — add orgId guard.

- [ ] **Step 29: Update app/api/admin/ai/generate/route.ts** — scope ai_prompts query by orgId.

- [ ] **Step 30: Update app/api/admin/stripe/account-session/route.ts** — scope by orgId.

- [ ] **Step 31: Commit**

```bash
git add "app/api/admin/"
git commit -m "feat: scope all admin API routes to organization"
```

---

## Task 16: Update iCal and cron routes

**Files:**
- Modify: `app/api/ical/[token]/route.ts`
- Modify: `app/api/ical/sync/route.ts`
- Modify: `app/api/cron/expire-pending-bookings/route.ts`
- Modify: `app/api/cron/process-email-queue/route.ts`

- [ ] **Step 1: Update app/api/ical/[token]/route.ts**

The iCal export route resolves the room by its `ical_export_token`. No subdomain needed — the token uniquely identifies the room. No org filter needed on the token lookup; the token itself is the authority. No changes required here unless the route has other queries that need org scoping.

- [ ] **Step 2: Update app/api/ical/sync/route.ts**

The sync cron processes all iCal sources across all orgs. Use service role client; **do not** add org filter. The cron iterates all active ical_sources regardless of org — this is correct behavior.

- [ ] **Step 3: Review app/api/cron/expire-pending-bookings/route.ts**

This cron expires pending bookings across all orgs. Use service role client; **do not** add org filter. Global operation is correct.

- [ ] **Step 4: Review app/api/cron/process-email-queue/route.ts**

Same — processes email queue globally across all orgs. No org filter needed.

- [ ] **Step 5: Commit**

```bash
git add "app/api/ical/" "app/api/cron/"
git commit -m "feat: confirm cron and iCal routes handle multi-tenant correctly"
```

---

## Task 17: Update Stripe webhook

**Files:**
- Modify: `app/api/stripe/webhook/route.ts`

- [ ] **Step 1: Read the current webhook handler**

Open `app/api/stripe/webhook/route.ts` and identify where bookings are fetched by `stripe_payment_intent_id` or `stripe_session_id`.

- [ ] **Step 2: Add org_id to webhook booking lookups**

The Stripe webhook does not have a subdomain context. Bookings are identified by their Stripe IDs, which are globally unique. The `bookings` table now has `organization_id` but webhook lookups by `stripe_payment_intent_id` are unique — no org filter needed for the lookup. The booking row itself already has the correct `organization_id` since it was inserted with it.

No changes needed to the webhook handler for SP1. When SP3 (Stripe Connect) is built, the webhook will need to resolve the org from the connected account ID.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: confirm stripe webhook handles multi-tenant correctly (no changes needed in SP1)"
```

---

## Task 18: Update remaining public server components

**Files:**
- Modify: `app/(public)/rooms/[slug]/page.tsx`
- Modify: `app/(public)/booking/page.tsx` (if exists as server component)
- Modify: `app/(public)/checkout/page.tsx` (if exists as server component)

- [ ] **Step 1: Update app/(public)/rooms/[slug]/page.tsx**

Read the current file. Find where it fetches the room. Add `getOrgId()` and scope the room query:

```typescript
import { getOrgId } from '@/lib/org-context'
import { createServiceRoleClient } from '@/lib/supabase'

// In the data-fetching function or component:
const orgId = await getOrgId()
if (!orgId) return notFound()

const supabase = createServiceRoleClient()
const { data: room } = await supabase
  .from('rooms')
  .select('*, property:properties(*)')
  .eq('slug', slug)
  .eq('organization_id', orgId)
  .eq('is_active', true)
  .maybeSingle()
```

- [ ] **Step 2: Scan remaining public pages**

Check `app/(public)/booking/`, `app/(public)/checkout/`, `app/(public)/apply/` for any direct Supabase queries. Add `organization_id` filter wherever rooms or bookings are fetched.

- [ ] **Step 3: Commit**

```bash
git add "app/(public)/"
git commit -m "feat: scope remaining public server components to organization"
```

---

## Task 19: Smoke test — two-org isolation

This is a manual integration test to verify tenant isolation works end-to-end.

- [ ] **Step 1: Create a second test org in local Supabase**

Run in Supabase SQL Editor (local):
```sql
INSERT INTO organizations (id, name, slug, subscription_status, stripe_connect_status)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'Test Org 2',
  'testorg2',
  'active',
  'not_connected'
);

INSERT INTO properties (name, address, city, state, organization_id)
VALUES ('Test Property', '123 Test St', 'Phoenix', 'AZ', '00000000-0000-0000-0000-000000000002');
```

- [ ] **Step 2: Test org 1 (tothrooms) sees only its data**

With `DEFAULT_ORG_SLUG=tothrooms` in `.env.local`, visit `http://localhost:3000`. Confirm you see only tothrooms properties.

- [ ] **Step 3: Test org 2 sees only its data**

Change `.env.local` to `DEFAULT_ORG_SLUG=testorg2`. Restart dev server. Visit `http://localhost:3000`. Confirm you see only the Test Property — NOT the tothrooms properties.

- [ ] **Step 4: Restore .env.local**

Change back to `DEFAULT_ORG_SLUG=tothrooms`.

- [ ] **Step 5: Commit**

```bash
git commit -m "test: verify two-org data isolation in development"
```

---

## Task 20: Run full test suite

- [ ] **Step 1: Run Jest tests**

```bash
npx jest --passWithNoTests
```
Expected: all existing tests pass. The org-context unit test from Task 6 passes.

- [ ] **Step 2: Fix any TypeScript errors**

```bash
npx tsc --noEmit
```
Expected: no type errors. Fix any `organization_id` type mismatches.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: sub-project 1 complete — multi-tenancy foundation"
```

---

## What's Next

Sub-project 1 is the foundation. Once this plan is complete and all tests pass:

- **Plan 2** — Auth Overhaul: public signup page, org provisioning on signup, super-admin role
- **Plan 3** — Stripe Connect: per-org payment flow, Connect OAuth, platform fee
- **Plan 4** — Platform Billing: subscriptions for landlords, checkout → provision flow
- **Plan 5** — Site Settings & White-labeling: org-scoped branding fields + UI
- **Plan 6** — Onboarding Wizard: 5-step guided setup flow
- **Plan 7** — Super-Admin Dashboard: platform metrics, tenant management
