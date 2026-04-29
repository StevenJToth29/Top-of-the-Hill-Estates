-- supabase/migrations/040_task_automations.sql
CREATE TABLE task_automations (
  id            uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type    text    NOT NULL CHECK (scope_type IN ('global', 'property', 'room')),
  room_id       uuid    REFERENCES rooms(id) ON DELETE CASCADE,
  property_id   uuid    REFERENCES properties(id) ON DELETE CASCADE,
  trigger_event text    NOT NULL CHECK (trigger_event IN (
                  'booking_confirmed', 'checkin_day', 'checkout', 'booking_cancelled'
                )),
  title         text    NOT NULL,
  description   text,
  day_offset    integer NOT NULL DEFAULT 0,
  color         text,
  assignee_id   uuid    REFERENCES people(id) ON DELETE SET NULL,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_scope_global
    CHECK (scope_type != 'global' OR (room_id IS NULL AND property_id IS NULL)),
  CONSTRAINT chk_scope_property
    CHECK (scope_type != 'property' OR (property_id IS NOT NULL AND room_id IS NULL)),
  CONSTRAINT chk_scope_room
    CHECK (scope_type != 'room' OR (room_id IS NOT NULL AND property_id IS NULL))
);

CREATE INDEX idx_task_automations_lookup
  ON task_automations (scope_type, trigger_event, room_id, property_id)
  WHERE is_active = true;

ALTER TABLE task_automations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on task_automations"
  ON task_automations USING (auth.role() = 'service_role');

CREATE TRIGGER update_task_automations_updated_at
  BEFORE UPDATE ON task_automations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Extend calendar_tasks
ALTER TABLE calendar_tasks
  ADD COLUMN IF NOT EXISTS assignee_id           uuid REFERENCES people(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_booking_id     uuid REFERENCES bookings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_ical_block_id  uuid REFERENCES ical_blocks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS automation_id         uuid REFERENCES task_automations(id) ON DELETE SET NULL;
