-- Reviews table (one review per booking, admin-approved before public display)
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid UNIQUE NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  approved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Seed the Review Request email template and wire it to the pre-planned automation
INSERT INTO email_templates (id, name, subject, body, design, is_active, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'Review Request',
  'How was your stay at {{room_name}}?',
  '<p>Hi {{guest_first_name}},</p>
<p>We hope you enjoyed your recent stay at <strong>{{room_name}}</strong>. Your feedback means the world to us!</p>
<p><a href="{{review_page_url}}" style="background:#2DD4BF;color:#0F172A;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block;margin:16px 0">Leave a Review →</a></p>
<p>Thank you for staying with us.</p>
<p>— {{business_name}}</p>',
  NULL,
  true,
  now(),
  now()
) ON CONFLICT DO NOTHING;

-- Wire the pre-planned Review Request automation to this template and activate it
UPDATE email_automations
SET
  template_id = (SELECT id FROM email_templates WHERE name = 'Review Request' LIMIT 1),
  is_active = true,
  updated_at = now()
WHERE trigger_event = 'review_request'
  AND template_id IS NULL;
