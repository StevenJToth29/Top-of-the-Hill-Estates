-- supabase/migrations/009_cancellation_policy.sql

-- System-level default policy (stored as JSONB in site_settings)
ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS cancellation_policy JSONB;

-- Property-level: own policy + whether to inherit from system
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS cancellation_policy JSONB,
  ADD COLUMN IF NOT EXISTS use_global_cancellation_policy BOOLEAN NOT NULL DEFAULT true;

-- Room-level: own policy + whether to inherit from property chain
ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS cancellation_policy JSONB,
  ADD COLUMN IF NOT EXISTS use_property_cancellation_policy BOOLEAN NOT NULL DEFAULT true;
