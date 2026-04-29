-- Enable RLS on reviews so the anon key can only read approved reviews
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Anon (public homepage) can only see approved reviews
CREATE POLICY "anon_read_approved_reviews" ON reviews
  FOR SELECT TO anon
  USING (approved = true);

-- Authenticated users (admin) get full access via service role (bypasses RLS)
-- No additional policy needed; service_role always bypasses RLS in Supabase.
