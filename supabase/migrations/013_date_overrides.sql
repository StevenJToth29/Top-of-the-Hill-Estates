-- supabase/migrations/013_date_overrides.sql
CREATE TABLE IF NOT EXISTS date_overrides (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id        uuid        NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  date           date        NOT NULL,
  price_override numeric,
  is_blocked     boolean     NOT NULL DEFAULT false,
  block_reason   text,
  note           text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, date)
);

CREATE INDEX IF NOT EXISTS date_overrides_room_date ON date_overrides (room_id, date);
