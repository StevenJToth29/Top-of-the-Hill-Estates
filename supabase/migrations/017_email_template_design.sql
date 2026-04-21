ALTER TABLE email_templates
  ADD COLUMN IF NOT EXISTS design jsonb;
