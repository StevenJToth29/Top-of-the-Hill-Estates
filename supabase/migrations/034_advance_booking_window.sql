-- supabase/migrations/034_advance_booking_window.sql
ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS max_advance_booking_days integer,
  ADD COLUMN IF NOT EXISTS max_advance_booking_applies_to text NOT NULL DEFAULT 'both'
    CHECK (max_advance_booking_applies_to IN ('short_term', 'long_term', 'both'));

-- Default existing rooms to 6 months (182 days)
UPDATE rooms SET max_advance_booking_days = 182 WHERE max_advance_booking_days IS NULL;
