# Top of the Hill Rooms

Direct booking platform for Top of the Hill Rooms (Top of the Hill Estates, LLC) — short-term and long-term furnished room rentals in Mesa/Tempe, Arizona.

**Live site:** tothrooms.com

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth
- **Payments:** Stripe
- **CRM:** GoHighLevel
- **Styling:** Tailwind CSS (Editorial Glassmorphism design system)
- **Hosting:** Vercel
- **iCal:** ical-generator (export), node-ical (import)

## Prerequisites

- Node.js 18+
- npm or yarn
- [Supabase account](https://supabase.com)
- [Stripe account](https://stripe.com)
- [Vercel account](https://vercel.com)
- GoHighLevel account (optional — CRM integration)

## Local Development Setup

### 1. Clone the repository

```bash
git clone https://github.com/StevenJToth29/Top-of-the-Hill-Estates.git
cd Top-of-the-Hill-Estates
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up Supabase

1. Create a new Supabase project at https://supabase.com
2. Go to Settings → API to get your project URL and API keys
3. Run the database migration:
   - Go to SQL Editor in the Supabase dashboard
   - Copy and run `supabase/migrations/001_initial_schema.sql`
4. Optionally seed the database with sample rooms:
   - Run `supabase/seed.sql` in the SQL Editor

### 4. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in all values in `.env.local` (see Environment Variables section below).

### 5. Set up Stripe

1. Create a Stripe account at https://stripe.com
2. Get your test API keys from the Stripe Dashboard
3. Set up a webhook endpoint:
   - Go to Developers → Webhooks
   - Add endpoint: `https://your-domain.com/api/stripe/webhook`
   - Select events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `checkout.session.completed`
   - Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET`

### 6. Run the development server

```bash
npm run dev
```

Open http://localhost:3000 to see the site.
Open http://localhost:3000/admin to access the admin panel (requires Supabase Auth login).

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | `https://abc123.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous (public) key | `eyJh...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only, never expose) | `eyJh...` |
| `STRIPE_SECRET_KEY` | Stripe secret key (server-only) | `sk_test_...` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (safe for client) | `pk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook endpoint signing secret | `whsec_...` |
| `GHL_API_KEY` | GoHighLevel API key | `...` |
| `GHL_BOOKING_WEBHOOK_URL` | GHL workflow webhook URL for new bookings | `https://...` |
| `GHL_LOCATION_ID` | GoHighLevel location/sub-account ID | `...` |
| `CRON_SECRET` | Secret token for authenticating external cron job calls | any random string |
| `NEXT_PUBLIC_SITE_URL` | Public URL of the deployed site | `https://tothrooms.com` |

## Database

### Schema

Tables: `properties`, `rooms`, `bookings`, `ical_blocks`, `ical_sources`, `site_settings`

See `supabase/migrations/001_initial_schema.sql` for the full schema.

### Seed Data

`supabase/seed.sql` contains ~30 sample rooms across 3 properties (Northridge, Linden, Mesa Downtown) to get started.

Run in Supabase SQL Editor or via Supabase CLI:

```bash
supabase db push  # if using Supabase CLI
```

## iCal Sync (External Cron)

iCal import sync is triggered by an **external cron service** to avoid Vercel function timeout costs.

### Setup with cron-job.org (free)

1. Create a free account at https://cron-job.org
2. Add a new cron job:
   - URL: `https://your-domain.com/api/ical/sync`
   - Method: POST
   - Header: `Authorization: Bearer YOUR_CRON_SECRET`
   - Schedule: Every 4 hours (or as needed)
3. The endpoint upserts iCal blocks from all configured Airbnb/VRBO sources

### Per-room iCal Export

Each room has a unique iCal feed URL for syncing TO external platforms:

```
https://tothrooms.com/api/ical/{room_ical_export_token}
```

Find the export URL for each room in the Admin panel under iCal Sync.

## Admin Panel

Access at `/admin`. Login with Supabase Auth credentials.

**Creating the admin account:**
In Supabase Dashboard → Authentication → Users, create a user with email + password. Only this user can access the admin panel (no public registration).

**Admin sections:**
- **Dashboard** — Booking stats, revenue, upcoming check-ins
- **Rooms** — Add/edit rooms, manage images, configure rates
- **Bookings** — View all bookings, cancel with refund, create manual bookings
- **Calendar** — Visual multi-room availability grid
- **iCal Sync** — Configure Airbnb/VRBO import URLs, trigger manual sync
- **Settings** — About Us text, contact info, business settings

## Deployment (Vercel)

### 1. Connect repository to Vercel

Import the GitHub repository in the Vercel dashboard.

### 2. Configure environment variables

Add all variables from `.env.example` in Vercel Dashboard → Settings → Environment Variables.

### 3. Deploy

Push to `main` to trigger a production deployment.

### 4. Configure Stripe webhook for production

Update your Stripe webhook endpoint URL to the production Vercel URL.

## Cancellation Policy

**Short-term bookings:**
- Cancelled > 7 days before check-in → Full refund
- Cancelled > 72 hours but ≤ 7 days before check-in → 50% refund
- Cancelled ≤ 72 hours before check-in → No refund

**Long-term bookings:**
- First month's rent deposit is non-refundable

## A2P SMS Compliance

All phone number collection forms include TCPA/A2P 10DLC compliant consent checkboxes per FCC requirements. Consent data (`sms_consent`, `marketing_consent`) is stored on each booking record.

## Development Notes

- Dates are stored as UTC in the database and displayed in America/Phoenix timezone (UTC-7, no DST)
- All Supabase queries in server components use `createServerSupabaseClient()`
- Admin routes are protected by Next.js middleware using Supabase Auth session
- API routes use `createServiceRoleClient()` for privileged database operations
