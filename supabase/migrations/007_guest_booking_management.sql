-- Add configurable cancellation window to rooms (default 72 hours)
ALTER TABLE rooms
  ADD COLUMN cancellation_window_hours INT NOT NULL DEFAULT 72;

-- Stores guest-requested modification requests pending admin approval
CREATE TABLE booking_modification_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  requested_check_in DATE NOT NULL,
  requested_check_out DATE NOT NULL,
  requested_guest_count INT NOT NULL,
  requested_total_nights INT NOT NULL,
  price_delta NUMERIC NOT NULL,  -- positive = guest owes more, negative = refund owed
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_modification_requests_updated_at
  BEFORE UPDATE ON booking_modification_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE booking_modification_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on modification requests"
  ON booking_modification_requests
  USING (auth.role() = 'service_role');
