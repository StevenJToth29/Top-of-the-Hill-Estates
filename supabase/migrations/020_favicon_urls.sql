-- Add favicon URL columns to site_settings
ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS favicon_url       text,
  ADD COLUMN IF NOT EXISTS favicon_large_url text,
  ADD COLUMN IF NOT EXISTS favicon_apple_url text;
