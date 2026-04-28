-- Per-room smart pricing settings
ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS smart_pricing_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS smart_pricing_aggressiveness text NOT NULL DEFAULT 'moderate'
    CHECK (smart_pricing_aggressiveness IN ('conservative', 'moderate', 'aggressive'));

-- Per-property Google Trends configuration
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS trends_keyword text,
  ADD COLUMN IF NOT EXISTS trends_geo text;

-- source column distinguishes engine-set vs admin-set overrides
ALTER TABLE date_overrides
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'smart'));

CREATE INDEX IF NOT EXISTS date_overrides_source ON date_overrides (room_id, source);
