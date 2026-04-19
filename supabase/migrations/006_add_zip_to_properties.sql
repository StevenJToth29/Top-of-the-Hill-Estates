-- supabase/migrations/006_add_zip_to_properties.sql

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS zip TEXT NOT NULL DEFAULT '';
