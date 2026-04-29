-- Part 2: Seed email template and automation for abandoned booking recovery
INSERT INTO email_templates (id, name, subject, body, design, is_active, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'Abandoned Booking Recovery',
  'You left something behind at {{business_name}}',
  '<p>Hi {{guest_first_name}},</p>
<p>Looks like you didn''t complete your booking for <strong>{{room_name}}</strong> on {{check_in_date}}. The room may still be available — come back and finish when you''re ready.</p>
<p><a href="{{room_url}}" style="background:#2DD4BF;color:#0F172A;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block;margin:16px 0">Book Now →</a></p>
<p>— {{business_name}}</p>',
  NULL,
  true,
  now(),
  now()
) ON CONFLICT DO NOTHING;

INSERT INTO email_automations (
  id, name, trigger_event, is_active, delay_minutes,
  conditions, template_id, recipient_type, is_pre_planned,
  created_at, updated_at
)
SELECT
  gen_random_uuid(),
  'Abandoned Booking Recovery',
  'booking_abandoned',
  true,
  0,
  '{"operator":"AND","rules":[]}'::jsonb,
  id,
  'guest',
  true,
  now(),
  now()
FROM email_templates
WHERE name = 'Abandoned Booking Recovery'
ON CONFLICT DO NOTHING;
