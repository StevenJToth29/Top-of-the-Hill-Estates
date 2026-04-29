-- supabase/migrations/039_people.sql
CREATE TABLE people (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  ical_token  uuid        NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE people ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on people"
  ON people USING (auth.role() = 'service_role');

CREATE TRIGGER update_people_updated_at
  BEFORE UPDATE ON people
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
