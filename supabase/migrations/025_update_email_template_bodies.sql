-- Apply Booking Confirmed Unlayer HTML structure to all other email templates.
-- Only the body text content differs per template; the wrapper (logo, teal header, footer) is identical.

DO $$
DECLARE
  shared_head text := '<!DOCTYPE HTML PUBLIC "-//W3C//DTD XHTML 1.0 Transitional //EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<!--[if gte mso 9]>
<xml>
  <o:OfficeDocumentSettings>
    <o:AllowPNG/>
    <o:PixelsPerInch>96</o:PixelsPerInch>
  </o:OfficeDocumentSettings>
</xml>
<![endif]-->
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
  <!--[if !mso]><!--><meta http-equiv="X-UA-Compatible" content="IE=edge"><!--<![endif]-->
    <style type="text/css">
      @media only screen and (min-width: 520px) {
        .u-row { width: 500px !important; }
        .u-row .u-col { vertical-align: top; }
        .u-row .u-col-100 { width: 500px !important; }
      }
      @media only screen and (max-width: 520px) {
        .u-row-container { max-width: 100% !important; padding-left: 0px !important; padding-right: 0px !important; }
        .u-row { width: 100% !important; }
        .u-row .u-col { display: block !important; width: 100% !important; min-width: 320px !important; max-width: 100% !important; }
        .u-row .u-col > div { margin: 0 auto; }
      }
      body{margin:0;padding:0}table,td,tr{border-collapse:collapse;vertical-align:top}p{margin:0}.ie-container table,.mso-container table{table-layout:fixed}*{line-height:inherit}a[x-apple-data-detectors=true]{color:inherit!important;text-decoration:none!important}
      table, td { color: #000000; }
    </style>
</head>
<body class="clean-body u_body" style="margin: 0;padding: 0;-webkit-text-size-adjust: 100%;background-color: #F7F8F9;color: #000000">
  <!--[if IE]><div class="ie-container"><![endif]-->
  <!--[if mso]><div class="mso-container"><![endif]-->
  <table role="presentation" style="border-collapse: collapse;table-layout: fixed;border-spacing: 0;mso-table-lspace: 0pt;mso-table-rspace: 0pt;vertical-align: top;min-width: 320px;Margin: 0 auto;background-color: #F7F8F9;width:100%" cellpadding="0" cellspacing="0">
  <tbody>
  <tr style="vertical-align: top">
    <td style="word-break: break-word;border-collapse: collapse !important;vertical-align: top">
    <!--[if (mso)|(IE)]><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="background-color: #F7F8F9;" bgcolor="#F7F8F9"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="500" align="center" style="border-collapse: collapse;"><tr><td style="padding:0;"><![endif]-->
<div class="u-row-container" style="padding: 0px;background-color: transparent;">
  <div class="u-row" style="margin: 0 auto;min-width: 320px;max-width: 500px;overflow-wrap: break-word;word-wrap: break-word;word-break: break-word;background-color: transparent;">
    <div style="border-collapse: collapse;display: table;width: 100%;height: 100%;background-color: transparent;">
      <!--[if (mso)|(IE)]><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding: 0px;background-color: transparent;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr style="background-color: transparent;"><![endif]-->
<!--[if (mso)|(IE)]><td align="center" width="500" style="background-color: #ffffff;width: 500px;border-top: 0px solid transparent;border-left: 0px solid transparent;border-right: 0px solid transparent;border-bottom: 0px solid transparent;border-radius: 0px;-webkit-border-radius: 0px; -moz-border-radius: 0px;" valign="top"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding: 0px;"><![endif]-->
<div class="u-col u-col-100" style="max-width: 320px;min-width: 500px;display: table-cell;vertical-align: top;">
  <div style="background-color: #ffffff;height: 100%;width: 100% !important;border-radius: 0px;-webkit-border-radius: 0px; -moz-border-radius: 0px;">
  <!--[if (!mso)&(!IE)]><!--><div style="box-sizing: border-box; height: 100%; padding: 0px;border-top: 0px solid transparent;border-left: 0px solid transparent;border-right: 0px solid transparent;border-bottom: 0px solid transparent;border-radius: 0px;-webkit-border-radius: 0px; -moz-border-radius: 0px;"><!--<![endif]-->
  <table style="font-family:arial,helvetica,sans-serif;" role="presentation" cellpadding="0" cellspacing="0" width="100%" border="0">
    <tbody><tr>
      <td style="overflow-wrap:break-word;word-break:break-word;padding:10px;font-family:arial,helvetica,sans-serif;" align="left">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="padding-right: 0px;padding-left: 0px;" align="center">
            <img align="center" border="0" src="https://assets.unlayer.com/projects/0/1776749144292-605893711_122205658556539023_7324835390045113398_n.jpg?w=211.2px" alt="" title="" style="outline: none;text-decoration: none;-ms-interpolation-mode: bicubic;clear: both;display: inline-block !important;border: none;height: auto;float: none;width: 22%;max-width: 105.6px;" width="105.6" height="106"/>
          </td></tr>
        </table>
      </td>
    </tr></tbody>
  </table>
  <!--[if (!mso)&(!IE)]><!--></div><!--<![endif]-->
  </div>
</div>
<!--[if (mso)|(IE)]></td></tr></table></td><![endif]-->
      <!--[if (mso)|(IE)]></tr></table></td></tr></table><![endif]-->
    </div>
  </div>
</div>
<div class="u-row-container" style="padding: 0px;background-color: transparent;">
  <div class="u-row" style="margin: 0 auto;min-width: 320px;max-width: 500px;overflow-wrap: break-word;word-wrap: break-word;word-break: break-word;background-color: transparent;">
    <div style="border-collapse: collapse;display: table;width: 100%;height: 100%;background-color: transparent;">
      <!--[if (mso)|(IE)]><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding: 0px;background-color: transparent;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr style="background-color: transparent;"><![endif]-->
<!--[if (mso)|(IE)]><td align="center" width="500" style="background-color: #0d9488;width: 500px;border-top: 0px solid transparent;border-left: 0px solid transparent;border-right: 0px solid transparent;border-bottom: 0px solid transparent;border-radius: 0px;-webkit-border-radius: 0px; -moz-border-radius: 0px;" valign="top"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding: 0px;"><![endif]-->
<div class="u-col u-col-100" style="max-width: 320px;min-width: 500px;display: table-cell;vertical-align: top;">
  <div style="background-color: #0d9488;height: 100%;width: 100% !important;border-radius: 0px;-webkit-border-radius: 0px; -moz-border-radius: 0px;">
  <!--[if (!mso)&(!IE)]><!--><div style="box-sizing: border-box; height: 100%; padding: 0px;border-top: 0px solid transparent;border-left: 0px solid transparent;border-right: 0px solid transparent;border-bottom: 0px solid transparent;border-radius: 0px;-webkit-border-radius: 0px; -moz-border-radius: 0px;"><!--<![endif]-->
  <table style="font-family:arial,helvetica,sans-serif;" role="presentation" cellpadding="0" cellspacing="0" width="100%" border="0">
    <tbody><tr>
      <td style="overflow-wrap:break-word;word-break:break-word;padding:10px;font-family:arial,helvetica,sans-serif;" align="left">
        <!--[if mso]><table role="presentation" width="100%"><tr><td><![endif]-->
        <h1 style="margin: 0px; color: #ffffff; line-height: 140%; text-align: left; word-wrap: break-word; font-size: 17px; font-weight: 400;"><span><span>{{business_name}}</span></span></h1>
        <!--[if mso]></td></tr></table><![endif]-->
      </td>
    </tr></tbody>
  </table>
  <!--[if (!mso)&(!IE)]><!--></div><!--<![endif]-->
  </div>
</div>
<!--[if (mso)|(IE)]></td></tr></table></td><![endif]-->
      <!--[if (mso)|(IE)]></tr></table></td></tr></table><![endif]-->
    </div>
  </div>
</div>';

  shared_body_open text := '<div class="u-row-container" style="padding: 0px;background-color: transparent;">
  <div class="u-row" style="margin: 0 auto;min-width: 320px;max-width: 500px;overflow-wrap: break-word;word-wrap: break-word;word-break: break-word;background-color: transparent;">
    <div style="border-collapse: collapse;display: table;width: 100%;height: 100%;background-color: transparent;">
      <!--[if (mso)|(IE)]><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding: 0px;background-color: transparent;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr style="background-color: transparent;"><![endif]-->
<!--[if (mso)|(IE)]><td align="center" width="500" style="width: 500px;border-top: 0px solid transparent;border-left: 0px solid transparent;border-right: 0px solid transparent;border-bottom: 0px solid transparent;border-radius: 0px;-webkit-border-radius: 0px; -moz-border-radius: 0px;" valign="top"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding: 0px;"><![endif]-->
<div class="u-col u-col-100" style="max-width: 320px;min-width: 500px;display: table-cell;vertical-align: top;">
  <div style="height: 100%;width: 100% !important;border-radius: 0px;-webkit-border-radius: 0px; -moz-border-radius: 0px;">
  <!--[if (!mso)&(!IE)]><!--><div style="box-sizing: border-box; height: 100%; padding: 0px;border-top: 0px solid transparent;border-left: 0px solid transparent;border-right: 0px solid transparent;border-bottom: 0px solid transparent;border-radius: 0px;-webkit-border-radius: 0px; -moz-border-radius: 0px;"><!--<![endif]-->
  <table style="font-family:arial,helvetica,sans-serif;" role="presentation" cellpadding="0" cellspacing="0" width="100%" border="0">
    <tbody><tr>
      <td style="overflow-wrap:break-word;word-break:break-word;padding:10px;font-family:arial,helvetica,sans-serif;" align="left">
        <div style="font-size: 14px; line-height: 1.4;  text-align: left; word-wrap: break-word;">';

  shared_body_close text := '</div>
      </td>
    </tr></tbody>
  </table>
  <!--[if (!mso)&(!IE)]><!--></div><!--<![endif]-->
  </div>
</div>
<!--[if (mso)|(IE)]></td></tr></table></td><![endif]-->
      <!--[if (mso)|(IE)]></tr></table></td></tr></table><![endif]-->
    </div>
  </div>
</div>';

  shared_footer text := '<div class="u-row-container" style="padding: 1px;background-color: transparent;">
  <div class="u-row" style="margin: 0 auto;min-width: 320px;max-width: 500px;overflow-wrap: break-word;word-wrap: break-word;word-break: break-word;background-color: transparent;">
    <div style="border-collapse: collapse;display: table;width: 100%;height: 100%;background-color: transparent;">
      <!--[if (mso)|(IE)]><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding: 1px;background-color: transparent;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr style="background-color: transparent;"><![endif]-->
<!--[if (mso)|(IE)]><td align="center" width="500" style="background-color: #eaeaea;width: 500px;border-top: 0px solid transparent;border-left: 0px solid transparent;border-right: 0px solid transparent;border-bottom: 0px solid transparent;border-radius: 0px;-webkit-border-radius: 0px; -moz-border-radius: 0px;" valign="top"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding: 0px;"><![endif]-->
<div class="u-col u-col-100" style="max-width: 320px;min-width: 500px;display: table-cell;vertical-align: top;">
  <div style="background-color: #eaeaea;height: 100%;width: 100% !important;border-radius: 0px;-webkit-border-radius: 0px; -moz-border-radius: 0px;">
  <!--[if (!mso)&(!IE)]><!--><div style="box-sizing: border-box; height: 100%; padding: 0px;border-top: 0px solid transparent;border-left: 0px solid transparent;border-right: 0px solid transparent;border-bottom: 0px solid transparent;border-radius: 0px;-webkit-border-radius: 0px; -moz-border-radius: 0px;"><!--<![endif]-->
  <table style="font-family:arial,helvetica,sans-serif;" role="presentation" cellpadding="0" cellspacing="0" width="100%" border="0">
    <tbody><tr>
      <td style="overflow-wrap:break-word;word-break:break-word;padding:10px;font-family:arial,helvetica,sans-serif;" align="left">
        <div style="font-size: 11px; color: #000000; line-height: 1.4;  text-align: center; word-wrap: break-word;">
          <p><span>{{business_name}}</span><span> - </span><span>{{contact_phone}}</span><span> - </span><span>{{contact_email}}</span></p>
        </div>
      </td>
    </tr></tbody>
  </table>
  <!--[if (!mso)&(!IE)]><!--></div><!--<![endif]-->
  </div>
</div>
<!--[if (mso)|(IE)]></td></tr></table></td><![endif]-->
      <!--[if (mso)|(IE)]></tr></table></td></tr></table><![endif]-->
    </div>
  </div>
</div>
    <!--[if (mso)|(IE)]></td></tr></table></td></tr></table><![endif]-->
    </td>
  </tr>
  </tbody>
  </table>
  <!--[if mso]></div><![endif]-->
  <!--[if IE]></div><![endif]-->
</body>
</html>';

BEGIN

  -- Booking Cancelled
  UPDATE email_templates SET body = shared_head || shared_body_open ||
    '<p><span>Hi </span><span>{{guest_first_name}}</span><span>,</span></p><p><br></p><p><span>We are writing to confirm that your booking has been cancelled.</span></p><p><br></p><p><span style="font-weight: bold">Room</span><span>: </span><span>{{room_name}}</span></p><p><span style="font-weight: bold">Check-in</span><span>: </span><span>{{check_in_date}}</span></p><p><span style="font-weight: bold">Check-out</span><span>: </span><span>{{check_out_date}}</span></p><p><br></p><p><span>If a refund is due based on our cancellation policy, it will be processed within 5&#8211;10 business days.</span></p><p><br></p><p><span>We hope to have the opportunity to host you in the future. If you have any questions, please reach out.</span></p><p><br></p><p><span>Sincerely,</span></p><p><span>{{business_name}}</span></p>'
    || shared_body_close || shared_footer
  WHERE name = 'Booking Cancelled';

  -- Booking Pending
  UPDATE email_templates SET body = shared_head || shared_body_open ||
    '<p><span>Hi </span><span>{{guest_first_name}}</span><span>,</span></p><p><br></p><p><span>Thank you for your booking request! We have received it and will confirm your reservation shortly.</span></p><p><br></p><p><span style="font-weight: bold">Room</span><span>: </span><span>{{room_name}}</span></p><p><span style="font-weight: bold">Check-in</span><span>: </span><span>{{check_in_date}}</span></p><p><span style="font-weight: bold">Check-out</span><span>: </span><span>{{check_out_date}}</span></p><p><span style="font-weight: bold">Nights</span><span>: </span><span>{{total_nights}}</span></p><p><span style="font-weight: bold">Total</span><span>: </span><span>{{total_amount}}</span></p><p><br></p><p><span>If you have any questions in the meantime, feel free to reach out.</span></p><p><br></p><p><span>Warm regards,</span></p><p><span>{{business_name}}</span></p>'
    || shared_body_close || shared_footer
  WHERE name = 'Booking Pending';

  -- Check-in Reminder
  UPDATE email_templates SET body = shared_head || shared_body_open ||
    '<p><span>Hi </span><span>{{guest_first_name}}</span><span>,</span></p><p><br></p><p><span>Your stay at </span><span>{{room_name}}</span><span> is just around the corner! Here is everything you need to know before you arrive.</span></p><p><br></p><p><span style="font-weight: bold">Check-in</span><span>: </span><span>{{check_in_date}}</span><span> at </span><span>{{checkin_time}}</span></p><p><span style="font-weight: bold">Check-out</span><span>: </span><span>{{check_out_date}}</span><span> at </span><span>{{checkout_time}}</span></p><p><span style="font-weight: bold">Address</span><span>: </span><span>{{property_address}}</span></p><p><br></p><p><span style="font-weight: bold">House Rules</span></p><p><span>{{house_rules}}</span></p><p><br></p><p><span>If you have any questions before you arrive, give us a call.</span></p><p><br></p><p><span>See you soon,</span></p><p><span>{{business_name}}</span></p>'
    || shared_body_close || shared_footer
  WHERE name = 'Check-in Reminder';

  -- Check-out Reminder
  UPDATE email_templates SET body = shared_head || shared_body_open ||
    '<p><span>Hi </span><span>{{guest_first_name}}</span><span>,</span></p><p><br></p><p><span>Just a friendly reminder that your check-out from </span><span>{{room_name}}</span><span> is tomorrow.</span></p><p><br></p><p><span style="font-weight: bold">Check-out</span><span>: </span><span>{{check_out_date}}</span><span> by </span><span>{{checkout_time}}</span></p><p><br></p><p><span>Please ensure the room is left in good order and return any keys before departing. If you need a late check-out, reach out and we will do our best to accommodate.</span></p><p><br></p><p><span>It has been a pleasure having you,</span></p><p><span>{{business_name}}</span></p>'
    || shared_body_close || shared_footer
  WHERE name = 'Check-out Reminder';

  -- Contact Form Submitted
  UPDATE email_templates SET body = shared_head || shared_body_open ||
    '<p><span>Hi </span><span>{{contact_name}}</span><span>,</span></p><p><br></p><p><span>Thank you for reaching out to </span><span>{{business_name}}</span><span>! We have received your message and will get back to you as soon as possible.</span></p><p><br></p><p><span style="font-weight: bold">Your Message</span></p><p><span>{{contact_message}}</span></p><p><br></p><p><span>In the meantime, feel free to contact us directly:</span></p><p><span style="font-weight: bold">Phone</span><span>: </span><span>{{contact_phone}}</span></p><p><span style="font-weight: bold">Email</span><span>: </span><span>{{contact_email}}</span></p><p><br></p><p><span>Talk soon,</span></p><p><span>{{business_name}}</span></p>'
    || shared_body_close || shared_footer
  WHERE name = 'Contact Form Submitted';

  -- Modification Requested
  UPDATE email_templates SET body = shared_head || shared_body_open ||
    '<p><span>Hi </span><span>{{guest_first_name}}</span><span>,</span></p><p><br></p><p><span>We have received your request to modify your booking for </span><span>{{room_name}}</span><span>. Our team will review it and get back to you shortly.</span></p><p><br></p><p><span>If you need to make any changes or have questions in the meantime, please do not hesitate to contact us.</span></p><p><br></p><p><span>Warm regards,</span></p><p><span>{{business_name}}</span></p>'
    || shared_body_close || shared_footer
  WHERE name = 'Modification Requested';

  -- Post Checkout
  UPDATE email_templates SET body = shared_head || shared_body_open ||
    '<p><span>Hi </span><span>{{guest_first_name}}</span><span>,</span></p><p><br></p><p><span>We hope you had a wonderful stay at </span><span>{{room_name}}</span><span>! It was truly a pleasure hosting you.</span></p><p><br></p><p><span>We would love to have you back anytime. If there is anything we can do to make your next visit even better, please do not hesitate to let us know.</span></p><p><br></p><p><span>Until next time,</span></p><p><span>{{business_name}}</span></p>'
    || shared_body_close || shared_footer
  WHERE name = 'Post Checkout';

  -- Review Request
  UPDATE email_templates SET body = shared_head || shared_body_open ||
    '<p><span>Hi </span><span>{{guest_first_name}}</span><span>,</span></p><p><br></p><p><span>We hope you are settling back in after your stay at </span><span>{{room_name}}</span><span>. We would be so grateful if you could take a moment to share your experience!</span></p><p><br></p><p><span>Your review helps future guests make informed decisions and supports our small business &#8212; it means the world to us.</span></p><p><br></p><p><a href="{{review_url}}" style="display:inline-block;background:#0d9488;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:6px;font-weight:600;font-size:14px;">Leave a Review</a></p><p><br></p><p><span>With gratitude,</span></p><p><span>{{business_name}}</span></p>'
    || shared_body_close || shared_footer
  WHERE name = 'Review Request';

  -- Admin — New Booking
  UPDATE email_templates SET body = shared_head || shared_body_open ||
    '<p><span>A new booking has been received.</span></p><p><br></p><p><span style="font-weight: bold">Guest Name</span><span>: </span><span>{{guest_first_name}} {{guest_last_name}}</span></p><p><span style="font-weight: bold">Email</span><span>: </span><span>{{guest_email}}</span></p><p><span style="font-weight: bold">Phone</span><span>: </span><span>{{guest_phone}}</span></p><p><br></p><p><span style="font-weight: bold">Room</span><span>: </span><span>{{room_name}}</span></p><p><span style="font-weight: bold">Type</span><span>: </span><span>{{booking_type}}</span></p><p><span style="font-weight: bold">Check-in</span><span>: </span><span>{{check_in_date}}</span></p><p><span style="font-weight: bold">Check-out</span><span>: </span><span>{{check_out_date}}</span></p><p><span style="font-weight: bold">Nights</span><span>: </span><span>{{total_nights}}</span></p><p><span style="font-weight: bold">Total</span><span>: </span><span>{{total_amount}}</span></p>'
    || shared_body_close || shared_footer
  WHERE name = 'Admin — New Booking';

  -- Admin — Booking Cancelled
  UPDATE email_templates SET body = shared_head || shared_body_open ||
    '<p><span>A booking has been cancelled.</span></p><p><br></p><p><span style="font-weight: bold">Guest Name</span><span>: </span><span>{{guest_first_name}} {{guest_last_name}}</span></p><p><span style="font-weight: bold">Email</span><span>: </span><span>{{guest_email}}</span></p><p><span style="font-weight: bold">Phone</span><span>: </span><span>{{guest_phone}}</span></p><p><br></p><p><span style="font-weight: bold">Room</span><span>: </span><span>{{room_name}}</span></p><p><span style="font-weight: bold">Check-in</span><span>: </span><span>{{check_in_date}}</span></p><p><span style="font-weight: bold">Check-out</span><span>: </span><span>{{check_out_date}}</span></p><p><span style="font-weight: bold">Total</span><span>: </span><span>{{total_amount}}</span></p>'
    || shared_body_close || shared_footer
  WHERE name = 'Admin — Booking Cancelled';

END $$;
