-- Add global house rules to site settings
ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS global_house_rules TEXT DEFAULT '';

-- Add per-property flag: use global rules or custom ones
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS use_global_house_rules BOOLEAN DEFAULT true;
