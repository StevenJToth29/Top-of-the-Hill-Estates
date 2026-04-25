-- supabase/migrations/026_booking_approval_system.sql

-- 1. Note: bookings.status is a plain text column (no enum type exists).
-- The values 'pending_docs' and 'under_review' are valid text values and
-- need no schema change — they can be written directly to the status column.

-- 2. Add application_deadline column to bookings
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS application_deadline timestamptz;

-- 3. booking_applications table
CREATE TABLE IF NOT EXISTS booking_applications (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id            uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  purpose_of_stay       text NOT NULL DEFAULT '',
  traveling_from        text NOT NULL DEFAULT '',
  shared_living_exp     text NOT NULL DEFAULT '',
  house_rules_confirmed boolean NOT NULL DEFAULT false,
  additional_info       text,
  decision              text CHECK (decision IN ('approved', 'declined')),
  decline_reason        text,
  submitted_at          timestamptz,
  reviewed_at           timestamptz,
  reviewed_by           uuid REFERENCES auth.users(id),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS booking_applications_booking_id_key
  ON booking_applications(booking_id);

CREATE TRIGGER update_booking_applications_updated_at
  BEFORE UPDATE ON booking_applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4. guest_id_documents table
CREATE TABLE IF NOT EXISTS guest_id_documents (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id       uuid NOT NULL REFERENCES booking_applications(id) ON DELETE CASCADE,
  booking_id           uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  guest_index          int NOT NULL,
  guest_name           text NOT NULL DEFAULT '',
  current_address      text NOT NULL DEFAULT '',
  id_photo_url         text,
  ai_quality_result    text CHECK (ai_quality_result IN ('pass', 'fail_blurry', 'fail_partial')),
  ai_authenticity_flag text CHECK (ai_authenticity_flag IN ('clear', 'flagged', 'uncertain')),
  ai_validation_notes  text,
  ai_validated_at      timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS guest_id_documents_application_guest_key
  ON guest_id_documents(application_id, guest_index);

CREATE INDEX IF NOT EXISTS guest_id_documents_booking_id_idx
  ON guest_id_documents(booking_id);

-- 5. RLS policies
ALTER TABLE booking_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_id_documents ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS — public access is intentionally blocked
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'booking_applications'
      AND policyname = 'Service role only'
  ) THEN
    CREATE POLICY "Service role only" ON booking_applications USING (false);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'guest_id_documents'
      AND policyname = 'Service role only'
  ) THEN
    CREATE POLICY "Service role only" ON guest_id_documents USING (false);
  END IF;
END $$;

-- 6. Supabase Storage bucket for ID photos (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'id-documents',
  'id-documents',
  false,
  10485760, -- 10 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;
