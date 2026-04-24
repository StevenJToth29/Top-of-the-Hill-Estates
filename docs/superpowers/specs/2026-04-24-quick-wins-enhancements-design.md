# Quick Wins Enhancements — Design Spec

**Date:** 2026-04-24  
**Status:** Approved

## Overview

Three self-contained enhancements across guest experience, operations, and revenue. Each is independent and can be implemented in any order.

> **Deferred:** Promo/discount codes are out of scope for this iteration. Design exists in conversation history for future reference.

---

## Feature 1: CSV Booking Export

### Goal

Allow admins to download the current bookings table view as a CSV file.

### Architecture

- **UI:** "Export CSV" button on the admin bookings table, top-right, near existing filters.
- **Route:** `GET /api/admin/bookings/export` — server-side, auth-gated to admin.
- **Behaviour:** Applies the same filters currently active on the table (date range, room, status) before generating output. Browser receives the response as a file download (`Content-Disposition: attachment`).
- **No new DB schema required.**

### CSV Columns

Booking ID, Guest Name, Guest Email, Room, Check-in, Check-out, Nights, Total Price, Status, Source, Notes, Created At.

---

## Feature 2: Abandoned Booking Recovery Email

### Goal

Re-engage guests who started a booking but never completed payment.

### Architecture

- **Trigger:** Hook into the existing pending booking expiry logic. When a pending booking is marked expired, if it has a guest email, fire one recovery email.
- **Email template:** New template following the existing template style.
- **Link destination:** `/rooms/[slug]` — guest starts a fresh booking (no "resume" state needed).
- **One email per expired booking, no follow-up sequence.**
- **No new DB columns required.**

### Email Content

- **Subject:** "You left something behind at Top of the Hill Estates"
- **Body:** Addresses guest by name, names the room and dates, states it's still available, includes a "Book Now" CTA linking to the room page.

---

## Feature 3: Native Review Collection

### Goal

Collect post-stay reviews from guests, give admins an approval queue, and surface approved reviews publicly on the homepage.

### Database

New `reviews` table:

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `booking_id` | uuid | FK → bookings, unique (one review per stay) |
| `rating` | int | 1–5 |
| `comment` | text | nullable |
| `approved` | boolean | default false |
| `created_at` | timestamptz | |

### Guest Flow

1. After a booking's `check_out` date passes, a scheduled job (or the existing cleanup job) sends a "How was your stay?" email containing a link to `/review/[bookingId]`.
2. The review page shows room name and dates, and collects a star rating (1–5) and optional written comment.
3. On submit, the link becomes invalid (enforced by checking whether a review already exists for that `booking_id`).
4. Guest sees a "Thanks for your review!" confirmation.

### Admin Flow

- New **Reviews** section in the admin nav.
- Table listing all submitted reviews: guest name, room, rating, comment, date, approval status.
- Admin can **approve** or **delete** each review.
- Only approved reviews are visible publicly.

### Public Display

- Approved reviews replace or supplement any existing hardcoded/placeholder reviews on the homepage.
- Reviews are fetched from the `reviews` table filtered by `approved = true`.
