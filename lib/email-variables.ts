export interface VariableDef {
  key: string
  label: string
}

export interface VariableGroup {
  label: string
  variables: VariableDef[]
}

export const VARIABLE_GROUPS: VariableGroup[] = [
  {
    label: 'Guest',
    variables: [
      { key: 'guest_first_name', label: 'First name' },
      { key: 'guest_last_name', label: 'Last name' },
      { key: 'guest_email', label: 'Email' },
      { key: 'guest_phone', label: 'Phone' },
    ],
  },
  {
    label: 'Booking',
    variables: [
      { key: 'booking_id', label: 'Booking ID (full)' },
      { key: 'booking_reference', label: 'Booking reference #' },
      { key: 'check_in_date', label: 'Check-in date' },
      { key: 'check_out_date', label: 'Check-out date' },
      { key: 'total_nights', label: 'Nights' },
      { key: 'total_amount', label: 'Total amount' },
      { key: 'room_name', label: 'Room name' },
      { key: 'property_name', label: 'Property name' },
      { key: 'booking_type', label: 'Booking type' },
      { key: 'decline_reason', label: 'Decline reason' },
      { key: 'application_deadline_hours', label: 'Hours until application deadline' },
    ],
  },
  {
    label: 'Property',
    variables: [
      { key: 'property_address', label: 'Address' },
      { key: 'checkin_time', label: 'Check-in time' },
      { key: 'checkout_time', label: 'Check-out time' },
      { key: 'house_rules', label: 'House rules' },
    ],
  },
  {
    label: 'Site',
    variables: [
      { key: 'business_name', label: 'Business name' },
      { key: 'contact_phone', label: 'Contact phone' },
      { key: 'contact_email', label: 'Contact email' },
      { key: 'review_url', label: 'Review URL' },
    ],
  },
  {
    label: 'Contact Form',
    variables: [
      { key: 'contact_name', label: 'Submitter name' },
      { key: 'contact_email', label: 'Submitter email' },
      { key: 'contact_phone', label: 'Submitter phone' },
      { key: 'contact_message', label: 'Message' },
    ],
  },
]

export const SAMPLE_VARIABLES: Record<string, string> = {
  guest_first_name: 'Jane',
  guest_last_name: 'Smith',
  guest_email: 'jane.smith@example.com',
  guest_phone: '(555) 234-5678',
  booking_id: 'BK-2024-001',
  booking_reference: 'BK2024001',
  check_in_date: 'Friday, June 6, 2025',
  check_out_date: 'Monday, June 9, 2025',
  total_nights: '3',
  total_amount: '$450.00',
  room_name: 'Garden Suite',
  property_name: 'Top of the Hill Estates',
  booking_type: 'short_term',
  property_address: '123 Hill Crest Rd, Anytown, CA 90210',
  checkin_time: '3:00 PM',
  checkout_time: '11:00 AM',
  house_rules: 'No smoking. No parties.',
  business_name: 'Top of the Hill Estates',
  contact_phone: '(555) 123-4567',
  contact_email: 'info@topofthehill.com',
  review_url: 'https://g.page/r/example-review',
  contact_name: 'John Doe',
  contact_message: "I'm interested in booking for a family visit next month.",
  decline_reason: 'We are unable to accommodate your request at this time.',
  application_deadline_hours: '24',
}

export function resolveVariables(
  text: string,
  variables: Record<string, string>,
): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    if (!(key in variables)) {
      console.warn(`[email-variables] Unknown variable: {{${key}}}`)
    }
    return variables[key] ?? ''
  })
}

export const TRIGGER_EVENT_LABELS: Record<string, string> = {
  booking_confirmed: 'Booking Confirmed',
  booking_pending: 'Booking Pending',
  booking_cancelled: 'Booking Cancelled',
  contact_submitted: 'Contact Form Submitted',
  checkin_reminder: 'Check-in Reminder',
  checkout_reminder: 'Check-out Reminder',
  post_checkout: 'Post-Checkout',
  review_request: 'Review Request',
  modification_requested: 'Modification Requested',
  admin_new_booking: 'Admin — New Booking',
  admin_cancelled: 'Admin — Booking Cancelled',
  application_needed: 'Application Needed',
  application_reminder_24h: 'Application Reminder (24h)',
  application_reminder_12h: 'Application Reminder (12h)',
  application_expired: 'Application Expired',
  booking_approved: 'Booking Approved',
  booking_declined: 'Booking Declined',
  booking_auto_declined: 'Booking Auto-Declined (Timeout)',
  admin_application_submitted: 'Admin — New Application Submitted',
  admin_application_overdue: 'Admin — Application Overdue',
  admin_missed_deadline: 'Admin — Missed Review Deadline',
}
