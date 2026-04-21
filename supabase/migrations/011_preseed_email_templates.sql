-- Seeds default email templates for each pre-planned automation and links them.

DO $$
DECLARE tid uuid;
BEGIN

--------------------------------------------------------------------
-- 1. Booking Pending
--------------------------------------------------------------------
INSERT INTO email_templates (name, subject, body, is_active) VALUES (
  'Booking Pending',
  'Your booking request for {{room_name}} is pending',
  $t1$
<div style="font-family:Arial,Helvetica,sans-serif;background:#f1f5f9;padding:40px 20px;margin:0;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
    <div style="background:#0d9488;padding:28px 40px;">
      <p style="color:#ffffff;margin:0;font-size:20px;font-weight:700;">{{business_name}}</p>
    </div>
    <div style="padding:36px 40px;color:#1e293b;font-size:15px;line-height:1.7;">
      <p style="margin:0 0 16px;">Hi {{guest_first_name}},</p>
      <p style="margin:0 0 16px;">Thank you for your booking request! We have received it and will confirm your reservation shortly.</p>
      <div style="background:#f0fdfa;border-left:4px solid #0d9488;padding:16px 20px;border-radius:4px;margin:24px 0;">
        <p style="margin:0 0 8px;font-weight:600;color:#0d9488;">Booking Summary</p>
        <p style="margin:0 0 6px;"><strong>Room:</strong> {{room_name}}</p>
        <p style="margin:0 0 6px;"><strong>Check-in:</strong> {{check_in_date}}</p>
        <p style="margin:0 0 6px;"><strong>Check-out:</strong> {{check_out_date}}</p>
        <p style="margin:0 0 6px;"><strong>Nights:</strong> {{total_nights}}</p>
        <p style="margin:0;"><strong>Total:</strong> {{total_amount}}</p>
      </div>
      <p style="margin:0 0 16px;">If you have any questions in the meantime, feel free to reach out.</p>
      <p style="margin:0;">Warm regards,<br><strong>{{business_name}}</strong></p>
    </div>
    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 40px;text-align:center;font-size:13px;color:#64748b;">
      <p style="margin:0;">{{business_name}} &nbsp;&middot;&nbsp; {{contact_phone}} &nbsp;&middot;&nbsp; {{contact_email}}</p>
    </div>
  </div>
</div>
  $t1$,
  true
) RETURNING id INTO tid;
UPDATE email_automations SET template_id = tid
  WHERE name = 'Booking Pending' AND is_pre_planned = true;

--------------------------------------------------------------------
-- 2. Booking Confirmed
--------------------------------------------------------------------
INSERT INTO email_templates (name, subject, body, is_active) VALUES (
  'Booking Confirmed',
  'Your booking at {{room_name}} is confirmed!',
  $t2$
<div style="font-family:Arial,Helvetica,sans-serif;background:#f1f5f9;padding:40px 20px;margin:0;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
    <div style="background:#0d9488;padding:28px 40px;">
      <p style="color:#ffffff;margin:0;font-size:20px;font-weight:700;">{{business_name}}</p>
    </div>
    <div style="padding:36px 40px;color:#1e293b;font-size:15px;line-height:1.7;">
      <p style="margin:0 0 16px;">Hi {{guest_first_name}},</p>
      <p style="margin:0 0 16px;">Great news — your booking is confirmed! We look forward to welcoming you.</p>
      <div style="background:#f0fdfa;border-left:4px solid #0d9488;padding:16px 20px;border-radius:4px;margin:24px 0;">
        <p style="margin:0 0 8px;font-weight:600;color:#0d9488;">Your Booking Details</p>
        <p style="margin:0 0 6px;"><strong>Room:</strong> {{room_name}}</p>
        <p style="margin:0 0 6px;"><strong>Check-in:</strong> {{check_in_date}} at {{checkin_time}}</p>
        <p style="margin:0 0 6px;"><strong>Check-out:</strong> {{check_out_date}} at {{checkout_time}}</p>
        <p style="margin:0 0 6px;"><strong>Nights:</strong> {{total_nights}}</p>
        <p style="margin:0 0 6px;"><strong>Total:</strong> {{total_amount}}</p>
        <p style="margin:0;"><strong>Address:</strong> {{property_address}}</p>
      </div>
      <p style="margin:0 0 16px;">If you need anything before your stay, do not hesitate to contact us.</p>
      <p style="margin:0;">We will see you soon,<br><strong>{{business_name}}</strong></p>
    </div>
    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 40px;text-align:center;font-size:13px;color:#64748b;">
      <p style="margin:0;">{{business_name}} &nbsp;&middot;&nbsp; {{contact_phone}} &nbsp;&middot;&nbsp; {{contact_email}}</p>
    </div>
  </div>
</div>
  $t2$,
  true
) RETURNING id INTO tid;
UPDATE email_automations SET template_id = tid
  WHERE name = 'Booking Confirmed' AND is_pre_planned = true;

--------------------------------------------------------------------
-- 3. Booking Cancelled
--------------------------------------------------------------------
INSERT INTO email_templates (name, subject, body, is_active) VALUES (
  'Booking Cancelled',
  'Your booking at {{room_name}} has been cancelled',
  $t3$
<div style="font-family:Arial,Helvetica,sans-serif;background:#f1f5f9;padding:40px 20px;margin:0;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
    <div style="background:#0d9488;padding:28px 40px;">
      <p style="color:#ffffff;margin:0;font-size:20px;font-weight:700;">{{business_name}}</p>
    </div>
    <div style="padding:36px 40px;color:#1e293b;font-size:15px;line-height:1.7;">
      <p style="margin:0 0 16px;">Hi {{guest_first_name}},</p>
      <p style="margin:0 0 16px;">We are writing to confirm that your booking has been cancelled.</p>
      <div style="background:#fef2f2;border-left:4px solid #ef4444;padding:16px 20px;border-radius:4px;margin:24px 0;">
        <p style="margin:0 0 8px;font-weight:600;color:#dc2626;">Cancelled Booking</p>
        <p style="margin:0 0 6px;"><strong>Room:</strong> {{room_name}}</p>
        <p style="margin:0 0 6px;"><strong>Check-in:</strong> {{check_in_date}}</p>
        <p style="margin:0;"><strong>Check-out:</strong> {{check_out_date}}</p>
      </div>
      <p style="margin:0 0 16px;">If a refund is due based on our cancellation policy, it will be processed within 5&#8211;10 business days.</p>
      <p style="margin:0 0 16px;">We hope to have the opportunity to host you in the future. If you have any questions, please reach out.</p>
      <p style="margin:0;">Sincerely,<br><strong>{{business_name}}</strong></p>
    </div>
    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 40px;text-align:center;font-size:13px;color:#64748b;">
      <p style="margin:0;">{{business_name}} &nbsp;&middot;&nbsp; {{contact_phone}} &nbsp;&middot;&nbsp; {{contact_email}}</p>
    </div>
  </div>
</div>
  $t3$,
  true
) RETURNING id INTO tid;
UPDATE email_automations SET template_id = tid
  WHERE name = 'Booking Cancelled' AND is_pre_planned = true;

--------------------------------------------------------------------
-- 4. Contact Form Submitted
--------------------------------------------------------------------
INSERT INTO email_templates (name, subject, body, is_active) VALUES (
  'Contact Form Submitted',
  'Thanks for reaching out — we received your message',
  $t4$
<div style="font-family:Arial,Helvetica,sans-serif;background:#f1f5f9;padding:40px 20px;margin:0;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
    <div style="background:#0d9488;padding:28px 40px;">
      <p style="color:#ffffff;margin:0;font-size:20px;font-weight:700;">{{business_name}}</p>
    </div>
    <div style="padding:36px 40px;color:#1e293b;font-size:15px;line-height:1.7;">
      <p style="margin:0 0 16px;">Hi {{contact_name}},</p>
      <p style="margin:0 0 16px;">Thank you for reaching out to {{business_name}}! We have received your message and will get back to you as soon as possible.</p>
      <div style="background:#f0fdfa;border-left:4px solid #0d9488;padding:16px 20px;border-radius:4px;margin:24px 0;">
        <p style="margin:0 0 8px;font-weight:600;color:#0d9488;">Your Message</p>
        <p style="margin:0;white-space:pre-line;">{{contact_message}}</p>
      </div>
      <p style="margin:0 0 8px;">In the meantime, feel free to contact us directly:</p>
      <p style="margin:0 0 4px;"><strong>Phone:</strong> {{business_phone}}</p>
      <p style="margin:0 0 24px;"><strong>Email:</strong> {{business_email}}</p>
      <p style="margin:0;">Talk soon,<br><strong>{{business_name}}</strong></p>
    </div>
    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 40px;text-align:center;font-size:13px;color:#64748b;">
      <p style="margin:0;">{{business_name}} &nbsp;&middot;&nbsp; {{business_phone}} &nbsp;&middot;&nbsp; {{business_email}}</p>
    </div>
  </div>
</div>
  $t4$,
  true
) RETURNING id INTO tid;
UPDATE email_automations SET template_id = tid
  WHERE name = 'Contact Form Submitted' AND is_pre_planned = true;

--------------------------------------------------------------------
-- 5. Check-in Reminder
--------------------------------------------------------------------
INSERT INTO email_templates (name, subject, body, is_active) VALUES (
  'Check-in Reminder',
  'Your check-in at {{room_name}} is coming up!',
  $t5$
<div style="font-family:Arial,Helvetica,sans-serif;background:#f1f5f9;padding:40px 20px;margin:0;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
    <div style="background:#0d9488;padding:28px 40px;">
      <p style="color:#ffffff;margin:0;font-size:20px;font-weight:700;">{{business_name}}</p>
    </div>
    <div style="padding:36px 40px;color:#1e293b;font-size:15px;line-height:1.7;">
      <p style="margin:0 0 16px;">Hi {{guest_first_name}},</p>
      <p style="margin:0 0 16px;">Your stay at <strong>{{room_name}}</strong> is just around the corner! Here is everything you need to know before you arrive.</p>
      <div style="background:#f0fdfa;border-left:4px solid #0d9488;padding:16px 20px;border-radius:4px;margin:24px 0;">
        <p style="margin:0 0 8px;font-weight:600;color:#0d9488;">Check-in Details</p>
        <p style="margin:0 0 6px;"><strong>Check-in:</strong> {{check_in_date}} at {{checkin_time}}</p>
        <p style="margin:0 0 6px;"><strong>Check-out:</strong> {{check_out_date}} at {{checkout_time}}</p>
        <p style="margin:0;"><strong>Address:</strong> {{property_address}}</p>
      </div>
      <p style="margin:0 0 8px;font-weight:600;">House Rules</p>
      <p style="margin:0 0 24px;white-space:pre-line;">{{house_rules}}</p>
      <p style="margin:0 0 16px;">If you have any questions before you arrive, give us a call.</p>
      <p style="margin:0;">See you soon,<br><strong>{{business_name}}</strong></p>
    </div>
    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 40px;text-align:center;font-size:13px;color:#64748b;">
      <p style="margin:0;">{{business_name}} &nbsp;&middot;&nbsp; {{contact_phone}} &nbsp;&middot;&nbsp; {{contact_email}}</p>
    </div>
  </div>
</div>
  $t5$,
  true
) RETURNING id INTO tid;
UPDATE email_automations SET template_id = tid
  WHERE name = 'Check-in Reminder' AND is_pre_planned = true;

--------------------------------------------------------------------
-- 6. Check-out Reminder
--------------------------------------------------------------------
INSERT INTO email_templates (name, subject, body, is_active) VALUES (
  'Check-out Reminder',
  'Check-out reminder for {{room_name}} — tomorrow',
  $t6$
<div style="font-family:Arial,Helvetica,sans-serif;background:#f1f5f9;padding:40px 20px;margin:0;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
    <div style="background:#0d9488;padding:28px 40px;">
      <p style="color:#ffffff;margin:0;font-size:20px;font-weight:700;">{{business_name}}</p>
    </div>
    <div style="padding:36px 40px;color:#1e293b;font-size:15px;line-height:1.7;">
      <p style="margin:0 0 16px;">Hi {{guest_first_name}},</p>
      <p style="margin:0 0 16px;">Just a friendly reminder that your check-out from <strong>{{room_name}}</strong> is tomorrow.</p>
      <div style="background:#f0fdfa;border-left:4px solid #0d9488;padding:16px 20px;border-radius:4px;margin:24px 0;">
        <p style="margin:0 0 8px;font-weight:600;color:#0d9488;">Check-out Details</p>
        <p style="margin:0;"><strong>Check-out:</strong> {{check_out_date}} by {{checkout_time}}</p>
      </div>
      <p style="margin:0 0 16px;">Please ensure the room is left in good order and return any keys before departing. If you need a late check-out, reach out and we will do our best to accommodate.</p>
      <p style="margin:0;">It has been a pleasure having you,<br><strong>{{business_name}}</strong></p>
    </div>
    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 40px;text-align:center;font-size:13px;color:#64748b;">
      <p style="margin:0;">{{business_name}} &nbsp;&middot;&nbsp; {{contact_phone}} &nbsp;&middot;&nbsp; {{contact_email}}</p>
    </div>
  </div>
</div>
  $t6$,
  true
) RETURNING id INTO tid;
UPDATE email_automations SET template_id = tid
  WHERE name = 'Check-out Reminder' AND is_pre_planned = true;

--------------------------------------------------------------------
-- 7. Post Checkout
--------------------------------------------------------------------
INSERT INTO email_templates (name, subject, body, is_active) VALUES (
  'Post Checkout',
  'Thank you for staying at {{room_name}}!',
  $t7$
<div style="font-family:Arial,Helvetica,sans-serif;background:#f1f5f9;padding:40px 20px;margin:0;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
    <div style="background:#0d9488;padding:28px 40px;">
      <p style="color:#ffffff;margin:0;font-size:20px;font-weight:700;">{{business_name}}</p>
    </div>
    <div style="padding:36px 40px;color:#1e293b;font-size:15px;line-height:1.7;">
      <p style="margin:0 0 16px;">Hi {{guest_first_name}},</p>
      <p style="margin:0 0 16px;">We hope you had a wonderful stay at <strong>{{room_name}}</strong>! It was truly a pleasure hosting you.</p>
      <p style="margin:0 0 16px;">We would love to have you back anytime. If there is anything we can do to make your next visit even better, please do not hesitate to let us know.</p>
      <p style="margin:0;">Until next time,<br><strong>{{business_name}}</strong></p>
    </div>
    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 40px;text-align:center;font-size:13px;color:#64748b;">
      <p style="margin:0;">{{business_name}} &nbsp;&middot;&nbsp; {{contact_phone}} &nbsp;&middot;&nbsp; {{contact_email}}</p>
    </div>
  </div>
</div>
  $t7$,
  true
) RETURNING id INTO tid;
UPDATE email_automations SET template_id = tid
  WHERE name = 'Post Checkout' AND is_pre_planned = true;

--------------------------------------------------------------------
-- 8. Review Request
--------------------------------------------------------------------
INSERT INTO email_templates (name, subject, body, is_active) VALUES (
  'Review Request',
  'How was your stay at {{room_name}}?',
  $t8$
<div style="font-family:Arial,Helvetica,sans-serif;background:#f1f5f9;padding:40px 20px;margin:0;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
    <div style="background:#0d9488;padding:28px 40px;">
      <p style="color:#ffffff;margin:0;font-size:20px;font-weight:700;">{{business_name}}</p>
    </div>
    <div style="padding:36px 40px;color:#1e293b;font-size:15px;line-height:1.7;">
      <p style="margin:0 0 16px;">Hi {{guest_first_name}},</p>
      <p style="margin:0 0 16px;">We hope you are settling back in after your stay at <strong>{{room_name}}</strong>. We would be so grateful if you could take a moment to share your experience!</p>
      <p style="margin:0 0 24px;">Your review helps future guests make informed decisions and supports our small business — it means the world to us.</p>
      <div style="text-align:center;margin:32px 0;">
        <a href="{{review_url}}" style="display:inline-block;background:#0d9488;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px;">Leave a Review</a>
      </div>
      <p style="margin:0;">With gratitude,<br><strong>{{business_name}}</strong></p>
    </div>
    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 40px;text-align:center;font-size:13px;color:#64748b;">
      <p style="margin:0;">{{business_name}} &nbsp;&middot;&nbsp; {{contact_phone}} &nbsp;&middot;&nbsp; {{contact_email}}</p>
    </div>
  </div>
</div>
  $t8$,
  true
) RETURNING id INTO tid;
UPDATE email_automations SET template_id = tid
  WHERE name = 'Review Request' AND is_pre_planned = true;

--------------------------------------------------------------------
-- 9. Modification Requested
--------------------------------------------------------------------
INSERT INTO email_templates (name, subject, body, is_active) VALUES (
  'Modification Requested',
  'Your modification request has been received',
  $t9$
<div style="font-family:Arial,Helvetica,sans-serif;background:#f1f5f9;padding:40px 20px;margin:0;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
    <div style="background:#0d9488;padding:28px 40px;">
      <p style="color:#ffffff;margin:0;font-size:20px;font-weight:700;">{{business_name}}</p>
    </div>
    <div style="padding:36px 40px;color:#1e293b;font-size:15px;line-height:1.7;">
      <p style="margin:0 0 16px;">Hi {{guest_first_name}},</p>
      <p style="margin:0 0 16px;">We have received your request to modify your booking for <strong>{{room_name}}</strong>. Our team will review it and get back to you shortly.</p>
      <p style="margin:0 0 16px;">If you need to make any changes or have questions in the meantime, please do not hesitate to contact us.</p>
      <p style="margin:0;">Warm regards,<br><strong>{{business_name}}</strong></p>
    </div>
    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 40px;text-align:center;font-size:13px;color:#64748b;">
      <p style="margin:0;">{{business_name}} &nbsp;&middot;&nbsp; {{contact_phone}} &nbsp;&middot;&nbsp; {{contact_email}}</p>
    </div>
  </div>
</div>
  $t9$,
  true
) RETURNING id INTO tid;
UPDATE email_automations SET template_id = tid
  WHERE name = 'Modification Requested' AND is_pre_planned = true;

--------------------------------------------------------------------
-- 10. Admin — New Booking
--------------------------------------------------------------------
INSERT INTO email_templates (name, subject, body, is_active) VALUES (
  'Admin — New Booking',
  'New booking: {{guest_first_name}} {{guest_last_name}} — {{room_name}}',
  $t10$
<div style="font-family:Arial,Helvetica,sans-serif;background:#f1f5f9;padding:40px 20px;margin:0;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
    <div style="background:#1e293b;padding:28px 40px;">
      <p style="color:#ffffff;margin:0;font-size:20px;font-weight:700;">New Booking Received</p>
      <p style="color:#94a3b8;margin:4px 0 0;font-size:13px;">{{business_name}} Admin Notification</p>
    </div>
    <div style="padding:36px 40px;color:#1e293b;font-size:15px;line-height:1.7;">
      <div style="background:#f0fdfa;border-left:4px solid #0d9488;padding:16px 20px;border-radius:4px;margin:0 0 24px;">
        <p style="margin:0 0 8px;font-weight:600;color:#0d9488;">Guest Information</p>
        <p style="margin:0 0 6px;"><strong>Name:</strong> {{guest_first_name}} {{guest_last_name}}</p>
        <p style="margin:0 0 6px;"><strong>Email:</strong> {{guest_email}}</p>
        <p style="margin:0;"><strong>Phone:</strong> {{guest_phone}}</p>
      </div>
      <div style="background:#f8fafc;border-left:4px solid #64748b;padding:16px 20px;border-radius:4px;margin:0 0 24px;">
        <p style="margin:0 0 8px;font-weight:600;color:#374151;">Booking Details</p>
        <p style="margin:0 0 6px;"><strong>Room:</strong> {{room_name}}</p>
        <p style="margin:0 0 6px;"><strong>Type:</strong> {{booking_type}}</p>
        <p style="margin:0 0 6px;"><strong>Check-in:</strong> {{check_in_date}}</p>
        <p style="margin:0 0 6px;"><strong>Check-out:</strong> {{check_out_date}}</p>
        <p style="margin:0 0 6px;"><strong>Nights:</strong> {{total_nights}}</p>
        <p style="margin:0;"><strong>Total:</strong> {{total_amount}}</p>
      </div>
    </div>
    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 40px;text-align:center;font-size:13px;color:#64748b;">
      <p style="margin:0;">{{business_name}} &nbsp;&middot;&nbsp; Admin Notification</p>
    </div>
  </div>
</div>
  $t10$,
  true
) RETURNING id INTO tid;
UPDATE email_automations SET template_id = tid
  WHERE name = 'Admin — New Booking' AND is_pre_planned = true;

--------------------------------------------------------------------
-- 11. Admin — Booking Cancelled
--------------------------------------------------------------------
INSERT INTO email_templates (name, subject, body, is_active) VALUES (
  'Admin — Booking Cancelled',
  'Booking cancelled: {{guest_first_name}} {{guest_last_name}} — {{room_name}}',
  $t11$
<div style="font-family:Arial,Helvetica,sans-serif;background:#f1f5f9;padding:40px 20px;margin:0;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
    <div style="background:#1e293b;padding:28px 40px;">
      <p style="color:#ffffff;margin:0;font-size:20px;font-weight:700;">Booking Cancelled</p>
      <p style="color:#94a3b8;margin:4px 0 0;font-size:13px;">{{business_name}} Admin Notification</p>
    </div>
    <div style="padding:36px 40px;color:#1e293b;font-size:15px;line-height:1.7;">
      <div style="background:#fef2f2;border-left:4px solid #ef4444;padding:16px 20px;border-radius:4px;margin:0 0 24px;">
        <p style="margin:0 0 8px;font-weight:600;color:#dc2626;">Guest Information</p>
        <p style="margin:0 0 6px;"><strong>Name:</strong> {{guest_first_name}} {{guest_last_name}}</p>
        <p style="margin:0 0 6px;"><strong>Email:</strong> {{guest_email}}</p>
        <p style="margin:0;"><strong>Phone:</strong> {{guest_phone}}</p>
      </div>
      <div style="background:#f8fafc;border-left:4px solid #64748b;padding:16px 20px;border-radius:4px;margin:0 0 24px;">
        <p style="margin:0 0 8px;font-weight:600;color:#374151;">Booking Details</p>
        <p style="margin:0 0 6px;"><strong>Room:</strong> {{room_name}}</p>
        <p style="margin:0 0 6px;"><strong>Check-in:</strong> {{check_in_date}}</p>
        <p style="margin:0 0 6px;"><strong>Check-out:</strong> {{check_out_date}}</p>
        <p style="margin:0;"><strong>Total:</strong> {{total_amount}}</p>
      </div>
    </div>
    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 40px;text-align:center;font-size:13px;color:#64748b;">
      <p style="margin:0;">{{business_name}} &nbsp;&middot;&nbsp; Admin Notification</p>
    </div>
  </div>
</div>
  $t11$,
  true
) RETURNING id INTO tid;
UPDATE email_automations SET template_id = tid
  WHERE name = 'Admin — Booking Cancelled' AND is_pre_planned = true;

END;
$$;
