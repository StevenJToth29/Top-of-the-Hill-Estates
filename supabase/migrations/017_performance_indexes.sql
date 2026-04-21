CREATE INDEX IF NOT EXISTS idx_bookings_room_status ON bookings(room_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_status_created_at ON bookings(status, created_at);
CREATE INDEX IF NOT EXISTS idx_bookings_stripe_pi ON bookings(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_ical_blocks_room_id ON ical_blocks(room_id);
CREATE INDEX IF NOT EXISTS idx_ical_sources_room_active ON ical_sources(room_id, is_active);
