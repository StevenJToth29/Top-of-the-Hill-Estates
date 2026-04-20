# Email System Design

**Date:** 2026-04-20
**Status:** Approved

## Overview

Replace GHL-driven email sends with a first-party email system built directly into the website. GHL continues to receive all contact and booking data for CRM tracking — no changes there. The new system adds Resend as the delivery provider, a Supabase-backed template store and email queue, an admin UI for managing templates and automation rules, and an external-cron-triggered queue processor.

---

## Architecture

Five layers:

1. **Resend** — delivery provider, called via API from the Next.js backend
2. **Supabase** — stores email templates, automation rules, email settings, and the email queue
3. **Trigger points** — existing API routes call `evaluateAndQueueEmails(event, context)` after their primary work; this evaluates active automations and inserts rows into the queue
4. **Admin UI** — a new "Email" section in the admin sidebar with three sub-pages: Settings, Templates, Automations
5. **External cron** — calls `POST /api/cron/process-email-queue` (secured with existing `CRON_SECRET`) on a configurable interval; picks up due queue rows, resolves merge tags, sends via Resend, marks delivered or failed

Cancellation is handled by marking pending queue rows as `cancelled` in the DB when a booking is cancelled — no Resend API calls required.

---

## Data Model

### `email_templates`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `name` | text | Admin-facing label |
| `subject` | text | Supports merge tags |
| `body` | text | Rich text HTML, merge tags as `{{variable}}` |
| `is_active` | bool | Soft disable |
| `created_at` | timestamptz | Auto |
| `updated_at` | timestamptz | Auto |

### `email_automations`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `name` | text | Admin-facing label |
| `trigger_event` | enum | See trigger events below |
| `is_active` | bool | On/off toggle |
| `delay_minutes` | int | 0 = immediate; positive = after event; negative = before event (e.g. -2880 = 2 days before check-in) |
| `conditions` | jsonb | Array of condition blocks |
| `template_id` | uuid | FK → email_templates |
| `recipient_type` | enum | `guest`, `admin`, `both` |
| `is_pre_planned` | bool | Distinguishes built-in vs custom |
| `created_at` | timestamptz | Auto |
| `updated_at` | timestamptz | Auto |

**Trigger event enum values:**
`booking_confirmed`, `booking_pending`, `booking_cancelled`, `contact_submitted`, `checkin_reminder`, `checkout_reminder`, `post_checkout`, `review_request`, `modification_requested`, `admin_new_booking`, `admin_cancelled`

**Condition block JSONB shape:**
```json
{
  "operator": "AND",
  "rules": [
    { "field": "booking_type", "op": "eq", "value": "long_term" },
    { "field": "total_nights", "op": "gte", "value": 14 }
  ]
}
```

Supported condition fields: `booking_type`, `total_nights`, `total_amount`, `room_id`, `property_id`, `is_returning_guest`, `marketing_consent`, `sms_consent`
Supported operators: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`

### `email_queue`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `automation_id` | uuid | FK → email_automations |
| `template_id` | uuid | FK → email_templates |
| `booking_id` | uuid | Nullable FK → bookings |
| `recipient_email` | text | Resolved at queue time |
| `recipient_type` | enum | `guest` or `admin` |
| `send_at` | timestamptz | When to deliver |
| `status` | enum | `pending`, `sent`, `failed`, `cancelled` |
| `resolved_variables` | jsonb | Snapshot of merge tag values at queue time |
| `attempts` | int | Retry count, default 0 |
| `error` | text | Last error message if failed |
| `sent_at` | timestamptz | Null until delivered |
| `created_at` | timestamptz | Auto |

### `email_settings`

Single row, global config.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `from_name` | text | e.g. "Top of the Hill Estates" |
| `from_email` | text | e.g. "noreply@yourdomain.com" |
| `admin_recipients` | text[] | Multiple admin email addresses |
| `review_url` | text | Single URL for review request emails |

---

## Merge Tag System

Variables use `{{variable_name}}` syntax in both subject and body fields. Resolved at send time from the `resolved_variables` JSONB snapshot in the queue row.

| Category | Variables |
|----------|-----------|
| Guest | `guest_first_name`, `guest_last_name`, `guest_email`, `guest_phone` |
| Booking | `booking_id`, `check_in_date`, `check_out_date`, `total_nights`, `total_amount`, `room_name`, `property_name`, `booking_type` |
| Property | `property_address`, `checkin_time`, `checkout_time`, `house_rules` |
| Site | `business_name`, `contact_phone`, `contact_email`, `review_url` |
| Contact form | `contact_name`, `contact_email`, `contact_phone`, `contact_message` (available only on `contact_submitted` automations) |

---

## Admin UI

New top-level "Email" section in the admin sidebar with three sub-pages.

### `/admin/email/settings`

Form fields:
- From Name, From Email
- Admin Recipients — tag-style multi-input (type + Enter to add, × to remove)
- Review URL
- Save button

### `/admin/email/templates`

List view: name, subject preview, active toggle, Edit/Delete actions. New Template button.

Editor (`/admin/email/templates/[id]`):
- Name input (admin-facing)
- Subject input with `{{ }}` insert button → variable picker dropdown
- Tiptap WYSIWYG editor: formatting toolbar (bold, italic, underline, links, bullets) + Insert Variable button → same picker; variables render as styled chips in the editor and stored as `{{variable}}` in HTML
- Preview panel with sample data
- Active toggle + Save

### `/admin/email/automations`

Two tabs: **Pre-Planned** and **Custom**.

**Pre-Planned tab** — table with one row per built-in trigger:
- Trigger name
- On/Off toggle
- Template selector dropdown
- Delay field: number input + unit selector (minutes/hours/days), negative values supported
- Recipient badge (Guest / Admin / Both)

Pre-planned triggers: Booking Confirmed, Booking Pending, Booking Cancelled, Contact Form Submitted, Check-in Reminder, Check-out Reminder, Post-Checkout, Review Request, Modification Requested, Admin — New Booking, Admin — Booking Cancelled

**Custom tab** — list of custom automations with New Automation button.

Automation builder form:
1. Trigger — dropdown of all trigger events
2. Conditions — "Add Condition" builds rows of `[field] [operator] [value]`; AND/OR selector at top
3. Delay — number + unit input
4. Action — template selector + recipient type (Guest / Admin / Both)
5. Name field + Active toggle + Save

---

## Trigger Wiring

A new `evaluateAndQueueEmails(event, context)` utility is called after primary work completes in these routes:

| Route | Event(s) |
|-------|----------|
| `POST /api/bookings` | `booking_pending` |
| Stripe webhook `payment_intent.succeeded` | `booking_confirmed`, `admin_new_booking` + seeds reminder events |
| `POST /api/bookings/[id]/cancel/guest` | `booking_cancelled`, `admin_cancelled` + cancels pending queue rows |
| `POST /api/bookings/[id]/cancel` (admin) | `booking_cancelled`, `admin_cancelled` + cancels pending queue rows |
| `POST /api/contact` | `contact_submitted` |
| `POST /api/bookings/[id]/modify` | `modification_requested` |

Reminder-type events (`checkin_reminder`, `checkout_reminder`, `post_checkout`, `review_request`) are seeded into the queue at booking confirmation time with pre-computed `send_at` timestamps derived from the booking's check-in/check-out dates and each automation's `delay_minutes`.

### `evaluateAndQueueEmails` logic

```
1. Load all active automations WHERE trigger_event = event
2. For each automation:
   a. Evaluate conditions against booking/guest context
   b. If conditions pass:
      - Resolve recipient email(s)
      - Compute send_at = now() + delay_minutes
      - Snapshot resolved_variables from booking data
      - Insert row(s) into email_queue
3. Non-blocking — errors are logged, never thrown
```

### Cancellation cleanup

When a booking is cancelled, after queuing the `booking_cancelled` email:

```sql
UPDATE email_queue
SET status = 'cancelled'
WHERE booking_id = $1
  AND status = 'pending'
  AND automation_id NOT IN (
    SELECT id FROM email_automations WHERE trigger_event = 'booking_cancelled'
  )
```

---

## Queue Processor

**`POST /api/cron/process-email-queue`**

Authorization: `Bearer <CRON_SECRET>` header required.

```
1. Query email_queue WHERE status = 'pending' AND send_at <= now() LIMIT 50
2. For each row:
   a. Load template subject + body
   b. Replace {{variable}} tokens with resolved_variables values
   c. Send via Resend API
   d. On success: UPDATE status = 'sent', sent_at = now()
   e. On failure: increment attempts
      - If attempts >= 3: UPDATE status = 'failed'
      - Else: leave as pending for next cron run
3. Return { processed: N, failed: M }
```

The 50-row limit prevents timeout on large batches. External cron recommended interval: every 15 minutes.

---

## New Environment Variables

```
RESEND_API_KEY=
EMAIL_FROM_ADDRESS=   # fallback if not set in email_settings
```

---

## Build Order

1. Supabase migrations (4 new tables)
2. Resend wrapper (`lib/email.ts`) + queue processor endpoint
3. Trigger wiring into existing API routes
4. Admin Settings page
5. Admin Templates editor
6. Admin Automations — Pre-Planned tab
7. Admin Automations — Custom builder tab

---

## Out of Scope

- Email open/click analytics (Resend dashboard covers this)
- SMS notifications
- Unsubscribe management beyond existing `marketing_consent` field (transactional emails are legally exempt)
- Email attachments (iCal)
