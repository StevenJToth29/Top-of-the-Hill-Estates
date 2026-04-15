-- supabase/migrations/004_add_fees.sql

-- Specific fee columns on rooms (configurable per room by admin)
ALTER TABLE rooms
  ADD COLUMN cleaning_fee NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN security_deposit NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN extra_guest_fee NUMERIC NOT NULL DEFAULT 0;

-- Snapshot specific fees at booking time; guest_count not previously stored
ALTER TABLE bookings
  ADD COLUMN cleaning_fee NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN security_deposit NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN extra_guest_fee NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN guest_count INTEGER NOT NULL DEFAULT 1;

-- Generic per-room fees configured by admin (label + amount + booking type)
CREATE TABLE room_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  booking_type TEXT NOT NULL CHECK (booking_type IN ('short_term', 'long_term', 'both')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Immutable snapshot of generic fees applied to a booking
CREATE TABLE booking_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
