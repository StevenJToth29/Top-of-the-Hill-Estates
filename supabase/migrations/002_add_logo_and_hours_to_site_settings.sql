-- Add logo_url and business_hours columns to site_settings
ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS logo_url TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS business_hours TEXT DEFAULT '';
