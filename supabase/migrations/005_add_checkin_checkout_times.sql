-- supabase/migrations/005_add_checkin_checkout_times.sql

ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS checkin_time  TEXT DEFAULT '15:00',
  ADD COLUMN IF NOT EXISTS checkout_time TEXT DEFAULT '10:00';
