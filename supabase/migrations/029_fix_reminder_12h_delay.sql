-- Fix application_reminder_12h delay from incorrect 2160 (36h) to correct 720 (12h)
UPDATE email_automations
SET delay_minutes = 720
WHERE trigger_event = 'application_reminder_12h'
  AND delay_minutes = 2160;
