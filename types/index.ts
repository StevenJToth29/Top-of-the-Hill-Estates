export interface PropertyImage {
  url: string
  description?: string
}

export interface Property {
  id: string
  name: string
  address: string
  city: string
  state: string
  zip: string
  description: string
  images: PropertyImage[]
  amenities: string[]
  bedrooms: number
  bathrooms: number
  house_rules?: string
  use_global_house_rules?: boolean
  stripe_account_id?: string | null
  platform_fee_percent?: number
  cancellation_policy?: string | null
  use_global_cancellation_policy?: boolean
  trends_keyword?: string | null
  trends_geo?: string | null
  created_at: string
  // joined
  stripe_account?: StripeAccount | null
}

export interface Room {
  id: string
  property_id: string
  name: string
  slug: string
  description: string
  short_description: string
  guest_capacity: number
  bedrooms: number
  bathrooms: number
  nightly_rate: number
  monthly_rate: number
  minimum_nights_short_term: number
  minimum_nights_long_term: number
  images: string[]
  amenities: string[]
  house_rules: string
  is_active: boolean
  show_nightly_rate: boolean
  show_monthly_rate: boolean
  cleaning_fee?: number
  cleaning_fee_calculation_type?: 'fixed' | 'per_guest' | 'percent'
  cleaning_fee_booking_type?: 'short_term' | 'long_term' | 'both'
  security_deposit?: number
  security_deposit_calculation_type?: 'fixed' | 'per_guest' | 'percent'
  security_deposit_booking_type?: 'short_term' | 'long_term' | 'both'
  extra_guest_fee?: number
  extra_guest_fee_calculation_type?: 'fixed' | 'per_guest' | 'percent'
  extra_guest_fee_booking_type?: 'short_term' | 'long_term' | 'both'
  fees?: RoomFee[]
  cancellation_window_hours: number
  cancellation_policy?: string | null
  use_property_cancellation_policy?: boolean
  ical_export_token: string
  iframe_booking_url?: string | null
  airbnb_listing_id?: string | null
  max_advance_booking_days?: number | null
  max_advance_booking_applies_to?: 'short_term' | 'long_term' | 'both'
  price_min?: number | null
  price_max?: number | null
  smart_pricing_enabled?: boolean
  smart_pricing_aggressiveness?: 'conservative' | 'moderate' | 'aggressive'
  created_at: string
  updated_at: string
  // joined
  property?: Property
}

export interface GuestInfo {
  guest_first_name: string
  guest_last_name: string
  guest_email: string
  guest_phone: string
}

export type BookingType = 'short_term' | 'long_term'
export type BookingStatus = 'pending_payment' | 'pending' | 'pending_docs' | 'under_review' | 'confirmed' | 'cancelled' | 'completed' | 'expired'

export interface Booking {
  id: string
  room_id: string
  booking_type: BookingType
  guest_first_name: string
  guest_last_name: string
  guest_email: string
  guest_phone: string
  guest_address_street?: string | null
  guest_address_city?: string | null
  guest_address_state?: string | null
  guest_address_zip?: string | null
  check_in: string // ISO date string
  check_out: string // ISO date string
  total_nights: number
  nightly_rate: number
  monthly_rate: number
  cleaning_fee: number
  security_deposit: number
  extra_guest_fee: number
  processing_fee: number
  guest_count: number
  fees?: BookingFee[]
  total_amount: number
  amount_paid: number
  amount_due_at_checkin: number
  stripe_payment_intent_id: string | null
  stripe_session_id: string | null
  status: BookingStatus
  cancellation_reason: string | null
  cancelled_at: string | null
  refund_amount: number | null
  ghl_contact_id: string | null
  sms_consent: boolean
  marketing_consent: boolean
  source?: string | null
  notes?: string | null
  application_deadline?: string | null
  created_at: string
  updated_at: string
  // joined
  room?: Room
}

export interface BookingApplication {
  id: string
  booking_id: string
  purpose_of_stay: string
  traveling_from: string
  shared_living_exp: string
  house_rules_confirmed: boolean
  additional_info: string | null
  decision: 'approved' | 'declined' | null
  decline_reason: string | null
  submitted_at: string | null
  reviewed_at: string | null
  reviewed_by: string | null
  created_at: string
  updated_at: string
}

export interface GuestIdDocument {
  id: string
  application_id: string
  booking_id: string
  guest_index: number
  guest_name: string
  current_address: string
  id_photo_url: string | null
  ai_quality_result: 'pass' | 'fail_blurry' | 'fail_partial' | null
  ai_authenticity_flag: 'clear' | 'flagged' | 'uncertain' | null
  ai_validation_notes: string | null
  ai_validated_at: string | null
  created_at: string
}

// Shared shape for the /api/admin/applications list and the review panel
export interface ApplicationRow {
  id: string
  status: string
  check_in: string
  check_out: string
  guest_count: number
  guest_first_name: string
  guest_last_name: string
  guest_email: string
  total_amount: number
  application_deadline: string | null
  stripe_payment_intent_id: string
  room: { name: string; property: { name: string } } | null
  application: {
    id: string
    submitted_at?: string | null
    decision?: string | null
    purpose_of_stay?: string
    traveling_from?: string
    shared_living_exp?: string
    house_rules_confirmed?: boolean
    additional_info?: string | null
  } | null
  guest_id_documents: {
    id: string
    guest_index: number
    ai_quality_result: string | null
    ai_authenticity_flag: string | null
    ai_validation_notes?: string | null
    guest_name?: string | null
    current_address?: string | null
    id_photo_url?: string | null
    id_photo_signed_url?: string | null
  }[]
}

export interface ICalBlock {
  id: string
  room_id: string
  ical_source_url: string
  platform: string
  event_uid: string
  summary: string
  start_date: string
  end_date: string
  last_synced_at: string
  created_at: string
}

export interface ICalSource {
  id: string
  room_id: string
  platform: string
  ical_url: string
  is_active: boolean
  last_synced_at: string | null
  created_at: string
}

export interface RoomFee {
  id: string
  room_id: string
  label: string
  amount: number
  calculation_type: 'fixed' | 'per_guest' | 'percent'
  booking_type: 'short_term' | 'long_term' | 'both'
  created_at: string
}

export interface BookingFee {
  id: string
  booking_id: string
  label: string
  amount: number
  is_refundable: boolean
  created_at: string
}

export interface PaymentMethodConfig {
  id: string
  booking_type: BookingType
  method_key: string
  label: string
  is_enabled: boolean
  fee_percent: number
  fee_flat: number
  sort_order: number
}

export interface StripeAccount {
  id: string
  label: string
  stripe_account_id: string
  created_at: string
}

export interface BookingModificationRequest {
  id: string
  booking_id: string
  requested_check_in: string
  requested_check_out: string
  requested_guest_count: number
  requested_total_nights: number
  price_delta: number
  status: 'pending' | 'approved' | 'rejected'
  admin_note: string | null
  created_at: string
  updated_at: string
}

export interface DayHours {
  open: string    // 'HH:mm' or ''
  close: string   // 'HH:mm' or ''
  closed: boolean
}

export type BusinessHours = Record<string, DayHours>

export interface AiPrompts {
  system_prompt?: string
  property_description?: string
  room_description?: string
  short_description?: string
  about_us?: string
}

export interface SiteSettings {
  id: string
  about_text: string
  contact_phone: string
  contact_email: string
  contact_address: string
  business_name: string
  logo_url?: string
  logo_size?: number
  favicon_url?: string
  favicon_large_url?: string
  favicon_apple_url?: string
  business_hours?: string  // JSON-encoded BusinessHours
  global_house_rules?: string
  checkin_time?: string   // 24-hour "HH:mm", e.g. "15:00"
  checkout_time?: string  // 24-hour "HH:mm", e.g. "11:00"
  stripe_fee_percent?: number
  stripe_fee_flat?: number
  cancellation_policy?: string | null  // JSON-encoded CancellationPolicy
  ai_prompts?: string | null  // JSON-encoded AiPrompts
  updated_at: string
}

// For booking widget / checkout
export interface BookingParams {
  room_id: string
  room_slug: string
  booking_type: BookingType
  check_in: string
  check_out: string
  guests: number
  nightly_rate: number
  monthly_rate: number
  total_nights: number
  total_amount: number
  amount_to_pay: number
  amount_due_at_checkin: number
  cleaning_fee: number
  security_deposit: number
  extra_guest_fee: number
  fees: RoomFee[]
}

// Availability
export interface DateRange {
  start: string // ISO date
  end: string // ISO date
}

export interface AvailabilityResult {
  blocked_dates: string[] // ISO date strings
  bookings: DateRange[]
  ical_blocks: DateRange[]
}

// Refund calculation result
export interface RefundResult {
  refund_amount: number
  refund_percentage: number
  policy_description: string
}

export interface CancellationPolicy {
  full_refund_days: number       // cancel more than this many days out → 100% refund
  partial_refund_hours: number   // cancel more than this many hours out (within full window) → partial%
  partial_refund_percent: number // percentage refunded in the middle tier (0–100)
}

// ── Email system ──────────────────────────────────────────────────────────────

export type TriggerEvent =
  | 'booking_confirmed'
  | 'booking_pending'
  | 'booking_cancelled'
  | 'contact_submitted'
  | 'checkin_reminder'
  | 'checkout_reminder'
  | 'post_checkout'
  | 'review_request'
  | 'modification_requested'
  | 'admin_new_booking'
  | 'admin_cancelled'
  | 'booking_payment_request'
  | 'application_needed'
  | 'application_reminder_24h'
  | 'application_reminder_12h'
  | 'application_expired'
  | 'booking_approved'
  | 'booking_declined'
  | 'booking_auto_declined'
  | 'admin_application_submitted'
  | 'admin_application_overdue'
  | 'admin_missed_deadline'

export type RecipientType = 'guest' | 'admin' | 'both'
export type QueueStatus = 'pending' | 'sent' | 'failed' | 'cancelled'

export interface ConditionRule {
  field: string
  op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte'
  value: string | number | boolean
}

export interface ConditionBlock {
  operator: 'AND' | 'OR'
  rules: ConditionRule[]
}

export interface EmailTemplate {
  id: string
  name: string
  subject: string
  body: string
  design: Record<string, unknown> | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface EmailAutomation {
  id: string
  name: string
  trigger_event: TriggerEvent
  is_active: boolean
  delay_minutes: number
  conditions: ConditionBlock
  template_id: string | null
  recipient_type: RecipientType
  is_pre_planned: boolean
  created_at: string
  updated_at: string
}

export interface EmailQueue {
  id: string
  automation_id: string | null
  template_id: string | null
  booking_id: string | null
  recipient_email: string
  recipient_type: 'guest' | 'admin'
  send_at: string
  status: QueueStatus
  resolved_variables: Record<string, string>
  attempts: number
  error: string | null
  sent_at: string | null
  created_at: string
}

export interface EmailSettings {
  id: string
  from_name: string
  from_email: string
  admin_recipients: string[]
  review_url: string
}

// ── Calendar overrides & tasks ────────────────────────────────────────────────

export interface DateOverride {
  id: string
  room_id: string
  date: string            // ISO date "YYYY-MM-DD"
  price_override: number | null
  is_blocked: boolean
  block_reason: string | null
  note: string | null
  source?: 'manual' | 'smart'
  created_at: string
}

export interface CalendarTask {
  id: string
  room_id: string | null
  property_id: string | null
  title: string
  description: string | null
  due_date: string        // ISO date "YYYY-MM-DD"
  recurrence_rule: string | null   // iCal RRULE string
  recurrence_end_date: string | null
  status: 'pending' | 'complete'
  color: string | null
  created_at: string
  updated_at: string
}

export interface CalendarData {
  rooms: Room[]
  bookings: Booking[]
  icalBlocks: ICalBlock[]
  dateOverrides: DateOverride[]
  tasks: CalendarTask[]
}
