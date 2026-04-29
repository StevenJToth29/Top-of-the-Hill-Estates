-- supabase/migrations/036_task_exceptions.sql

ALTER TABLE calendar_tasks
  ADD COLUMN IF NOT EXISTS series_id uuid REFERENCES calendar_tasks(id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS task_exceptions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id         uuid NOT NULL REFERENCES calendar_tasks(id) ON DELETE CASCADE,
  occurrence_date date NOT NULL,
  is_deleted      boolean NOT NULL DEFAULT false,
  status          text CHECK (status IN ('pending', 'complete')),
  title           text,
  color           text,
  description     text,
  created_at      timestamptz DEFAULT now(),
  UNIQUE(task_id, occurrence_date)
);
