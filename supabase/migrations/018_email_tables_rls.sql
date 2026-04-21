-- Enable RLS on email tables so direct anon/authenticated access is blocked.
-- All access goes through API routes using the service role, which bypasses RLS.

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_settings ENABLE ROW LEVEL SECURITY;
