# Email System Backend — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the backend layer of the email system — Supabase tables, email library, queue processor endpoint, trigger wiring into existing API routes, and admin CRUD APIs for templates/automations/settings.

**Architecture:** Resend delivers emails. Four new Supabase tables store templates, automation rules, settings, and a send queue. A `POST /api/cron/process-email-queue` endpoint secured by `CRON_SECRET` processes due queue rows. Existing API routes call `evaluateAndQueueEmails()` after their primary work — non-blocking, never throws.

**Tech Stack:** `resend` npm package, Supabase service role client, Next.js App Router API routes, Jest.

---

## File Map

**New files:**
- `supabase/migrations/010_email_system.sql`
- `lib/email.ts` — `sendEmail()`, `resolveVariables()`
- `lib/email-queue.ts` — `evaluateConditions()`, `buildBookingVariables()`, `buildContactVariables()`, `evaluateAndQueueEmails()`, `cancelBookingEmails()`, `seedReminderEmails()`
- `app/api/cron/process-email-queue/route.ts`
- `app/api/admin/email/settings/route.ts`
- `app/api/admin/email/templates/route.ts`
- `app/api/admin/email/templates/[id]/route.ts`
- `app/api/admin/email/automations/route.ts`
- `app/api/admin/email/automations/[id]/route.ts`
- `__tests__/api/email/email.test.ts`
- `__tests__/api/email/email-queue.test.ts`
- `__tests__/api/email/process-queue.test.ts`
- `__tests__/api/admin/email-settings.test.ts`
- `__tests__/api/admin/email-templates.test.ts`
- `__tests__/api/admin/email-automations.test.ts`

**Modified files:**
- `types/index.ts` — append email types
- `.env.example` — add `RESEND_API_KEY`, `EMAIL_FROM_ADDRESS`
- `app/api/bookings/route.ts` — add `booking_pending` trigger
- `app/api/stripe/webhook/route.ts` — add `booking_confirmed`, `admin_new_booking` triggers + `seedReminderEmails`
- `app/api/bookings/[id]/cancel/guest/route.ts` — add `booking_cancelled`, `admin_cancelled` triggers + `cancelBookingEmails`
- `app/api/bookings/[id]/cancel/route.ts` — same
- `app/api/contact/route.ts` — add `contact_submitted` trigger
- `app/api/bookings/[id]/modify/route.ts` — add `modification_requested` trigger
- `components/admin/AdminSidebar.tsx` — add Email nav item

---

## Task 1: Install resend + update env

**Files:**
- Modify: `package.json` (via npm)
- Modify: `.env.example`

- [ ] **Step 1: Install resend**

```bash
cd /workspaces/Top-of-the-Hill-Estates && npm install resend
```

Expected: `added 1 package` (or similar). No errors.

- [ ] **Step 2: Add env vars to .env.example**

Open `.env.example` and append at the end:

```
# Email (Resend)
RESEND_API_KEY=
EMAIL_FROM_ADDRESS=
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json .env.example
git commit -m "chore: install resend, add email env vars"
```

---

## Task 2: Database migration

**Files:**
- Create: `supabase/migrations/010_email_system.sql`

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/010_email_system.sql`:

```sql
-- Email settings (single row)
CREATE TABLE email_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_name text NOT NULL DEFAULT 'Top of the Hill Estates',
  from_email text NOT NULL DEFAULT '',
  admin_recipients text[] NOT NULL DEFAULT '{}',
  review_url text NOT NULL DEFAULT ''
);

-- Seed one row immediately
INSERT INTO email_settings DEFAULT VALUES;

-- Trigger event enum
CREATE TYPE email_trigger_event AS ENUM (
  'booking_confirmed',
  'booking_pending',
  'booking_cancelled',
  'contact_submitted',
  'checkin_reminder',
  'checkout_reminder',
  'post_checkout',
  'review_request',
  'modification_requested',
  'admin_new_booking',
  'admin_cancelled'
);

-- Email templates
CREATE TABLE email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subject text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON email_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Email automations
CREATE TABLE email_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  trigger_event email_trigger_event NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  delay_minutes integer NOT NULL DEFAULT 0,
  conditions jsonb NOT NULL DEFAULT '{"operator":"AND","rules":[]}',
  template_id uuid REFERENCES email_templates(id) ON DELETE SET NULL,
  recipient_type text NOT NULL DEFAULT 'guest'
    CHECK (recipient_type IN ('guest', 'admin', 'both')),
  is_pre_planned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER update_email_automations_updated_at
  BEFORE UPDATE ON email_automations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Email queue
CREATE TABLE email_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid REFERENCES email_automations(id) ON DELETE SET NULL,
  template_id uuid REFERENCES email_templates(id) ON DELETE SET NULL,
  booking_id uuid REFERENCES bookings(id) ON DELETE CASCADE,
  recipient_email text NOT NULL,
  recipient_type text NOT NULL DEFAULT 'guest',
  send_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  resolved_variables jsonb NOT NULL DEFAULT '{}',
  attempts integer NOT NULL DEFAULT 0,
  error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for efficient queue processor queries
CREATE INDEX email_queue_pending_idx ON email_queue (send_at)
  WHERE status = 'pending';

-- Seed the 11 pre-planned automations (all inactive until admin configures them)
INSERT INTO email_automations (name, trigger_event, is_active, delay_minutes, recipient_type, is_pre_planned)
VALUES
  ('Booking Pending',            'booking_pending',        false,     0, 'guest', true),
  ('Booking Confirmed',          'booking_confirmed',       false,     0, 'guest', true),
  ('Booking Cancelled',          'booking_cancelled',       false,     0, 'guest', true),
  ('Contact Form Submitted',     'contact_submitted',       false,     0, 'guest', true),
  ('Check-in Reminder',          'checkin_reminder',        false, -2880, 'guest', true),
  ('Check-out Reminder',         'checkout_reminder',       false, -1440, 'guest', true),
  ('Post Checkout',              'post_checkout',           false,  1440, 'guest', true),
  ('Review Request',             'review_request',          false,  2880, 'guest', true),
  ('Modification Requested',     'modification_requested',  false,     0, 'guest', true),
  ('Admin — New Booking',        'admin_new_booking',       false,     0, 'admin', true),
  ('Admin — Booking Cancelled',  'admin_cancelled',         false,     0, 'admin', true);
```

- [ ] **Step 2: Apply the migration via Supabase MCP**

Use `mcp__supabase__apply_migration` with the SQL above, name `010_email_system`.

- [ ] **Step 3: Verify tables exist**

Use `mcp__supabase__execute_sql`:
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('email_settings','email_templates','email_automations','email_queue');
```

Expected: 4 rows returned.

- [ ] **Step 4: Verify pre-planned automations seeded**

```sql
SELECT name, trigger_event, delay_minutes FROM email_automations ORDER BY id;
```

Expected: 11 rows.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/010_email_system.sql
git commit -m "feat: add email system DB migration (tables + seed automations)"
```

---

## Task 3: TypeScript types

**Files:**
- Modify: `types/index.ts` — append at end of file

- [ ] **Step 1: Append email types to types/index.ts**

Add after the last line of `types/index.ts`:

```typescript
// ── Email system ──────────────────────────────────────────────────────────────

export type TriggerEvent =
  | 'booking_confirmed'
  | 'booking_pending'
  | 'booking_cancelled'
  | 'contact_submitted'
  | 'checkin_reminder'
  | 'checkout_reminder'
  | 'post_checkout'
  | 'review_request'
  | 'modification_requested'
  | 'admin_new_booking'
  | 'admin_cancelled'

export type RecipientType = 'guest' | 'admin' | 'both'
export type QueueStatus = 'pending' | 'sent' | 'failed' | 'cancelled'

export interface ConditionRule {
  field: string
  op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte'
  value: string | number | boolean
}

export interface ConditionBlock {
  operator: 'AND' | 'OR'
  rules: ConditionRule[]
}

export interface EmailTemplate {
  id: string
  name: string
  subject: string
  body: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface EmailAutomation {
  id: string
  name: string
  trigger_event: TriggerEvent
  is_active: boolean
  delay_minutes: number
  conditions: ConditionBlock
  template_id: string | null
  recipient_type: RecipientType
  is_pre_planned: boolean
  created_at: string
  updated_at: string
}

export interface EmailQueue {
  id: string
  automation_id: string | null
  template_id: string | null
  booking_id: string | null
  recipient_email: string
  recipient_type: 'guest' | 'admin'
  send_at: string
  status: QueueStatus
  resolved_variables: Record<string, string>
  attempts: number
  error: string | null
  sent_at: string | null
  created_at: string
}

export interface EmailSettings {
  id: string
  from_name: string
  from_email: string
  admin_recipients: string[]
  review_url: string
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors related to the new types.

- [ ] **Step 3: Commit**

```bash
git add types/index.ts
git commit -m "feat: add email system TypeScript types"
```

---

## Task 4: lib/email.ts — sendEmail + resolveVariables

**Files:**
- Create: `lib/email.ts`
- Create: `__tests__/api/email/email.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/api/email/email.test.ts`:

```typescript
/**
 * @jest-environment node
 */
import { resolveVariables } from '@/lib/email'

// sendEmail is tested implicitly via process-queue tests (mocked Resend)

describe('resolveVariables', () => {
  it('replaces a single known variable', () => {
    expect(resolveVariables('Hello {{guest_first_name}}!', { guest_first_name: 'Alice' }))
      .toBe('Hello Alice!')
  })

  it('replaces multiple variables in one pass', () => {
    expect(
      resolveVariables('{{a}} and {{b}}', { a: 'foo', b: 'bar' }),
    ).toBe('foo and bar')
  })

  it('replaces unknown variable with empty string', () => {
    expect(resolveVariables('val: {{missing}}', {})).toBe('val: ')
  })

  it('leaves plain text unchanged', () => {
    expect(resolveVariables('No tokens here.', {})).toBe('No tokens here.')
  })

  it('replaces the same variable multiple times', () => {
    expect(resolveVariables('{{x}} {{x}}', { x: 'hi' })).toBe('hi hi')
  })

  it('handles HTML surrounding the token', () => {
    expect(
      resolveVariables('<p>Dear {{guest_first_name}},</p>', { guest_first_name: 'Bob' }),
    ).toBe('<p>Dear Bob,</p>')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --testPathPattern="__tests__/api/email/email.test.ts" --no-coverage
```

Expected: FAIL — `Cannot find module '@/lib/email'`

- [ ] **Step 3: Create lib/email.ts**

```typescript
import { Resend } from 'resend'

let _client: Resend | null = null

function getClient(): Resend {
  if (!_client) _client = new Resend(process.env.RESEND_API_KEY ?? '')
  return _client
}

export async function sendEmail(params: {
  to: string | string[]
  subject: string
  html: string
  fromName?: string
  fromEmail?: string
}): Promise<string | null> {
  const fromEmail = params.fromEmail ?? process.env.EMAIL_FROM_ADDRESS ?? ''
  if (!fromEmail) {
    console.warn('sendEmail: no from address configured — skipping')
    return null
  }

  const fromName = params.fromName ?? 'Top of the Hill Estates'

  try {
    const { data, error } = await getClient().emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: Array.isArray(params.to) ? params.to : [params.to],
      subject: params.subject,
      html: params.html,
    })

    if (error) {
      console.error('Resend send error:', error)
      return null
    }

    return data?.id ?? null
  } catch (err) {
    console.error('sendEmail error:', err)
    return null
  }
}

export function resolveVariables(
  text: string,
  variables: Record<string, string>,
): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => variables[key] ?? '')
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --testPathPattern="__tests__/api/email/email.test.ts" --no-coverage
```

Expected: PASS — 6 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/email.ts __tests__/api/email/email.test.ts
git commit -m "feat: add lib/email.ts with sendEmail and resolveVariables"
```

---

## Task 5: lib/email-queue.ts — pure functions + tests

**Files:**
- Create: `lib/email-queue.ts` (partial — pure functions only)
- Create: `__tests__/api/email/email-queue.test.ts`

- [ ] **Step 1: Write failing tests for pure functions**

Create `__tests__/api/email/email-queue.test.ts`:

```typescript
/**
 * @jest-environment node
 */
import { evaluateConditions, buildBookingVariables, buildContactVariables } from '@/lib/email-queue'
import type { Booking, Room, Property, SiteSettings, EmailSettings, ConditionBlock } from '@/types'

// ── evaluateConditions ────────────────────────────────────────────────────────

describe('evaluateConditions', () => {
  it('returns true for empty rules', () => {
    expect(evaluateConditions({ operator: 'AND', rules: [] }, {})).toBe(true)
  })

  it('eq: matches equal string value', () => {
    const block: ConditionBlock = {
      operator: 'AND',
      rules: [{ field: 'booking_type', op: 'eq', value: 'long_term' }],
    }
    expect(evaluateConditions(block, { booking_type: 'long_term' })).toBe(true)
    expect(evaluateConditions(block, { booking_type: 'short_term' })).toBe(false)
  })

  it('neq: rejects equal values', () => {
    const block: ConditionBlock = {
      operator: 'AND',
      rules: [{ field: 'booking_type', op: 'neq', value: 'long_term' }],
    }
    expect(evaluateConditions(block, { booking_type: 'short_term' })).toBe(true)
    expect(evaluateConditions(block, { booking_type: 'long_term' })).toBe(false)
  })

  it('gte: passes when value meets threshold', () => {
    const block: ConditionBlock = {
      operator: 'AND',
      rules: [{ field: 'total_nights', op: 'gte', value: 7 }],
    }
    expect(evaluateConditions(block, { total_nights: 7 })).toBe(true)
    expect(evaluateConditions(block, { total_nights: 10 })).toBe(true)
    expect(evaluateConditions(block, { total_nights: 6 })).toBe(false)
  })

  it('lt: passes when value is less', () => {
    const block: ConditionBlock = {
      operator: 'AND',
      rules: [{ field: 'total_nights', op: 'lt', value: 30 }],
    }
    expect(evaluateConditions(block, { total_nights: 7 })).toBe(true)
    expect(evaluateConditions(block, { total_nights: 30 })).toBe(false)
  })

  it('AND: requires all rules to pass', () => {
    const block: ConditionBlock = {
      operator: 'AND',
      rules: [
        { field: 'booking_type', op: 'eq', value: 'long_term' },
        { field: 'total_nights', op: 'gte', value: 7 },
      ],
    }
    expect(evaluateConditions(block, { booking_type: 'long_term', total_nights: 10 })).toBe(true)
    expect(evaluateConditions(block, { booking_type: 'long_term', total_nights: 3 })).toBe(false)
    expect(evaluateConditions(block, { booking_type: 'short_term', total_nights: 10 })).toBe(false)
  })

  it('OR: passes if any rule passes', () => {
    const block: ConditionBlock = {
      operator: 'OR',
      rules: [
        { field: 'booking_type', op: 'eq', value: 'long_term' },
        { field: 'total_nights', op: 'gte', value: 30 },
      ],
    }
    expect(evaluateConditions(block, { booking_type: 'short_term', total_nights: 30 })).toBe(true)
    expect(evaluateConditions(block, { booking_type: 'long_term', total_nights: 3 })).toBe(true)
    expect(evaluateConditions(block, { booking_type: 'short_term', total_nights: 7 })).toBe(false)
  })
})

// ── buildBookingVariables ─────────────────────────────────────────────────────

const mockBooking: Booking = {
  id: 'booking-1',
  room_id: 'room-1',
  booking_type: 'short_term',
  guest_first_name: 'Alice',
  guest_last_name: 'Smith',
  guest_email: 'alice@example.com',
  guest_phone: '555-1234',
  check_in: '2026-05-01',
  check_out: '2026-05-04',
  total_nights: 3,
  nightly_rate: 100,
  monthly_rate: 2000,
  cleaning_fee: 50,
  security_deposit: 0,
  extra_guest_fee: 0,
  processing_fee: 0,
  guest_count: 2,
  total_amount: 350,
  amount_paid: 350,
  amount_due_at_checkin: 0,
  stripe_payment_intent_id: null,
  stripe_session_id: null,
  status: 'confirmed',
  cancellation_reason: null,
  cancelled_at: null,
  refund_amount: null,
  ghl_contact_id: null,
  sms_consent: false,
  marketing_consent: false,
  created_at: '2026-04-20T00:00:00Z',
  updated_at: '2026-04-20T00:00:00Z',
}

const mockRoom: Room & { property?: Property } = {
  id: 'room-1',
  property_id: 'prop-1',
  name: 'The Summit Room',
  slug: 'summit',
  description: '',
  short_description: '',
  guest_capacity: 2,
  bedrooms: 1,
  bathrooms: 1,
  nightly_rate: 100,
  monthly_rate: 2000,
  minimum_nights_short_term: 1,
  minimum_nights_long_term: 30,
  images: [],
  amenities: [],
  house_rules: '',
  is_active: true,
  show_nightly_rate: true,
  show_monthly_rate: true,
  cancellation_window_hours: 72,
  ical_export_token: '',
  created_at: '2026-04-20T00:00:00Z',
  updated_at: '2026-04-20T00:00:00Z',
  property: {
    id: 'prop-1',
    name: 'Top of the Hill',
    address: '123 Hill Rd',
    city: 'Springfield',
    state: 'IL',
    zip: '62701',
    description: '',
    images: [],
    amenities: [],
    bedrooms: 3,
    bathrooms: 2,
    created_at: '2026-04-20T00:00:00Z',
  },
}

const mockSiteSettings: SiteSettings = {
  id: 'site-1',
  business_name: 'Top of the Hill Estates',
  about_text: '',
  contact_phone: '555-9999',
  contact_email: 'info@example.com',
  contact_address: '',
  checkin_time: '15:00',
  checkout_time: '11:00',
  updated_at: '',
}

const mockEmailSettings: EmailSettings = {
  id: 'email-1',
  from_name: 'Top of the Hill Estates',
  from_email: 'noreply@example.com',
  admin_recipients: ['admin@example.com'],
  review_url: 'https://g.page/review',
}

describe('buildBookingVariables', () => {
  it('includes guest fields', () => {
    const vars = buildBookingVariables(mockBooking, mockRoom, mockSiteSettings, mockEmailSettings)
    expect(vars.guest_first_name).toBe('Alice')
    expect(vars.guest_last_name).toBe('Smith')
    expect(vars.guest_email).toBe('alice@example.com')
    expect(vars.guest_phone).toBe('555-1234')
  })

  it('includes booking fields', () => {
    const vars = buildBookingVariables(mockBooking, mockRoom, mockSiteSettings, mockEmailSettings)
    expect(vars.booking_id).toBe('booking-1')
    expect(vars.total_nights).toBe('3')
    expect(vars.total_amount).toBe('$350.00')
    expect(vars.room_name).toBe('The Summit Room')
    expect(vars.property_name).toBe('Top of the Hill')
    expect(vars.booking_type).toBe('Short-Term')
  })

  it('includes site fields', () => {
    const vars = buildBookingVariables(mockBooking, mockRoom, mockSiteSettings, mockEmailSettings)
    expect(vars.business_name).toBe('Top of the Hill Estates')
    expect(vars.review_url).toBe('https://g.page/review')
  })

  it('formats long_term booking_type correctly', () => {
    const ltBooking = { ...mockBooking, booking_type: 'long_term' as const }
    const vars = buildBookingVariables(ltBooking, mockRoom, mockSiteSettings, mockEmailSettings)
    expect(vars.booking_type).toBe('Long-Term')
  })
})

// ── buildContactVariables ─────────────────────────────────────────────────────

describe('buildContactVariables', () => {
  it('includes contact form fields', () => {
    const vars = buildContactVariables(
      { name: 'Bob Jones', email: 'bob@example.com', phone: '555-0001', message: 'Hello!' },
      mockSiteSettings,
      mockEmailSettings,
    )
    expect(vars.contact_name).toBe('Bob Jones')
    expect(vars.contact_email).toBe('bob@example.com')
    expect(vars.contact_phone).toBe('555-0001')
    expect(vars.contact_message).toBe('Hello!')
  })

  it('handles missing phone gracefully', () => {
    const vars = buildContactVariables(
      { name: 'Bob', email: 'bob@example.com', message: 'Hi' },
      mockSiteSettings,
      mockEmailSettings,
    )
    expect(vars.contact_phone).toBe('')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- --testPathPattern="__tests__/api/email/email-queue.test.ts" --no-coverage
```

Expected: FAIL — `Cannot find module '@/lib/email-queue'`

- [ ] **Step 3: Create lib/email-queue.ts with pure functions**

```typescript
import { createServiceRoleClient } from '@/lib/supabase'
import type {
  Booking,
  Room,
  Property,
  SiteSettings,
  EmailSettings,
  TriggerEvent,
  ConditionBlock,
  EmailAutomation,
} from '@/types'

// ── Pure helpers ──────────────────────────────────────────────────────────────

export function evaluateConditions(
  conditions: ConditionBlock,
  context: Record<string, unknown>,
): boolean {
  if (!conditions.rules.length) return true

  const results = conditions.rules.map((rule) => {
    const val = context[rule.field]
    const cmp = rule.value
    switch (rule.op) {
      case 'eq':  return val == cmp
      case 'neq': return val != cmp
      case 'gt':  return Number(val) > Number(cmp)
      case 'gte': return Number(val) >= Number(cmp)
      case 'lt':  return Number(val) < Number(cmp)
      case 'lte': return Number(val) <= Number(cmp)
      default:    return true
    }
  })

  return conditions.operator === 'AND' ? results.every(Boolean) : results.some(Boolean)
}

function fmtDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00Z')
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

function fmtTime(hhmm?: string): string {
  if (!hhmm) return ''
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date(2000, 0, 1, h, m)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export function buildBookingVariables(
  booking: Booking,
  room: Room & { property?: Property },
  siteSettings: SiteSettings | null,
  emailSettings: EmailSettings | null,
): Record<string, string> {
  return {
    guest_first_name: booking.guest_first_name,
    guest_last_name: booking.guest_last_name,
    guest_email: booking.guest_email,
    guest_phone: booking.guest_phone,
    booking_id: booking.id,
    check_in_date: fmtDate(booking.check_in),
    check_out_date: fmtDate(booking.check_out),
    total_nights: String(booking.total_nights),
    total_amount: `$${booking.total_amount.toFixed(2)}`,
    room_name: room.name,
    property_name: room.property?.name ?? '',
    booking_type: booking.booking_type === 'short_term' ? 'Short-Term' : 'Long-Term',
    property_address: room.property?.address ?? '',
    checkin_time: fmtTime(siteSettings?.checkin_time),
    checkout_time: fmtTime(siteSettings?.checkout_time),
    house_rules: siteSettings?.global_house_rules ?? room.property?.house_rules ?? '',
    business_name: siteSettings?.business_name ?? emailSettings?.from_name ?? '',
    contact_phone: siteSettings?.contact_phone ?? '',
    contact_email: siteSettings?.contact_email ?? emailSettings?.from_email ?? '',
    review_url: emailSettings?.review_url ?? '',
  }
}

export function buildContactVariables(
  contact: { name: string; email: string; phone?: string; message: string },
  siteSettings: SiteSettings | null,
  emailSettings: EmailSettings | null,
): Record<string, string> {
  return {
    contact_name: contact.name,
    contact_email: contact.email,
    contact_phone: contact.phone ?? '',
    contact_message: contact.message,
    business_name: siteSettings?.business_name ?? emailSettings?.from_name ?? '',
    business_phone: siteSettings?.contact_phone ?? '',
    business_email: siteSettings?.contact_email ?? emailSettings?.from_email ?? '',
    review_url: emailSettings?.review_url ?? '',
  }
}

const REMINDER_EVENTS: TriggerEvent[] = [
  'checkin_reminder',
  'checkout_reminder',
  'post_checkout',
  'review_request',
]

function buildEvalContext(booking: Booking): Record<string, unknown> {
  return {
    booking_type: booking.booking_type,
    total_nights: booking.total_nights,
    total_amount: booking.total_amount,
    room_id: booking.room_id,
    marketing_consent: booking.marketing_consent,
    sms_consent: booking.sms_consent,
  }
}

type ContactContext = { name: string; email: string; phone?: string; message: string }

export type EmailContext =
  | { type: 'booking'; bookingId: string }
  | { type: 'contact' } & ContactContext

export async function evaluateAndQueueEmails(
  event: TriggerEvent,
  context: EmailContext,
): Promise<void> {
  const supabase = createServiceRoleClient()

  try {
    const { data: automations } = await supabase
      .from('email_automations')
      .select('*')
      .eq('trigger_event', event)
      .eq('is_active', true)

    if (!automations?.length) return

    let booking: (Booking & { room?: Room & { property?: Property } }) | null = null
    if (context.type === 'booking') {
      const { data } = await supabase
        .from('bookings')
        .select('*, room:rooms(*, property:properties(*))')
        .eq('id', context.bookingId)
        .single()
      if (!data) {
        console.error(`evaluateAndQueueEmails: booking ${context.bookingId} not found`)
        return
      }
      booking = data as typeof booking
    }

    const [{ data: emailSettings }, { data: siteSettings }] = await Promise.all([
      supabase.from('email_settings').select('*').maybeSingle(),
      supabase.from('site_settings').select('*').maybeSingle(),
    ])

    const now = new Date()
    const queueRows: Array<Record<string, unknown>> = []

    for (const automation of automations as EmailAutomation[]) {
      if (!automation.template_id) continue

      const evalCtx = booking ? buildEvalContext(booking) : {}
      if (!evaluateConditions(automation.conditions, evalCtx)) continue

      const variables =
        booking?.room
          ? buildBookingVariables(
              booking,
              booking.room as Room & { property?: Property },
              siteSettings as SiteSettings | null,
              emailSettings as EmailSettings | null,
            )
          : context.type === 'contact'
          ? buildContactVariables(
              context as ContactContext,
              siteSettings as SiteSettings | null,
              emailSettings as EmailSettings | null,
            )
          : {}

      const adminEmails = (emailSettings as EmailSettings | null)?.admin_recipients ?? []
      const guestEmail =
        booking?.guest_email ??
        (context.type === 'contact' ? (context as ContactContext).email : null)

      const recipients: string[] = []
      if (
        (automation.recipient_type === 'guest' || automation.recipient_type === 'both') &&
        guestEmail
      ) {
        recipients.push(guestEmail)
      }
      if (automation.recipient_type === 'admin' || automation.recipient_type === 'both') {
        recipients.push(...adminEmails)
      }

      if (!recipients.length) continue

      const sendAt = new Date(now.getTime() + automation.delay_minutes * 60 * 1000)

      for (const recipientEmail of recipients) {
        queueRows.push({
          automation_id: automation.id,
          template_id: automation.template_id,
          booking_id: booking?.id ?? null,
          recipient_email: recipientEmail,
          recipient_type: automation.recipient_type === 'admin' ? 'admin' : 'guest',
          send_at: sendAt.toISOString(),
          resolved_variables: variables,
        })
      }
    }

    if (queueRows.length) {
      const { error } = await supabase.from('email_queue').insert(queueRows)
      if (error) console.error('email_queue insert error:', error)
    }
  } catch (err) {
    console.error('evaluateAndQueueEmails error:', err)
  }
}

export async function cancelBookingEmails(bookingId: string): Promise<void> {
  const supabase = createServiceRoleClient()
  try {
    const { data: cancelAutomations } = await supabase
      .from('email_automations')
      .select('id')
      .in('trigger_event', ['booking_cancelled', 'admin_cancelled'])

    const excludeIds = (cancelAutomations ?? []).map((a: { id: string }) => a.id)

    let query = supabase
      .from('email_queue')
      .update({ status: 'cancelled' })
      .eq('booking_id', bookingId)
      .eq('status', 'pending')

    if (excludeIds.length) {
      query = query.not('automation_id', 'in', `(${excludeIds.join(',')})`)
    }

    const { error } = await query
    if (error) console.error('cancelBookingEmails error:', error)
  } catch (err) {
    console.error('cancelBookingEmails error:', err)
  }
}

export async function seedReminderEmails(bookingId: string): Promise<void> {
  const supabase = createServiceRoleClient()
  try {
    const { data: bookingData } = await supabase
      .from('bookings')
      .select('*, room:rooms(*, property:properties(*))')
      .eq('id', bookingId)
      .single()

    if (!bookingData) return

    const { data: automations } = await supabase
      .from('email_automations')
      .select('*')
      .in('trigger_event', REMINDER_EVENTS)
      .eq('is_active', true)

    if (!automations?.length) return

    const [{ data: emailSettings }, { data: siteSettings }] = await Promise.all([
      supabase.from('email_settings').select('*').maybeSingle(),
      supabase.from('site_settings').select('*').maybeSingle(),
    ])

    const booking = bookingData as Booking & { room?: Room & { property?: Property } }
    const variables = booking.room
      ? buildBookingVariables(
          booking,
          booking.room as Room & { property?: Property },
          siteSettings as SiteSettings | null,
          emailSettings as EmailSettings | null,
        )
      : {}

    const adminEmails = (emailSettings as EmailSettings | null)?.admin_recipients ?? []
    const checkInBase = new Date(booking.check_in + 'T12:00:00Z')
    const checkOutBase = new Date(booking.check_out + 'T12:00:00Z')
    const now = new Date()
    const queueRows: Array<Record<string, unknown>> = []

    for (const automation of automations as EmailAutomation[]) {
      if (!automation.template_id) continue

      if (!evaluateConditions(automation.conditions, buildEvalContext(booking))) continue

      const baseDate =
        automation.trigger_event === 'checkin_reminder' ? checkInBase : checkOutBase
      const sendAt = new Date(baseDate.getTime() + automation.delay_minutes * 60 * 1000)

      if (sendAt <= now) continue

      const recipients: string[] = []
      if (automation.recipient_type === 'guest' || automation.recipient_type === 'both') {
        recipients.push(booking.guest_email)
      }
      if (automation.recipient_type === 'admin' || automation.recipient_type === 'both') {
        recipients.push(...adminEmails)
      }

      for (const recipientEmail of recipients) {
        queueRows.push({
          automation_id: automation.id,
          template_id: automation.template_id,
          booking_id: booking.id,
          recipient_email: recipientEmail,
          recipient_type: automation.recipient_type === 'admin' ? 'admin' : 'guest',
          send_at: sendAt.toISOString(),
          resolved_variables: variables,
        })
      }
    }

    if (queueRows.length) {
      const { error } = await supabase.from('email_queue').insert(queueRows)
      if (error) console.error('seedReminderEmails insert error:', error)
    }
  } catch (err) {
    console.error('seedReminderEmails error:', err)
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --testPathPattern="__tests__/api/email/email-queue.test.ts" --no-coverage
```

Expected: PASS — all describe blocks passing.

- [ ] **Step 5: Commit**

```bash
git add lib/email-queue.ts __tests__/api/email/email-queue.test.ts
git commit -m "feat: add lib/email-queue.ts with queue management functions"
```

---

## Task 6: Queue processor endpoint + tests

**Files:**
- Create: `app/api/cron/process-email-queue/route.ts`
- Create: `__tests__/api/email/process-queue.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/api/email/process-queue.test.ts`:

```typescript
/**
 * @jest-environment node
 */
import { POST } from '@/app/api/cron/process-email-queue/route'
import { createServiceRoleClient } from '@/lib/supabase'
import { sendEmail } from '@/lib/email'

jest.mock('@/lib/supabase', () => ({ createServiceRoleClient: jest.fn() }))
jest.mock('@/lib/email', () => ({
  sendEmail: jest.fn(),
  resolveVariables: jest.requireActual('@/lib/email').resolveVariables,
}))

const mockCreateServiceClient = createServiceRoleClient as jest.Mock
const mockSendEmail = sendEmail as jest.Mock

function makeRequest() {
  return new Request('http://localhost/api/cron/process-email-queue', {
    method: 'POST',
    headers: { Authorization: `Bearer test-cron-secret` },
  })
}

beforeEach(() => {
  process.env.CRON_SECRET = 'test-cron-secret'
  jest.clearAllMocks()
})

function buildDbMock(rows: unknown[], settingsData: unknown = null) {
  const updateEq = jest.fn().mockResolvedValue({ error: null })
  const update = jest.fn().mockReturnValue({ eq: updateEq })

  const fromMap: Record<string, unknown> = {
    email_queue: {
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          lte: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({ data: rows, error: null }),
            }),
          }),
        }),
      }),
      update: jest.fn().mockReturnValue({ eq: updateEq }),
    },
    email_settings: {
      select: jest.fn().mockReturnValue({
        maybeSingle: jest.fn().mockResolvedValue({ data: settingsData, error: null }),
      }),
    },
  }

  return jest.fn().mockImplementation((table: string) => fromMap[table] ?? { update })
}

describe('POST /api/cron/process-email-queue', () => {
  it('returns 401 without valid CRON_SECRET', async () => {
    const req = new Request('http://localhost/api/cron/process-email-queue', {
      method: 'POST',
      headers: { Authorization: 'Bearer wrong' },
    })
    const res = await POST(req as never)
    expect(res.status).toBe(401)
  })

  it('returns { processed: 0, failed: 0 } when queue is empty', async () => {
    mockCreateServiceClient.mockReturnValue({ from: buildDbMock([]) })
    const res = await POST(makeRequest() as never)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toEqual({ processed: 0, failed: 0 })
  })

  it('sends email and marks sent for a valid queue row', async () => {
    mockSendEmail.mockResolvedValue('resend-id-123')

    const row = {
      id: 'q-1',
      recipient_email: 'guest@example.com',
      resolved_variables: { guest_first_name: 'Alice' },
      attempts: 0,
      template: { subject: 'Hello {{guest_first_name}}', body: '<p>Hi {{guest_first_name}}</p>' },
    }

    const updateEq = jest.fn().mockResolvedValue({ error: null })
    const updateFn = jest.fn().mockReturnValue({ eq: updateEq })

    const fromMap: Record<string, unknown> = {
      email_queue: {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            lte: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({ data: [row], error: null }),
              }),
            }),
          }),
        }),
        update: updateFn,
      },
      email_settings: {
        select: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({
            data: { from_name: 'TOTH', from_email: 'noreply@example.com' },
            error: null,
          }),
        }),
      },
    }

    mockCreateServiceClient.mockReturnValue({
      from: jest.fn().mockImplementation((t: string) => fromMap[t]),
    })

    const res = await POST(makeRequest() as never)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.processed).toBe(1)
    expect(body.failed).toBe(0)
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'guest@example.com',
        subject: 'Hello Alice',
        html: '<p>Hi Alice</p>',
      }),
    )
  })

  it('increments attempts and marks failed after 3 failures', async () => {
    mockSendEmail.mockResolvedValue(null)

    const row = {
      id: 'q-2',
      recipient_email: 'guest@example.com',
      resolved_variables: {},
      attempts: 2,
      template: { subject: 'Test', body: '<p>Test</p>' },
    }

    const updateEq = jest.fn().mockResolvedValue({ error: null })
    const updateFn = jest.fn().mockReturnValue({ eq: updateEq })

    const fromMap: Record<string, unknown> = {
      email_queue: {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            lte: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({ data: [row], error: null }),
              }),
            }),
          }),
        }),
        update: updateFn,
      },
      email_settings: {
        select: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
      },
    }

    mockCreateServiceClient.mockReturnValue({
      from: jest.fn().mockImplementation((t: string) => fromMap[t]),
    })

    const res = await POST(makeRequest() as never)
    const body = await res.json()
    expect(body.failed).toBe(1)
    expect(updateFn).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed', attempts: 3 }),
    )
  })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
npm test -- --testPathPattern="__tests__/api/email/process-queue.test.ts" --no-coverage
```

Expected: FAIL — route not found.

- [ ] **Step 3: Create the route**

Create `app/api/cron/process-email-queue/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase'
import { sendEmail, resolveVariables } from '@/lib/email'

export async function POST(request: NextRequest) {
  if (request.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceRoleClient()

  const { data: rows, error } = await supabase
    .from('email_queue')
    .select('*, template:email_templates(subject, body)')
    .eq('status', 'pending')
    .lte('send_at', new Date().toISOString())
    .order('send_at')
    .limit(50)

  if (error) {
    console.error('process-email-queue: failed to fetch rows:', error)
    return NextResponse.json({ error: 'Failed to fetch queue' }, { status: 500 })
  }

  const { data: emailSettings } = await supabase
    .from('email_settings')
    .select('from_name, from_email')
    .maybeSingle()

  let processed = 0
  let failed = 0

  for (const row of rows ?? []) {
    const template = row.template as { subject: string; body: string } | null

    if (!template) {
      await supabase
        .from('email_queue')
        .update({ status: 'failed', error: 'Template not found', attempts: (row.attempts ?? 0) + 1 })
        .eq('id', row.id)
      failed++
      continue
    }

    const variables = (row.resolved_variables ?? {}) as Record<string, string>
    const subject = resolveVariables(template.subject, variables)
    const html = resolveVariables(template.body, variables)

    const result = await sendEmail({
      to: row.recipient_email as string,
      subject,
      html,
      fromName: (emailSettings as { from_name?: string } | null)?.from_name ?? undefined,
      fromEmail: (emailSettings as { from_email?: string } | null)?.from_email ?? undefined,
    })

    if (result) {
      await supabase
        .from('email_queue')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', row.id)
      processed++
    } else {
      const attempts = (row.attempts ?? 0) + 1
      await supabase
        .from('email_queue')
        .update({ attempts, status: attempts >= 3 ? 'failed' : 'pending', error: 'Send failed' })
        .eq('id', row.id)
      failed++
    }
  }

  return NextResponse.json({ processed, failed })
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --testPathPattern="__tests__/api/email/process-queue.test.ts" --no-coverage
```

Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add app/api/cron/process-email-queue/route.ts __tests__/api/email/process-queue.test.ts
git commit -m "feat: add queue processor endpoint POST /api/cron/process-email-queue"
```

---

## Task 7: Trigger wiring — POST /api/bookings

**Files:**
- Modify: `app/api/bookings/route.ts`

- [ ] **Step 1: Add the trigger call after the GHL sync**

In `app/api/bookings/route.ts`, add the import at the top:

```typescript
import { evaluateAndQueueEmails } from '@/lib/email-queue'
```

Then after the existing `syncToGHL` call (around line 200), add:

```typescript
    // Queue booking_pending emails — non-blocking
    evaluateAndQueueEmails('booking_pending', { type: 'booking', bookingId: booking.id }).catch(
      (err) => { console.error('email queue error on booking_pending:', err) },
    )
```

The full block after the fee insert should look like:

```typescript
    // Sync to GHL in the background — non-blocking so it doesn't delay the response
    syncToGHL(booking as Booking).catch((err) => {
      console.error('GHL sync error on booking creation:', err)
    })

    // Queue booking_pending emails — non-blocking
    evaluateAndQueueEmails('booking_pending', { type: 'booking', bookingId: booking.id }).catch(
      (err) => { console.error('email queue error on booking_pending:', err) },
    )

    return NextResponse.json({
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/bookings/route.ts
git commit -m "feat: wire booking_pending email trigger into POST /api/bookings"
```

---

## Task 8: Trigger wiring — Stripe webhook

**Files:**
- Modify: `app/api/stripe/webhook/route.ts`

- [ ] **Step 1: Add imports at the top of the webhook route**

Add to existing imports:

```typescript
import { evaluateAndQueueEmails, seedReminderEmails } from '@/lib/email-queue'
```

- [ ] **Step 2: Add trigger calls inside the payment_intent.succeeded case**

After the existing `notifyGHLBookingConfirmed` call, add:

```typescript
        evaluateAndQueueEmails('booking_confirmed', {
          type: 'booking',
          bookingId: (booking as Booking).id,
        }).catch((err) => { console.error('email queue error on booking_confirmed:', err) })

        evaluateAndQueueEmails('admin_new_booking', {
          type: 'booking',
          bookingId: (booking as Booking).id,
        }).catch((err) => { console.error('email queue error on admin_new_booking:', err) })

        seedReminderEmails((booking as Booking).id).catch((err) => {
          console.error('seedReminderEmails error:', err)
        })
```

The full `payment_intent.succeeded` case should now look like:

```typescript
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent

        const { data: booking, error } = await supabase
          .from('bookings')
          .update({
            status: 'confirmed',
            amount_paid: paymentIntent.amount_received / 100,
          })
          .eq('stripe_payment_intent_id', paymentIntent.id)
          .select()
          .single()

        if (error || !booking) {
          console.error('Failed to confirm booking on payment_intent.succeeded:', error)
          break
        }

        notifyGHLBookingConfirmed(booking as Booking).catch((err) => {
          console.error('GHL confirmation trigger error:', err)
        })

        evaluateAndQueueEmails('booking_confirmed', {
          type: 'booking',
          bookingId: (booking as Booking).id,
        }).catch((err) => { console.error('email queue error on booking_confirmed:', err) })

        evaluateAndQueueEmails('admin_new_booking', {
          type: 'booking',
          bookingId: (booking as Booking).id,
        }).catch((err) => { console.error('email queue error on admin_new_booking:', err) })

        seedReminderEmails((booking as Booking).id).catch((err) => {
          console.error('seedReminderEmails error:', err)
        })

        break
      }
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add app/api/stripe/webhook/route.ts
git commit -m "feat: wire booking_confirmed, admin_new_booking, reminder triggers into Stripe webhook"
```

---

## Task 9: Trigger wiring — cancel routes

**Files:**
- Modify: `app/api/bookings/[id]/cancel/guest/route.ts`
- Modify: `app/api/bookings/[id]/cancel/route.ts`

- [ ] **Step 1: Update guest cancel route**

Add import at the top of `app/api/bookings/[id]/cancel/guest/route.ts`:

```typescript
import { evaluateAndQueueEmails, cancelBookingEmails } from '@/lib/email-queue'
```

After the existing Stripe refund block (before the final `return NextResponse.json`), add:

```typescript
    evaluateAndQueueEmails('booking_cancelled', {
      type: 'booking',
      bookingId: params.id,
    }).catch((err) => { console.error('email queue error on booking_cancelled:', err) })

    evaluateAndQueueEmails('admin_cancelled', {
      type: 'booking',
      bookingId: params.id,
    }).catch((err) => { console.error('email queue error on admin_cancelled:', err) })

    cancelBookingEmails(params.id).catch((err) => {
      console.error('cancelBookingEmails error:', err)
    })
```

- [ ] **Step 2: Update admin cancel route**

Add the same import and the same three fire-and-forget calls to `app/api/bookings/[id]/cancel/route.ts` — after the Stripe refund/cancel block, before `return NextResponse.json({ success: true, ... })`:

```typescript
import { evaluateAndQueueEmails, cancelBookingEmails } from '@/lib/email-queue'
```

```typescript
    evaluateAndQueueEmails('booking_cancelled', {
      type: 'booking',
      bookingId: params.id,
    }).catch((err) => { console.error('email queue error on booking_cancelled:', err) })

    evaluateAndQueueEmails('admin_cancelled', {
      type: 'booking',
      bookingId: params.id,
    }).catch((err) => { console.error('email queue error on admin_cancelled:', err) })

    cancelBookingEmails(params.id).catch((err) => {
      console.error('cancelBookingEmails error:', err)
    })
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add app/api/bookings/[id]/cancel/guest/route.ts app/api/bookings/[id]/cancel/route.ts
git commit -m "feat: wire booking_cancelled, admin_cancelled triggers and queue cleanup into cancel routes"
```

---

## Task 10: Trigger wiring — contact route

**Files:**
- Modify: `app/api/contact/route.ts`

- [ ] **Step 1: Add import**

Add to imports in `app/api/contact/route.ts`:

```typescript
import { evaluateAndQueueEmails } from '@/lib/email-queue'
```

- [ ] **Step 2: Add trigger after GHL sync**

After the existing `syncContactInquiryToGHL` call, add:

```typescript
    evaluateAndQueueEmails('contact_submitted', {
      type: 'contact',
      name: body.name,
      email: body.email,
      phone: body.phone,
      message: body.message,
    }).catch((err) => { console.error('email queue error on contact_submitted:', err) })
```

The full POST handler should look like:

```typescript
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ContactBody

    if (!body.name || !body.email || !body.message) {
      return NextResponse.json(
        { error: 'name, email, and message are required' },
        { status: 400 },
      )
    }

    syncContactInquiryToGHL({
      name: body.name,
      email: body.email,
      phone: body.phone,
      message: body.message,
      smsConsent: body.smsConsent ?? false,
      marketingConsent: body.marketingConsent ?? false,
    }).catch((err) => {
      console.error('GHL contact sync error:', err)
    })

    evaluateAndQueueEmails('contact_submitted', {
      type: 'contact',
      name: body.name,
      email: body.email,
      phone: body.phone,
      message: body.message,
    }).catch((err) => { console.error('email queue error on contact_submitted:', err) })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('POST /api/contact error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add app/api/contact/route.ts
git commit -m "feat: wire contact_submitted email trigger into POST /api/contact"
```

---

## Task 10b: Trigger wiring — modify route

**Files:**
- Modify: `app/api/bookings/[id]/modify/route.ts`

- [ ] **Step 1: Add import**

Add to imports in `app/api/bookings/[id]/modify/route.ts`:

```typescript
import { evaluateAndQueueEmails } from '@/lib/email-queue'
```

- [ ] **Step 2: Add trigger after the modification request is created**

Find the line where the modification request insert succeeds and the route returns success, then add before the return:

```typescript
    evaluateAndQueueEmails('modification_requested', {
      type: 'booking',
      bookingId: params.id,
    }).catch((err) => { console.error('email queue error on modification_requested:', err) })
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add app/api/bookings/[id]/modify/route.ts
git commit -m "feat: wire modification_requested email trigger into modify route"
```

---

## Task 11: Admin API — email settings

**Files:**
- Create: `app/api/admin/email/settings/route.ts`
- Create: `__tests__/api/admin/email-settings.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/api/admin/email-settings.test.ts`:

```typescript
/**
 * @jest-environment node
 */
import { GET, PUT } from '@/app/api/admin/email/settings/route'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase'

jest.mock('@/lib/supabase', () => ({
  createServerSupabaseClient: jest.fn(),
  createServiceRoleClient: jest.fn(),
}))

const mockServerClient = createServerSupabaseClient as jest.Mock
const mockServiceClient = createServiceRoleClient as jest.Mock

const authedUser = { id: 'user-1' }

function mockAuth(user: typeof authedUser | null) {
  mockServerClient.mockResolvedValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user }, error: null }) },
  })
}

const mockSettings = {
  id: 'es-1',
  from_name: 'TOTH',
  from_email: 'noreply@example.com',
  admin_recipients: ['admin@example.com'],
  review_url: 'https://g.page/review',
}

describe('GET /api/admin/email/settings', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns settings when authenticated', async () => {
    mockAuth(authedUser)
    const maybeSingle = jest.fn().mockResolvedValue({ data: mockSettings, error: null })
    const select = jest.fn().mockReturnValue({ maybeSingle })
    const from = jest.fn().mockReturnValue({ select })
    mockServiceClient.mockReturnValue({ from })

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.from_name).toBe('TOTH')
  })
})

describe('PUT /api/admin/email/settings', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth(null)
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({}),
    })
    const res = await PUT(req as never)
    expect(res.status).toBe(401)
  })

  it('updates existing settings row', async () => {
    mockAuth(authedUser)
    const singleSelect = jest.fn().mockResolvedValue({ data: { id: 'es-1' }, error: null })
    const selectForId = jest.fn().mockReturnValue({ maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'es-1' }, error: null }) })
    const singleUpdate = jest.fn().mockResolvedValue({ data: mockSettings, error: null })
    const eqUpdate = jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ single: jest.fn().mockResolvedValue({ data: mockSettings, error: null }) }) })
    const updateFn = jest.fn().mockReturnValue({ eq: eqUpdate })
    const from = jest.fn().mockImplementation((table: string) => {
      if (table === 'email_settings') return { select: selectForId, update: updateFn }
      return {}
    })
    mockServiceClient.mockReturnValue({ from })

    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ from_name: 'New Name' }),
    })
    const res = await PUT(req as never)
    expect(res.status).toBe(200)
  })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
npm test -- --testPathPattern="__tests__/api/admin/email-settings.test.ts" --no-coverage
```

Expected: FAIL — route not found.

- [ ] **Step 3: Create the route**

Create `app/api/admin/email/settings/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase'

async function requireAuth() {
  const server = await createServerSupabaseClient()
  const { data: { user }, error } = await server.auth.getUser()
  return error || !user ? null : user
}

export async function GET() {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceRoleClient()
  const { data, error } = await supabase.from('email_settings').select('*').maybeSingle()
  if (error) {
    console.error('GET email settings error:', error)
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 })
  }
  return NextResponse.json(data ?? {})
}

export async function PUT(request: NextRequest) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json()) as Record<string, unknown>
  const supabase = createServiceRoleClient()

  const { data: existing } = await supabase
    .from('email_settings')
    .select('id')
    .maybeSingle()

  const { data, error } = existing
    ? await supabase
        .from('email_settings')
        .update(body)
        .eq('id', (existing as { id: string }).id)
        .select()
        .single()
    : await supabase
        .from('email_settings')
        .insert(body)
        .select()
        .single()

  if (error) {
    console.error('PUT email settings error:', error)
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
  }
  return NextResponse.json(data)
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- --testPathPattern="__tests__/api/admin/email-settings.test.ts" --no-coverage
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/email/settings/route.ts __tests__/api/admin/email-settings.test.ts
git commit -m "feat: add admin API GET/PUT /api/admin/email/settings"
```

---

## Task 12: Admin API — email templates

**Files:**
- Create: `app/api/admin/email/templates/route.ts`
- Create: `app/api/admin/email/templates/[id]/route.ts`
- Create: `__tests__/api/admin/email-templates.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/api/admin/email-templates.test.ts`:

```typescript
/**
 * @jest-environment node
 */
import { GET as LIST, POST } from '@/app/api/admin/email/templates/route'
import { GET, PUT, DELETE } from '@/app/api/admin/email/templates/[id]/route'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase'

jest.mock('@/lib/supabase', () => ({
  createServerSupabaseClient: jest.fn(),
  createServiceRoleClient: jest.fn(),
}))

const mockServerClient = createServerSupabaseClient as jest.Mock
const mockServiceClient = createServiceRoleClient as jest.Mock

const authedUser = { id: 'user-1' }

function mockAuth(user: typeof authedUser | null) {
  mockServerClient.mockResolvedValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user }, error: null }) },
  })
}

const mockTemplate = {
  id: 't-1',
  name: 'Booking Confirmation',
  subject: 'Your booking is confirmed',
  body: '<p>Hello {{guest_first_name}}</p>',
  is_active: true,
  created_at: '2026-04-20T00:00:00Z',
  updated_at: '2026-04-20T00:00:00Z',
}

describe('GET /api/admin/email/templates', () => {
  it('returns 401 when unauthenticated', async () => {
    mockAuth(null)
    const res = await LIST()
    expect(res.status).toBe(401)
  })

  it('returns template list', async () => {
    mockAuth(authedUser)
    const order = jest.fn().mockResolvedValue({ data: [mockTemplate], error: null })
    const select = jest.fn().mockReturnValue({ order })
    mockServiceClient.mockReturnValue({ from: jest.fn().mockReturnValue({ select }) })
    const res = await LIST()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(1)
  })
})

describe('POST /api/admin/email/templates', () => {
  it('creates a template', async () => {
    mockAuth(authedUser)
    const single = jest.fn().mockResolvedValue({ data: mockTemplate, error: null })
    const select = jest.fn().mockReturnValue({ single })
    const insert = jest.fn().mockReturnValue({ select })
    mockServiceClient.mockReturnValue({ from: jest.fn().mockReturnValue({ insert }) })
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ name: 'Booking Confirmation', subject: 'Confirmed', body: '<p>Hi</p>' }),
    })
    const res = await POST(req as never)
    expect(res.status).toBe(201)
  })
})

describe('PUT /api/admin/email/templates/[id]', () => {
  it('updates a template', async () => {
    mockAuth(authedUser)
    const single = jest.fn().mockResolvedValue({ data: mockTemplate, error: null })
    const selectFn = jest.fn().mockReturnValue({ single })
    const eq = jest.fn().mockReturnValue({ select: selectFn })
    const update = jest.fn().mockReturnValue({ eq })
    mockServiceClient.mockReturnValue({ from: jest.fn().mockReturnValue({ update }) })
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ name: 'Updated' }),
    })
    const res = await PUT(req as never, { params: { id: 't-1' } })
    expect(res.status).toBe(200)
  })
})

describe('DELETE /api/admin/email/templates/[id]', () => {
  it('deletes a template', async () => {
    mockAuth(authedUser)
    const eq = jest.fn().mockResolvedValue({ error: null })
    const deleteFn = jest.fn().mockReturnValue({ eq })
    mockServiceClient.mockReturnValue({ from: jest.fn().mockReturnValue({ delete: deleteFn }) })
    const res = await DELETE(new Request('http://localhost') as never, { params: { id: 't-1' } })
    expect(res.status).toBe(200)
  })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
npm test -- --testPathPattern="__tests__/api/admin/email-templates.test.ts" --no-coverage
```

Expected: FAIL — modules not found.

- [ ] **Step 3: Create app/api/admin/email/templates/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase'

async function requireAuth() {
  const server = await createServerSupabaseClient()
  const { data: { user }, error } = await server.auth.getUser()
  return error || !user ? null : user
}

export async function GET() {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('email_templates')
    .select('*')
    .order('name')
  if (error) {
    console.error('GET email templates error:', error)
    return NextResponse.json({ error: 'Failed to load templates' }, { status: 500 })
  }
  return NextResponse.json(data ?? [])
}

export async function POST(request: NextRequest) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = (await request.json()) as Record<string, unknown>
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('email_templates')
    .insert(body)
    .select()
    .single()
  if (error) {
    console.error('POST email template error:', error)
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}
```

- [ ] **Step 4: Create app/api/admin/email/templates/[id]/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase'

async function requireAuth() {
  const server = await createServerSupabaseClient()
  const { data: { user }, error } = await server.auth.getUser()
  return error || !user ? null : user
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('email_templates')
    .select('*')
    .eq('id', params.id)
    .single()
  if (error || !data) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 })
  }
  return NextResponse.json(data)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = (await request.json()) as Record<string, unknown>
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('email_templates')
    .update(body)
    .eq('id', params.id)
    .select()
    .single()
  if (error) {
    console.error('PUT email template error:', error)
    return NextResponse.json({ error: 'Failed to update template' }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = createServiceRoleClient()
  const { error } = await supabase
    .from('email_templates')
    .delete()
    .eq('id', params.id)
  if (error) {
    console.error('DELETE email template error:', error)
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 5: Run tests**

```bash
npm test -- --testPathPattern="__tests__/api/admin/email-templates.test.ts" --no-coverage
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/api/admin/email/templates/ __tests__/api/admin/email-templates.test.ts
git commit -m "feat: add admin CRUD API for email templates"
```

---

## Task 13: Admin API — email automations

**Files:**
- Create: `app/api/admin/email/automations/route.ts`
- Create: `app/api/admin/email/automations/[id]/route.ts`
- Create: `__tests__/api/admin/email-automations.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/api/admin/email-automations.test.ts`:

```typescript
/**
 * @jest-environment node
 */
import { GET as LIST, POST } from '@/app/api/admin/email/automations/route'
import { GET, PUT, DELETE } from '@/app/api/admin/email/automations/[id]/route'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase'

jest.mock('@/lib/supabase', () => ({
  createServerSupabaseClient: jest.fn(),
  createServiceRoleClient: jest.fn(),
}))

const mockServerClient = createServerSupabaseClient as jest.Mock
const mockServiceClient = createServiceRoleClient as jest.Mock

const authedUser = { id: 'user-1' }

function mockAuth(user: typeof authedUser | null) {
  mockServerClient.mockResolvedValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user }, error: null }) },
  })
}

const mockAutomation = {
  id: 'a-1',
  name: 'Booking Confirmed',
  trigger_event: 'booking_confirmed',
  is_active: true,
  delay_minutes: 0,
  conditions: { operator: 'AND', rules: [] },
  template_id: 't-1',
  recipient_type: 'guest',
  is_pre_planned: true,
  created_at: '2026-04-20T00:00:00Z',
  updated_at: '2026-04-20T00:00:00Z',
}

describe('GET /api/admin/email/automations', () => {
  it('returns 401 when unauthenticated', async () => {
    mockAuth(null)
    const res = await LIST()
    expect(res.status).toBe(401)
  })

  it('returns automation list', async () => {
    mockAuth(authedUser)
    const order = jest.fn().mockResolvedValue({ data: [mockAutomation], error: null })
    const select = jest.fn().mockReturnValue({ order })
    mockServiceClient.mockReturnValue({ from: jest.fn().mockReturnValue({ select }) })
    const res = await LIST()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(1)
  })
})

describe('POST /api/admin/email/automations', () => {
  it('creates a custom automation', async () => {
    mockAuth(authedUser)
    const single = jest.fn().mockResolvedValue({ data: { ...mockAutomation, is_pre_planned: false }, error: null })
    const select = jest.fn().mockReturnValue({ single })
    const insert = jest.fn().mockReturnValue({ select })
    mockServiceClient.mockReturnValue({ from: jest.fn().mockReturnValue({ insert }) })
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ name: 'Custom', trigger_event: 'booking_confirmed', delay_minutes: 60 }),
    })
    const res = await POST(req as never)
    expect(res.status).toBe(201)
  })
})

describe('PUT /api/admin/email/automations/[id]', () => {
  it('updates an automation', async () => {
    mockAuth(authedUser)
    const single = jest.fn().mockResolvedValue({ data: mockAutomation, error: null })
    const selectFn = jest.fn().mockReturnValue({ single })
    const eq = jest.fn().mockReturnValue({ select: selectFn })
    const update = jest.fn().mockReturnValue({ eq })
    mockServiceClient.mockReturnValue({ from: jest.fn().mockReturnValue({ update }) })
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ is_active: false }),
    })
    const res = await PUT(req as never, { params: { id: 'a-1' } })
    expect(res.status).toBe(200)
  })
})

describe('DELETE /api/admin/email/automations/[id]', () => {
  it('refuses to delete pre-planned automations', async () => {
    mockAuth(authedUser)
    const single = jest.fn().mockResolvedValue({ data: { is_pre_planned: true }, error: null })
    const eq = jest.fn().mockReturnValue({ single })
    const select = jest.fn().mockReturnValue({ eq })
    mockServiceClient.mockReturnValue({ from: jest.fn().mockReturnValue({ select }) })
    const res = await DELETE(new Request('http://localhost') as never, { params: { id: 'a-1' } })
    expect(res.status).toBe(403)
  })

  it('deletes a custom automation', async () => {
    mockAuth(authedUser)
    const eqDel = jest.fn().mockResolvedValue({ error: null })
    const deleteFn = jest.fn().mockReturnValue({ eq: eqDel })
    const eqSel = jest.fn().mockReturnValue({ single: jest.fn().mockResolvedValue({ data: { is_pre_planned: false }, error: null }) })
    const select = jest.fn().mockReturnValue({ eq: eqSel })
    mockServiceClient.mockReturnValue({
      from: jest.fn().mockReturnValue({ select, delete: deleteFn }),
    })
    const res = await DELETE(new Request('http://localhost') as never, { params: { id: 'a-2' } })
    expect(res.status).toBe(200)
  })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
npm test -- --testPathPattern="__tests__/api/admin/email-automations.test.ts" --no-coverage
```

Expected: FAIL — modules not found.

- [ ] **Step 3: Create app/api/admin/email/automations/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase'

async function requireAuth() {
  const server = await createServerSupabaseClient()
  const { data: { user }, error } = await server.auth.getUser()
  return error || !user ? null : user
}

export async function GET() {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('email_automations')
    .select('*')
    .order('is_pre_planned', { ascending: false })
    .order('name')
  if (error) {
    console.error('GET email automations error:', error)
    return NextResponse.json({ error: 'Failed to load automations' }, { status: 500 })
  }
  return NextResponse.json(data ?? [])
}

export async function POST(request: NextRequest) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = (await request.json()) as Record<string, unknown>
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('email_automations')
    .insert({ ...body, is_pre_planned: false })
    .select()
    .single()
  if (error) {
    console.error('POST email automation error:', error)
    return NextResponse.json({ error: 'Failed to create automation' }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}
```

- [ ] **Step 4: Create app/api/admin/email/automations/[id]/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase'

async function requireAuth() {
  const server = await createServerSupabaseClient()
  const { data: { user }, error } = await server.auth.getUser()
  return error || !user ? null : user
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('email_automations')
    .select('*')
    .eq('id', params.id)
    .single()
  if (error || !data) {
    return NextResponse.json({ error: 'Automation not found' }, { status: 404 })
  }
  return NextResponse.json(data)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = (await request.json()) as Record<string, unknown>
  // Prevent overwriting is_pre_planned via API
  delete body.is_pre_planned
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('email_automations')
    .update(body)
    .eq('id', params.id)
    .select()
    .single()
  if (error) {
    console.error('PUT email automation error:', error)
    return NextResponse.json({ error: 'Failed to update automation' }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = createServiceRoleClient()

  const { data: existing } = await supabase
    .from('email_automations')
    .select('is_pre_planned')
    .eq('id', params.id)
    .single()

  if ((existing as { is_pre_planned?: boolean } | null)?.is_pre_planned) {
    return NextResponse.json(
      { error: 'Cannot delete pre-planned automations' },
      { status: 403 },
    )
  }

  const { error } = await supabase
    .from('email_automations')
    .delete()
    .eq('id', params.id)

  if (error) {
    console.error('DELETE email automation error:', error)
    return NextResponse.json({ error: 'Failed to delete automation' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 5: Run tests**

```bash
npm test -- --testPathPattern="__tests__/api/admin/email-automations.test.ts" --no-coverage
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/api/admin/email/automations/ __tests__/api/admin/email-automations.test.ts
git commit -m "feat: add admin CRUD API for email automations"
```

---

## Task 14: Add Email to admin sidebar

**Files:**
- Modify: `components/admin/AdminSidebar.tsx`

- [ ] **Step 1: Add the EnvelopeIcon import and nav entry**

In `components/admin/AdminSidebar.tsx`, add `EnvelopeIcon` to the heroicons import:

```typescript
import {
  ArrowPathIcon,
  ArrowRightOnRectangleIcon,
  BanknotesIcon,
  Bars3Icon,
  BuildingOfficeIcon,
  CalendarDaysIcon,
  CalendarIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  EnvelopeIcon,
  HomeIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
```

Then add the Email entry to `NAV_ITEMS` before Settings:

```typescript
export const NAV_ITEMS = [
  { label: 'Dashboard',       href: '/admin',              icon: ChartBarIcon },
  { label: 'Properties',      href: '/admin/properties',   icon: BuildingOfficeIcon },
  { label: 'Rooms',           href: '/admin/rooms',        icon: HomeIcon },
  { label: 'Bookings',        href: '/admin/bookings',     icon: CalendarIcon },
  { label: 'Calendar',        href: '/admin/calendar',     icon: CalendarDaysIcon },
  { label: 'iCal Sync',       href: '/admin/ical',         icon: ArrowPathIcon },
  { label: 'Payout Accounts', href: '/admin/payout-accounts', icon: BanknotesIcon },
  { label: 'Email',           href: '/admin/email',        icon: EnvelopeIcon },
  { label: 'Settings',        href: '/admin/settings',     icon: Cog6ToothIcon },
]
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Run full test suite**

```bash
npm test -- --no-coverage
```

Expected: all existing tests still pass alongside the new ones.

- [ ] **Step 4: Commit**

```bash
git add components/admin/AdminSidebar.tsx
git commit -m "feat: add Email section to admin sidebar navigation"
```

---

## Final check

- [ ] **Run full test suite one last time**

```bash
npm test -- --no-coverage
```

Expected: all tests pass, no regressions.

---

## What comes next

**Plan 2 — Email System Admin UI** covers:
- `/admin/email/settings` page
- `/admin/email/templates` list + Tiptap editor with merge tag chip insertion + live preview
- `/admin/email/automations` page with Pre-Planned and Custom tabs + condition builder

That plan is a separate document and should be started after this backend plan is fully complete and all tests pass.
