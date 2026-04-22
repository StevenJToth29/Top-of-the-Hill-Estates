-- supabase/migrations/022_ai_prompts.sql
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS ai_prompts TEXT;
