-- supabase/migrations/015_calendar_tables_rls_and_trigger.sql

-- Enable RLS on date_overrides
ALTER TABLE date_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on date_overrides"
  ON date_overrides USING (auth.role() = 'service_role');

-- Enable RLS on calendar_tasks
ALTER TABLE calendar_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on calendar_tasks"
  ON calendar_tasks USING (auth.role() = 'service_role');

-- Add updated_at auto-update trigger to calendar_tasks
CREATE TRIGGER update_calendar_tasks_updated_at
  BEFORE UPDATE ON calendar_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
