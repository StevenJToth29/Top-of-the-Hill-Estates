-- Add new trigger event values to the email_trigger_event ENUM for the booking approval system.
-- Must run in its own transaction before the INSERT in 028 can reference these values.
ALTER TYPE email_trigger_event ADD VALUE IF NOT EXISTS 'application_needed';
ALTER TYPE email_trigger_event ADD VALUE IF NOT EXISTS 'application_reminder_24h';
ALTER TYPE email_trigger_event ADD VALUE IF NOT EXISTS 'application_reminder_12h';
ALTER TYPE email_trigger_event ADD VALUE IF NOT EXISTS 'application_expired';
ALTER TYPE email_trigger_event ADD VALUE IF NOT EXISTS 'booking_approved';
ALTER TYPE email_trigger_event ADD VALUE IF NOT EXISTS 'booking_declined';
ALTER TYPE email_trigger_event ADD VALUE IF NOT EXISTS 'booking_auto_declined';
ALTER TYPE email_trigger_event ADD VALUE IF NOT EXISTS 'admin_application_submitted';
ALTER TYPE email_trigger_event ADD VALUE IF NOT EXISTS 'admin_application_overdue';
ALTER TYPE email_trigger_event ADD VALUE IF NOT EXISTS 'admin_missed_deadline';
