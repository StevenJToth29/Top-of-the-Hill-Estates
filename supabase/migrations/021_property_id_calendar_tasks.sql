ALTER TABLE calendar_tasks
  ADD COLUMN IF NOT EXISTS property_id uuid REFERENCES properties(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_calendar_tasks_property_id ON calendar_tasks(property_id);
