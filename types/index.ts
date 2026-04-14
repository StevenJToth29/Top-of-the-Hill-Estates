export interface Property {
  id: string
  name: string
  address: string
  city: string
  state: string
  description: string
  images: string[]
  amenities: string[]
  bedrooms: number
  bathrooms: number
  created_at: string
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
  ical_export_token: string
  created_at: string
  updated_at: string
  // joined
  property?: Property
}

export type BookingType = 'short_term' | 'long_term'
export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed'

export interface Booking {
  id: string
  room_id: string
  booking_type: BookingType
  guest_first_name: string
  guest_last_name: string
  guest_email: string
  guest_phone: string
  check_in: string // ISO date string
  check_out: string // ISO date string
  total_nights: number
  nightly_rate: number
  monthly_rate: number
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
  created_at: string
  updated_at: string
  // joined
  room?: Room
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

export interface DayHours {
  open: string    // 'HH:mm' or ''
  close: string   // 'HH:mm' or ''
  closed: boolean
}

export type BusinessHours = Record<string, DayHours>

export interface SiteSettings {
  id: string
  about_text: string
  contact_phone: string
  contact_email: string
  contact_address: string
  business_name: string
  logo_url?: string
  business_hours?: string  // JSON-encoded BusinessHours
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
