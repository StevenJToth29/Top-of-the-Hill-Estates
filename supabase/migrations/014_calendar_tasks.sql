-- supabase/migrations/014_calendar_tasks.sql
CREATE TABLE IF NOT EXISTS calendar_tasks (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id             uuid        REFERENCES rooms(id) ON DELETE CASCADE,
  title               text        NOT NULL,
  description         text,
  due_date            date        NOT NULL,
  recurrence_rule     text,
  recurrence_end_date date,
  status              text        NOT NULL DEFAULT 'pending'
                                  CHECK (status IN ('pending', 'complete')),
  color               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS calendar_tasks_due_date ON calendar_tasks (due_date);
CREATE INDEX IF NOT EXISTS calendar_tasks_room_id  ON calendar_tasks (room_id);
