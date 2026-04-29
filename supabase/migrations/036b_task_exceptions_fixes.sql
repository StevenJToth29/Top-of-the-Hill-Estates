-- supabase/migrations/036b_task_exceptions_fixes.sql

-- RLS
ALTER TABLE task_exceptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on task_exceptions"
  ON task_exceptions USING (auth.role() = 'service_role');

-- updated_at column and trigger
ALTER TABLE task_exceptions
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE TRIGGER update_task_exceptions_updated_at
  BEFORE UPDATE ON task_exceptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Range-scan index on occurrence_date
CREATE INDEX IF NOT EXISTS idx_task_exceptions_occurrence_date
  ON task_exceptions (occurrence_date);
