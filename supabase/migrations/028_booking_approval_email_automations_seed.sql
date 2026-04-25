-- Seed email automation trigger records for the booking approval system.
-- Templates can be edited in the email template editor after deployment.
-- Note: enum values were added in 027 and must be committed first.

INSERT INTO email_automations (name, trigger_event, is_active, delay_minutes, recipient_type, conditions)
VALUES
  ('Application Needed',          'application_needed',          true,    0,    'guest', '{"operator":"AND","rules":[]}'),
  ('Application Reminder 24h',    'application_reminder_24h',    true, 1440,    'guest', '{"operator":"AND","rules":[]}'),
  ('Application Reminder 12h',    'application_reminder_12h',    true,  720,    'guest', '{"operator":"AND","rules":[]}'),
  ('Application Expired',         'application_expired',         true,    0,    'guest', '{"operator":"AND","rules":[]}'),
  ('Booking Approved',            'booking_approved',            true,    0,    'guest', '{"operator":"AND","rules":[]}'),
  ('Booking Declined',            'booking_declined',            true,    0,    'guest', '{"operator":"AND","rules":[]}'),
  ('Booking Auto-Declined',       'booking_auto_declined',       true,    0,    'guest', '{"operator":"AND","rules":[]}'),
  ('Admin: New Application',      'admin_application_submitted', true,    0,    'admin', '{"operator":"AND","rules":[]}'),
  ('Admin: Application Overdue',  'admin_application_overdue',   true, 1380,    'admin', '{"operator":"AND","rules":[]}'),
  ('Admin: Missed Deadline',      'admin_missed_deadline',       true,    0,    'admin', '{"operator":"AND","rules":[]}')
ON CONFLICT DO NOTHING;
