-- Add 'pending_payment' status for the initial booking state (name entered, no card yet).
-- Dates are NOT blocked for this status — they only become blocked once the card is submitted
-- and the booking transitions to 'pending_docs' via the /confirm endpoint.

ALTER TABLE bookings
  DROP CONSTRAINT IF EXISTS bookings_status_check,
  ADD CONSTRAINT bookings_status_check
    CHECK (status IN ('pending_payment', 'pending', 'pending_docs', 'under_review', 'confirmed', 'cancelled', 'completed', 'expired'));
