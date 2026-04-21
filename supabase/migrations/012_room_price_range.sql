-- supabase/migrations/012_room_price_range.sql
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS price_min numeric;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS price_max numeric;
