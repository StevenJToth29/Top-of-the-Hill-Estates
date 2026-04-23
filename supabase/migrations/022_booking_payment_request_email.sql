-- Seed default booking_payment_request email automation
-- This automation fires when an edit increases the booking total and a Stripe
-- payment request link is generated for the guest.

-- Add the new trigger event value to the ENUM (safe to re-run)
ALTER TYPE email_trigger_event ADD VALUE IF NOT EXISTS 'booking_payment_request';

-- First, create a placeholder email template for the payment request
INSERT INTO email_templates (id, name, subject, body, design, is_active, created_at, updated_at)
SELECT
  gen_random_uuid(),
  'Payment Request — Additional Amount Due',
  'Payment Request — Additional Amount Due for Your Booking',
  '<p>Hi {{guest_first_name}},</p>
<p>Your booking at {{room_name}} ({{property_name}}) has been updated and an additional payment of <strong>{{payment_amount}}</strong> is now due.</p>
<p><a href="{{payment_link}}" style="background:#2DD4BF;color:#0F172A;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block;margin:16px 0">Pay {{payment_amount}} Now</a></p>
<p>If you have any questions, please contact us.</p>',
  NULL,
  true,
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM email_templates WHERE name = 'Payment Request — Additional Amount Due'
);

-- Create the automation that uses this template
INSERT INTO email_automations (
  id,
  name,
  trigger_event,
  is_active,
  delay_minutes,
  conditions,
  template_id,
  recipient_type,
  is_pre_planned,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  'Payment Request — Additional Amount Due',
  'booking_payment_request',
  true,
  0,
  '{"operator":"AND","rules":[]}'::jsonb,
  t.id,
  'guest',
  true,
  now(),
  now()
FROM email_templates t
WHERE t.name = 'Payment Request — Additional Amount Due'
ON CONFLICT DO NOTHING;
