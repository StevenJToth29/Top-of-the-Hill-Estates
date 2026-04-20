-- Email settings (single row)
CREATE TABLE email_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_name text NOT NULL DEFAULT 'Top of the Hill Estates',
  from_email text NOT NULL DEFAULT '',
  admin_recipients text[] NOT NULL DEFAULT '{}',
  review_url text NOT NULL DEFAULT ''
);

-- Seed one row immediately
INSERT INTO email_settings DEFAULT VALUES;

-- Trigger event enum
CREATE TYPE email_trigger_event AS ENUM (
  'booking_confirmed',
  'booking_pending',
  'booking_cancelled',
  'contact_submitted',
  'checkin_reminder',
  'checkout_reminder',
  'post_checkout',
  'review_request',
  'modification_requested',
  'admin_new_booking',
  'admin_cancelled'
);

-- Email templates
CREATE TABLE email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subject text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON email_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Email automations
CREATE TABLE email_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  trigger_event email_trigger_event NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  delay_minutes integer NOT NULL DEFAULT 0,
  conditions jsonb NOT NULL DEFAULT '{"operator":"AND","rules":[]}',
  template_id uuid REFERENCES email_templates(id) ON DELETE SET NULL,
  recipient_type text NOT NULL DEFAULT 'guest'
    CHECK (recipient_type IN ('guest', 'admin', 'both')),
  is_pre_planned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER update_email_automations_updated_at
  BEFORE UPDATE ON email_automations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Email queue
CREATE TABLE email_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid REFERENCES email_automations(id) ON DELETE SET NULL,
  template_id uuid REFERENCES email_templates(id) ON DELETE SET NULL,
  booking_id uuid REFERENCES bookings(id) ON DELETE CASCADE,
  recipient_email text NOT NULL,
  recipient_type text NOT NULL DEFAULT 'guest',
  send_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  resolved_variables jsonb NOT NULL DEFAULT '{}',
  attempts integer NOT NULL DEFAULT 0,
  error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for efficient queue processor queries
CREATE INDEX email_queue_pending_idx ON email_queue (send_at)
  WHERE status = 'pending';

-- Seed the 11 pre-planned automations (all inactive until admin configures them)
INSERT INTO email_automations (name, trigger_event, is_active, delay_minutes, recipient_type, is_pre_planned)
VALUES
  ('Booking Pending',            'booking_pending',        false,     0, 'guest', true),
  ('Booking Confirmed',          'booking_confirmed',       false,     0, 'guest', true),
  ('Booking Cancelled',          'booking_cancelled',       false,     0, 'guest', true),
  ('Contact Form Submitted',     'contact_submitted',       false,     0, 'guest', true),
  ('Check-in Reminder',          'checkin_reminder',        false, -2880, 'guest', true),
  ('Check-out Reminder',         'checkout_reminder',       false, -1440, 'guest', true),
  ('Post Checkout',              'post_checkout',           false,  1440, 'guest', true),
  ('Review Request',             'review_request',          false,  2880, 'guest', true),
  ('Modification Requested',     'modification_requested',  false,     0, 'guest', true),
  ('Admin — New Booking',        'admin_new_booking',       false,     0, 'admin', true),
  ('Admin — Booking Cancelled',  'admin_cancelled',         false,     0, 'admin', true);
