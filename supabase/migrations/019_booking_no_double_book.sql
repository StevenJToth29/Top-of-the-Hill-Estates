-- Prevent overlapping confirmed/pending bookings for the same room.
-- Requires btree_gist extension for multi-column exclusion constraints.

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE bookings
  ADD CONSTRAINT no_overlapping_bookings
  EXCLUDE USING gist (
    room_id WITH =,
    daterange(check_in::date, check_out::date, '[)') WITH &&
  )
  WHERE (status IN ('confirmed', 'pending'));
