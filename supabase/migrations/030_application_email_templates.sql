-- 030_application_email_templates.sql
-- Creates email templates for all 10 application-flow automation events,
-- links them to the existing email_automations rows (which previously had
-- template_id = NULL and therefore sent nothing), and updates the
-- booking_pending template to include the application link.

DO $$
DECLARE
  shared_head text := '<!DOCTYPE HTML PUBLIC "-//W3C//DTD XHTML 1.0 Transitional //EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<!--[if gte mso 9]><xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
  <!--[if !mso]><!--><meta http-equiv="X-UA-Compatible" content="IE=edge"><!--<![endif]-->
  <style type="text/css">
    @media only screen and (min-width: 520px) { .u-row { width: 500px !important; } .u-row .u-col { vertical-align: top; } .u-row .u-col-100 { width: 500px !important; } }
    @media only screen and (max-width: 520px) { .u-row-container { max-width: 100% !important; padding-left: 0px !important; padding-right: 0px !important; } .u-row { width: 100% !important; } .u-row .u-col { display: block !important; width: 100% !important; min-width: 320px !important; max-width: 100% !important; } .u-row .u-col > div { margin: 0 auto; } }
    body{margin:0;padding:0}table,td,tr{border-collapse:collapse;vertical-align:top}p{margin:0}.ie-container table,.mso-container table{table-layout:fixed}*{line-height:inherit}a[x-apple-data-detectors=true]{color:inherit!important;text-decoration:none!important}
    table, td { color: #000000; }
  </style>
</head>
<body class="clean-body u_body" style="margin: 0;padding: 0;-webkit-text-size-adjust: 100%;background-color: #F7F8F9;color: #000000">
<!--[if IE]><div class="ie-container"><![endif]--><!--[if mso]><div class="mso-container"><![endif]-->
<table role="presentation" style="border-collapse: collapse;table-layout: fixed;border-spacing: 0;mso-table-lspace: 0pt;mso-table-rspace: 0pt;vertical-align: top;min-width: 320px;Margin: 0 auto;background-color: #F7F8F9;width:100%" cellpadding="0" cellspacing="0">
<tbody><tr style="vertical-align: top"><td style="word-break: break-word;border-collapse: collapse !important;vertical-align: top">
<!--[if (mso)|(IE)]><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="background-color: #F7F8F9;" bgcolor="#F7F8F9"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="500" align="center" style="border-collapse: collapse;"><tr><td style="padding:0;"><![endif]-->
<div class="u-row-container" style="padding: 0px;background-color: transparent;"><div class="u-row" style="margin: 0 auto;min-width: 320px;max-width: 500px;overflow-wrap: break-word;word-wrap: break-word;word-break: break-word;background-color: transparent;"><div style="border-collapse: collapse;display: table;width: 100%;height: 100%;background-color: transparent;"><!--[if (mso)|(IE)]><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding: 0px;background-color: transparent;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr style="background-color: transparent;"><![endif]--><!--[if (mso)|(IE)]><td align="center" width="500" style="background-color: #ffffff;width: 500px;border-top: 0px solid transparent;border-left: 0px solid transparent;border-right: 0px solid transparent;border-bottom: 0px solid transparent;border-radius: 0px;-webkit-border-radius: 0px; -moz-border-radius: 0px;" valign="top"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding: 0px;"><![endif]--><div class="u-col u-col-100" style="max-width: 320px;min-width: 500px;display: table-cell;vertical-align: top;"><div style="background-color: #ffffff;height: 100%;width: 100% !important;border-radius: 0px;-webkit-border-radius: 0px; -moz-border-radius: 0px;"><!--[if (!mso)&(!IE)]><!--><div style="box-sizing: border-box; height: 100%; padding: 0px;border-top: 0px solid transparent;border-left: 0px solid transparent;border-right: 0px solid transparent;border-bottom: 0px solid transparent;border-radius: 0px;-webkit-border-radius: 0px; -moz-border-radius: 0px;"><!--<![endif]--><table style="font-family:arial,helvetica,sans-serif;" role="presentation" cellpadding="0" cellspacing="0" width="100%" border="0"><tbody><tr><td style="overflow-wrap:break-word;word-break:break-word;padding:10px;font-family:arial,helvetica,sans-serif;" align="left"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding-right: 0px;padding-left: 0px;" align="center"><img align="center" border="0" src="https://assets.unlayer.com/projects/0/1776749144292-605893711_122205658556539023_7324835390045113398_n.jpg?w=211.2px" alt="" title="" style="outline: none;text-decoration: none;-ms-interpolation-mode: bicubic;clear: both;display: inline-block !important;border: none;height: auto;float: none;width: 22%;max-width: 105.6px;" width="105.6" height="106"/></td></tr></table></td></tr></tbody></table><!--[if (!mso)&(!IE)]><!--></div><!--<![endif]--></div></div><!--[if (mso)|(IE)]></td></tr></table></td><![endif]--><!--[if (mso)|(IE)]></tr></table></td></tr></table><![endif]--></div></div></div>
<div class="u-row-container" style="padding: 0px;background-color: transparent;"><div class="u-row" style="margin: 0 auto;min-width: 320px;max-width: 500px;overflow-wrap: break-word;word-wrap: break-word;word-break: break-word;background-color: transparent;"><div style="border-collapse: collapse;display: table;width: 100%;height: 100%;background-color: transparent;"><!--[if (mso)|(IE)]><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding: 0px;background-color: transparent;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr style="background-color: transparent;"><![endif]--><!--[if (mso)|(IE)]><td align="center" width="500" style="background-color: #0d9488;width: 500px;border-top: 0px solid transparent;border-left: 0px solid transparent;border-right: 0px solid transparent;border-bottom: 0px solid transparent;border-radius: 0px;-webkit-border-radius: 0px; -moz-border-radius: 0px;" valign="top"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding: 0px;"><![endif]--><div class="u-col u-col-100" style="max-width: 320px;min-width: 500px;display: table-cell;vertical-align: top;"><div style="background-color: #0d9488;height: 100%;width: 100% !important;border-radius: 0px;-webkit-border-radius: 0px; -moz-border-radius: 0px;"><!--[if (!mso)&(!IE)]><!--><div style="box-sizing: border-box; height: 100%; padding: 0px;border-top: 0px solid transparent;border-left: 0px solid transparent;border-right: 0px solid transparent;border-bottom: 0px solid transparent;border-radius: 0px;-webkit-border-radius: 0px; -moz-border-radius: 0px;"><!--<![endif]--><table style="font-family:arial,helvetica,sans-serif;" role="presentation" cellpadding="0" cellspacing="0" width="100%" border="0"><tbody><tr><td style="overflow-wrap:break-word;word-break:break-word;padding:10px;font-family:arial,helvetica,sans-serif;" align="left"><!--[if mso]><table role="presentation" width="100%"><tr><td><![endif]--><h1 style="margin: 0px; color: #ffffff; line-height: 140%; text-align: left; word-wrap: break-word; font-size: 17px; font-weight: 400;"><span><span>{{business_name}}</span></span></h1><!--[if mso]></td></tr></table><![endif]--></td></tr></tbody></table><!--[if (!mso)&(!IE)]><!--></div><!--<![endif]--></div></div><!--[if (mso)|(IE)]></td></tr></table></td><![endif]--><!--[if (mso)|(IE)]></tr></table></td></tr></table><![endif]--></div></div></div>';

  shared_body_open text := '<div class="u-row-container" style="padding: 0px;background-color: transparent;"><div class="u-row" style="margin: 0 auto;min-width: 320px;max-width: 500px;overflow-wrap: break-word;word-wrap: break-word;word-break: break-word;background-color: transparent;"><div style="border-collapse: collapse;display: table;width: 100%;height: 100%;background-color: transparent;"><!--[if (mso)|(IE)]><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding: 0px;background-color: transparent;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr style="background-color: transparent;"><![endif]--><!--[if (mso)|(IE)]><td align="center" width="500" style="width: 500px;border-top: 0px solid transparent;border-left: 0px solid transparent;border-right: 0px solid transparent;border-bottom: 0px solid transparent;border-radius: 0px;-webkit-border-radius: 0px; -moz-border-radius: 0px;" valign="top"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding: 0px;"><![endif]--><div class="u-col u-col-100" style="max-width: 320px;min-width: 500px;display: table-cell;vertical-align: top;"><div style="height: 100%;width: 100% !important;border-radius: 0px;-webkit-border-radius: 0px; -moz-border-radius: 0px;"><!--[if (!mso)&(!IE)]><!--><div style="box-sizing: border-box; height: 100%; padding: 0px;border-top: 0px solid transparent;border-left: 0px solid transparent;border-right: 0px solid transparent;border-bottom: 0px solid transparent;border-radius: 0px;-webkit-border-radius: 0px; -moz-border-radius: 0px;"><!--<![endif]--><table style="font-family:arial,helvetica,sans-serif;" role="presentation" cellpadding="0" cellspacing="0" width="100%" border="0"><tbody><tr><td style="overflow-wrap:break-word;word-break:break-word;padding:10px;font-family:arial,helvetica,sans-serif;" align="left"><div style="font-size: 14px; line-height: 1.4; text-align: left; word-wrap: break-word;">';

  shared_body_close text := '</div></td></tr></tbody></table><!--[if (!mso)&(!IE)]><!--></div><!--<![endif]--></div></div><!--[if (mso)|(IE)]></td></tr></table></td><![endif]--><!--[if (mso)|(IE)]></tr></table></td></tr></table><![endif]--></div></div></div>';

  shared_footer text := '<div class="u-row-container" style="padding: 1px;background-color: transparent;"><div class="u-row" style="margin: 0 auto;min-width: 320px;max-width: 500px;overflow-wrap: break-word;word-wrap: break-word;word-break: break-word;background-color: transparent;"><div style="border-collapse: collapse;display: table;width: 100%;height: 100%;background-color: transparent;"><!--[if (mso)|(IE)]><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding: 1px;background-color: transparent;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr style="background-color: transparent;"><![endif]--><!--[if (mso)|(IE)]><td align="center" width="500" style="background-color: #eaeaea;width: 500px;border-top: 0px solid transparent;border-left: 0px solid transparent;border-right: 0px solid transparent;border-bottom: 0px solid transparent;border-radius: 0px;-webkit-border-radius: 0px; -moz-border-radius: 0px;" valign="top"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding: 0px;"><![endif]--><div class="u-col u-col-100" style="max-width: 320px;min-width: 500px;display: table-cell;vertical-align: top;"><div style="background-color: #eaeaea;height: 100%;width: 100% !important;border-radius: 0px;-webkit-border-radius: 0px; -moz-border-radius: 0px;"><!--[if (!mso)&(!IE)]><!--><div style="box-sizing: border-box; height: 100%; padding: 0px;border-top: 0px solid transparent;border-left: 0px solid transparent;border-right: 0px solid transparent;border-bottom: 0px solid transparent;border-radius: 0px;-webkit-border-radius: 0px; -moz-border-radius: 0px;"><!--<![endif]--><table style="font-family:arial,helvetica,sans-serif;" role="presentation" cellpadding="0" cellspacing="0" width="100%" border="0"><tbody><tr><td style="overflow-wrap:break-word;word-break:break-word;padding:10px;font-family:arial,helvetica,sans-serif;" align="left"><div style="font-size: 11px; color: #000000; line-height: 1.4; text-align: center; word-wrap: break-word;"><p><span>{{business_name}}</span><span> - </span><span>{{contact_phone}}</span><span> - </span><span>{{contact_email}}</span></p></div></td></tr></tbody></table><!--[if (!mso)&(!IE)]><!--></div><!--<![endif]--></div></div><!--[if (mso)|(IE)]></td></tr></table></td><![endif]--><!--[if (mso)|(IE)]></tr></table></td></tr></table><![endif]--></div></div></div>
<!--[if (mso)|(IE)]></td></tr></table></td></tr></table><![endif]--></td></tr></tbody></table><!--[if mso]></div><![endif]--><!--[if IE]></div><![endif]--></body></html>';

  btn text := 'style="display:inline-block;background:#0d9488;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:6px;font-weight:600;font-size:14px;"';

  t_application_needed         uuid;
  t_application_reminder_12h   uuid;
  t_application_reminder_24h   uuid;
  t_application_expired        uuid;
  t_booking_approved           uuid;
  t_booking_declined           uuid;
  t_booking_auto_declined      uuid;
  t_admin_application_submitted uuid;
  t_admin_application_overdue  uuid;
  t_admin_missed_deadline      uuid;

BEGIN

  -- ── Application Needed ────────────────────────────────────────────────────
  INSERT INTO email_templates (name, subject, body, is_active) VALUES (
    'Application Needed',
    'Action required: Complete your application for {{room_name}}',
    shared_head || shared_body_open ||
    '<p><span>Hi </span><span>{{guest_first_name}}</span><span>,</span></p><p><br></p><p><span>Thank you for your interest in </span><span style="font-weight:bold">{{room_name}}</span><span>! We have received your booking request and your payment has been placed on hold.</span></p><p><br></p><p><span>To secure your room, please complete your application as soon as possible. Applications that are not submitted within 48 hours will expire automatically.</span></p><p><br></p><p><a href="{{application_link}}" ' || btn || '>Complete Your Application</a></p><p><br></p><p><span style="font-weight: bold">Room</span><span>: </span><span>{{room_name}}</span></p><p><span style="font-weight: bold">Check-in</span><span>: </span><span>{{check_in_date}}</span></p><p><span style="font-weight: bold">Check-out</span><span>: </span><span>{{check_out_date}}</span></p><p><span style="font-weight: bold">Total</span><span>: </span><span>{{total_amount}}</span></p><p><br></p><p><span>If you have any questions, please reach out to us directly.</span></p><p><br></p><p><span>Warm regards,</span></p><p><span>{{business_name}}</span></p>'
    || shared_body_close || shared_footer,
    true
  ) RETURNING id INTO t_application_needed;

  -- ── Application Reminder 12h ──────────────────────────────────────────────
  INSERT INTO email_templates (name, subject, body, is_active) VALUES (
    'Application Reminder (12h)',
    'Reminder: Application still needed for {{room_name}}',
    shared_head || shared_body_open ||
    '<p><span>Hi </span><span>{{guest_first_name}}</span><span>,</span></p><p><br></p><p><span>This is a friendly reminder that your booking request for </span><span style="font-weight:bold">{{room_name}}</span><span> requires an application to be completed.</span></p><p><br></p><p><span>Your application window is closing soon. Please submit your application now to keep your booking active.</span></p><p><br></p><p><a href="{{application_link}}" ' || btn || '>Complete Your Application</a></p><p><br></p><p><span style="font-weight: bold">Room</span><span>: </span><span>{{room_name}}</span></p><p><span style="font-weight: bold">Check-in</span><span>: </span><span>{{check_in_date}}</span></p><p><span style="font-weight: bold">Check-out</span><span>: </span><span>{{check_out_date}}</span></p><p><br></p><p><span>If you have any questions, do not hesitate to contact us.</span></p><p><br></p><p><span>Warm regards,</span></p><p><span>{{business_name}}</span></p>'
    || shared_body_close || shared_footer,
    true
  ) RETURNING id INTO t_application_reminder_12h;

  -- ── Application Reminder 24h ──────────────────────────────────────────────
  INSERT INTO email_templates (name, subject, body, is_active) VALUES (
    'Application Reminder (24h)',
    'Urgent: Your application for {{room_name}} expires soon',
    shared_head || shared_body_open ||
    '<p><span>Hi </span><span>{{guest_first_name}}</span><span>,</span></p><p><br></p><p><span style="font-weight:bold">Your booking for </span><span style="font-weight:bold">{{room_name}}</span><span style="font-weight:bold"> will be automatically cancelled if you do not complete your application immediately.</span></p><p><br></p><p><span>This is your final reminder. Please complete your application now to avoid losing your booking.</span></p><p><br></p><p><a href="{{application_link}}" ' || btn || '>Complete Your Application Now</a></p><p><br></p><p><span style="font-weight: bold">Room</span><span>: </span><span>{{room_name}}</span></p><p><span style="font-weight: bold">Check-in</span><span>: </span><span>{{check_in_date}}</span></p><p><span style="font-weight: bold">Check-out</span><span>: </span><span>{{check_out_date}}</span></p><p><br></p><p><span>If you need assistance, please contact us right away.</span></p><p><br></p><p><span>Warm regards,</span></p><p><span>{{business_name}}</span></p>'
    || shared_body_close || shared_footer,
    true
  ) RETURNING id INTO t_application_reminder_24h;

  -- ── Application Expired ───────────────────────────────────────────────────
  INSERT INTO email_templates (name, subject, body, is_active) VALUES (
    'Application Expired',
    'Your booking request for {{room_name}} has expired',
    shared_head || shared_body_open ||
    '<p><span>Hi </span><span>{{guest_first_name}}</span><span>,</span></p><p><br></p><p><span>Unfortunately, your booking request for </span><span style="font-weight:bold">{{room_name}}</span><span> has expired because the application was not completed within the required timeframe.</span></p><p><br></p><p><span style="font-weight: bold">Room</span><span>: </span><span>{{room_name}}</span></p><p><span style="font-weight: bold">Check-in</span><span>: </span><span>{{check_in_date}}</span></p><p><span style="font-weight: bold">Check-out</span><span>: </span><span>{{check_out_date}}</span></p><p><br></p><p><span>Your payment authorization has been voided and no charge has been made to your account. If you would still like to book this room, please submit a new reservation.</span></p><p><br></p><p><span>We hope to have the opportunity to host you in the future.</span></p><p><br></p><p><span>Warm regards,</span></p><p><span>{{business_name}}</span></p>'
    || shared_body_close || shared_footer,
    true
  ) RETURNING id INTO t_application_expired;

  -- ── Booking Approved ──────────────────────────────────────────────────────
  INSERT INTO email_templates (name, subject, body, is_active) VALUES (
    'Booking Approved',
    'Your booking for {{room_name}} is confirmed!',
    shared_head || shared_body_open ||
    '<p><span>Hi </span><span>{{guest_first_name}}</span><span>,</span></p><p><br></p><p><span>Great news &#8212; your application has been </span><span style="font-weight:bold">approved</span><span> and your booking is now confirmed!</span></p><p><br></p><p><span style="font-weight: bold">Room</span><span>: </span><span>{{room_name}}</span></p><p><span style="font-weight: bold">Check-in</span><span>: </span><span>{{check_in_date}}</span><span> at </span><span>{{checkin_time}}</span></p><p><span style="font-weight: bold">Check-out</span><span>: </span><span>{{check_out_date}}</span><span> at </span><span>{{checkout_time}}</span></p><p><span style="font-weight: bold">Nights</span><span>: </span><span>{{total_nights}}</span></p><p><span style="font-weight: bold">Total Charged</span><span>: </span><span>{{total_amount}}</span></p><p><br></p><p><span>If you have any questions before your arrival, please do not hesitate to reach out.</span></p><p><br></p><p><span>We look forward to hosting you!</span></p><p><br></p><p><span>Warm regards,</span></p><p><span>{{business_name}}</span></p>'
    || shared_body_close || shared_footer,
    true
  ) RETURNING id INTO t_booking_approved;

  -- ── Booking Declined ──────────────────────────────────────────────────────
  INSERT INTO email_templates (name, subject, body, is_active) VALUES (
    'Booking Declined',
    'Update on your booking request for {{room_name}}',
    shared_head || shared_body_open ||
    '<p><span>Hi </span><span>{{guest_first_name}}</span><span>,</span></p><p><br></p><p><span>Thank you for your interest in </span><span style="font-weight:bold">{{room_name}}</span><span>. After reviewing your application, we are unfortunately unable to accommodate your booking at this time.</span></p><p><br></p><p><span>{{decline_reason}}</span></p><p><br></p><p><span>Your payment authorization has been voided and no charge has been made to your account.</span></p><p><br></p><p><span>We appreciate your understanding and hope to have the opportunity to assist you in the future.</span></p><p><br></p><p><span>Warm regards,</span></p><p><span>{{business_name}}</span></p>'
    || shared_body_close || shared_footer,
    true
  ) RETURNING id INTO t_booking_declined;

  -- ── Booking Auto-Declined ─────────────────────────────────────────────────
  INSERT INTO email_templates (name, subject, body, is_active) VALUES (
    'Booking Auto-Declined',
    'Booking update for {{room_name}}',
    shared_head || shared_body_open ||
    '<p><span>Hi </span><span>{{guest_first_name}}</span><span>,</span></p><p><br></p><p><span>We sincerely apologize for the delay in reviewing your application for </span><span style="font-weight:bold">{{room_name}}</span><span>. Unfortunately, your booking was automatically cancelled because we were unable to complete our review within the required timeframe.</span></p><p><br></p><p><span style="font-weight: bold">Room</span><span>: </span><span>{{room_name}}</span></p><p><span style="font-weight: bold">Check-in</span><span>: </span><span>{{check_in_date}}</span></p><p><span style="font-weight: bold">Check-out</span><span>: </span><span>{{check_out_date}}</span></p><p><br></p><p><span>Your payment authorization has been voided and no charge has been made. Please accept our sincere apologies. If you would like to try again, please submit a new booking request and we will prioritize your review.</span></p><p><br></p><p><span>Sincerely,</span></p><p><span>{{business_name}}</span></p>'
    || shared_body_close || shared_footer,
    true
  ) RETURNING id INTO t_booking_auto_declined;

  -- ── Admin — New Application Submitted ────────────────────────────────────
  INSERT INTO email_templates (name, subject, body, is_active) VALUES (
    'Admin — New Application Submitted',
    'New application: {{guest_first_name}} {{guest_last_name}} — {{room_name}}',
    shared_head || shared_body_open ||
    '<p><span>A guest has submitted their application and is awaiting your review.</span></p><p><br></p><p><span style="font-weight: bold">Guest Name</span><span>: </span><span>{{guest_first_name}} {{guest_last_name}}</span></p><p><span style="font-weight: bold">Email</span><span>: </span><span>{{guest_email}}</span></p><p><span style="font-weight: bold">Phone</span><span>: </span><span>{{guest_phone}}</span></p><p><br></p><p><span style="font-weight: bold">Room</span><span>: </span><span>{{room_name}}</span></p><p><span style="font-weight: bold">Check-in</span><span>: </span><span>{{check_in_date}}</span></p><p><span style="font-weight: bold">Check-out</span><span>: </span><span>{{check_out_date}}</span></p><p><span style="font-weight: bold">Nights</span><span>: </span><span>{{total_nights}}</span></p><p><span style="font-weight: bold">Total</span><span>: </span><span>{{total_amount}}</span></p><p><br></p><p><span>You have </span><span style="font-weight:bold">24 hours</span><span> to approve or decline this application. If no decision is made, the booking will be automatically declined.</span></p><p><br></p><p><span>Please log in to the admin panel to review the application.</span></p>'
    || shared_body_close || shared_footer,
    true
  ) RETURNING id INTO t_admin_application_submitted;

  -- ── Admin — Application Overdue ───────────────────────────────────────────
  INSERT INTO email_templates (name, subject, body, is_active) VALUES (
    'Admin — Application Overdue',
    '⚠ Urgent: Application review deadline approaching — {{room_name}}',
    shared_head || shared_body_open ||
    '<p><span style="font-weight:bold">&#9888; Action Required &#8212; Review Deadline in ~1 Hour</span></p><p><br></p><p><span>A guest application is about to expire and requires your </span><span style="font-weight:bold">immediate</span><span> attention.</span></p><p><br></p><p><span style="font-weight: bold">Guest Name</span><span>: </span><span>{{guest_first_name}} {{guest_last_name}}</span></p><p><span style="font-weight: bold">Email</span><span>: </span><span>{{guest_email}}</span></p><p><span style="font-weight: bold">Room</span><span>: </span><span>{{room_name}}</span></p><p><span style="font-weight: bold">Check-in</span><span>: </span><span>{{check_in_date}}</span></p><p><span style="font-weight: bold">Check-out</span><span>: </span><span>{{check_out_date}}</span></p><p><br></p><p><span>This application will be </span><span style="font-weight:bold">automatically declined</span><span> if not reviewed immediately. Please log in to the admin panel now to approve or decline.</span></p>'
    || shared_body_close || shared_footer,
    true
  ) RETURNING id INTO t_admin_application_overdue;

  -- ── Admin — Missed Deadline ───────────────────────────────────────────────
  INSERT INTO email_templates (name, subject, body, is_active) VALUES (
    'Admin — Missed Deadline',
    'Missed review deadline: {{guest_first_name}} {{guest_last_name}} — {{room_name}}',
    shared_head || shared_body_open ||
    '<p><span>A booking was </span><span style="font-weight:bold">automatically declined</span><span> because the admin review deadline passed without a decision.</span></p><p><br></p><p><span style="font-weight: bold">Guest Name</span><span>: </span><span>{{guest_first_name}} {{guest_last_name}}</span></p><p><span style="font-weight: bold">Email</span><span>: </span><span>{{guest_email}}</span></p><p><span style="font-weight: bold">Phone</span><span>: </span><span>{{guest_phone}}</span></p><p><br></p><p><span style="font-weight: bold">Room</span><span>: </span><span>{{room_name}}</span></p><p><span style="font-weight: bold">Check-in</span><span>: </span><span>{{check_in_date}}</span></p><p><span style="font-weight: bold">Check-out</span><span>: </span><span>{{check_out_date}}</span></p><p><span style="font-weight: bold">Total</span><span>: </span><span>{{total_amount}}</span></p><p><br></p><p><span>The guest has been notified that their booking was automatically cancelled. To prevent future missed deadlines, please check your admin notification settings.</span></p>'
    || shared_body_close || shared_footer,
    true
  ) RETURNING id INTO t_admin_missed_deadline;

  -- ── Link automations to their templates ───────────────────────────────────
  UPDATE email_automations SET template_id = t_application_needed         WHERE trigger_event = 'application_needed';
  UPDATE email_automations SET template_id = t_application_reminder_12h   WHERE trigger_event = 'application_reminder_12h';
  UPDATE email_automations SET template_id = t_application_reminder_24h   WHERE trigger_event = 'application_reminder_24h';
  UPDATE email_automations SET template_id = t_application_expired        WHERE trigger_event = 'application_expired';
  UPDATE email_automations SET template_id = t_booking_approved           WHERE trigger_event = 'booking_approved';
  UPDATE email_automations SET template_id = t_booking_declined           WHERE trigger_event = 'booking_declined';
  UPDATE email_automations SET template_id = t_booking_auto_declined      WHERE trigger_event = 'booking_auto_declined';
  UPDATE email_automations SET template_id = t_admin_application_submitted WHERE trigger_event = 'admin_application_submitted';
  UPDATE email_automations SET template_id = t_admin_application_overdue  WHERE trigger_event = 'admin_application_overdue';
  UPDATE email_automations SET template_id = t_admin_missed_deadline      WHERE trigger_event = 'admin_missed_deadline';

  -- ── Update Booking Pending to include application link ────────────────────
  UPDATE email_templates SET body = shared_head || shared_body_open ||
    '<p><span>Hi </span><span>{{guest_first_name}}</span><span>,</span></p><p><br></p><p><span>Thank you for your interest in </span><span style="font-weight:bold">{{room_name}}</span><span>! We have received your booking request and your payment has been placed on hold.</span></p><p><br></p><p><span>To secure your room, please complete your application below. Applications must be submitted within 48 hours or the booking will expire automatically.</span></p><p><br></p><p><a href="{{application_link}}" ' || btn || '>Complete Your Application</a></p><p><br></p><p><span style="font-weight: bold">Room</span><span>: </span><span>{{room_name}}</span></p><p><span style="font-weight: bold">Check-in</span><span>: </span><span>{{check_in_date}}</span></p><p><span style="font-weight: bold">Check-out</span><span>: </span><span>{{check_out_date}}</span></p><p><span style="font-weight: bold">Nights</span><span>: </span><span>{{total_nights}}</span></p><p><span style="font-weight: bold">Total</span><span>: </span><span>{{total_amount}}</span></p><p><br></p><p><span>If you have any questions in the meantime, feel free to reach out.</span></p><p><br></p><p><span>Warm regards,</span></p><p><span>{{business_name}}</span></p>'
    || shared_body_close || shared_footer
  WHERE name = 'Booking Pending';

END $$;
