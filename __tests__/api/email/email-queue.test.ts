/**
 * @jest-environment node
 */
import { evaluateConditions, buildBookingVariables, buildContactVariables } from '@/lib/email-queue'
import type { ConditionBlock, Booking, Room, Property, SiteSettings, EmailSettings } from '@/types'

// ── evaluateConditions ────────────────────────────────────────────────────────

describe('evaluateConditions', () => {
  it('returns true for empty rules', () => {
    expect(evaluateConditions({ operator: 'AND', rules: [] }, {})).toBe(true)
  })

  it('eq: matches equal string value', () => {
    const block: ConditionBlock = {
      operator: 'AND',
      rules: [{ field: 'booking_type', op: 'eq', value: 'long_term' }],
    }
    expect(evaluateConditions(block, { booking_type: 'long_term' })).toBe(true)
    expect(evaluateConditions(block, { booking_type: 'short_term' })).toBe(false)
  })

  it('neq: rejects equal values', () => {
    const block: ConditionBlock = {
      operator: 'AND',
      rules: [{ field: 'booking_type', op: 'neq', value: 'long_term' }],
    }
    expect(evaluateConditions(block, { booking_type: 'short_term' })).toBe(true)
    expect(evaluateConditions(block, { booking_type: 'long_term' })).toBe(false)
  })

  it('gte: passes when value meets threshold', () => {
    const block: ConditionBlock = {
      operator: 'AND',
      rules: [{ field: 'total_nights', op: 'gte', value: 7 }],
    }
    expect(evaluateConditions(block, { total_nights: 7 })).toBe(true)
    expect(evaluateConditions(block, { total_nights: 10 })).toBe(true)
    expect(evaluateConditions(block, { total_nights: 6 })).toBe(false)
  })

  it('lt: passes when value is less', () => {
    const block: ConditionBlock = {
      operator: 'AND',
      rules: [{ field: 'total_nights', op: 'lt', value: 30 }],
    }
    expect(evaluateConditions(block, { total_nights: 7 })).toBe(true)
    expect(evaluateConditions(block, { total_nights: 30 })).toBe(false)
  })

  it('AND: requires all rules to pass', () => {
    const block: ConditionBlock = {
      operator: 'AND',
      rules: [
        { field: 'booking_type', op: 'eq', value: 'long_term' },
        { field: 'total_nights', op: 'gte', value: 7 },
      ],
    }
    expect(evaluateConditions(block, { booking_type: 'long_term', total_nights: 10 })).toBe(true)
    expect(evaluateConditions(block, { booking_type: 'long_term', total_nights: 3 })).toBe(false)
    expect(evaluateConditions(block, { booking_type: 'short_term', total_nights: 10 })).toBe(false)
  })

  it('OR: passes if any rule passes', () => {
    const block: ConditionBlock = {
      operator: 'OR',
      rules: [
        { field: 'booking_type', op: 'eq', value: 'long_term' },
        { field: 'total_nights', op: 'gte', value: 30 },
      ],
    }
    expect(evaluateConditions(block, { booking_type: 'short_term', total_nights: 30 })).toBe(true)
    expect(evaluateConditions(block, { booking_type: 'long_term', total_nights: 3 })).toBe(true)
    expect(evaluateConditions(block, { booking_type: 'short_term', total_nights: 7 })).toBe(false)
  })
})

// ── buildBookingVariables ─────────────────────────────────────────────────────

const mockProperty: Property = {
  id: 'prop-1',
  name: 'Hill Estates',
  address: '123 Hill Rd',
  city: 'Nashville',
  state: 'TN',
  zip: '37201',
  description: 'A nice property',
  images: [],
  amenities: [],
  bedrooms: 3,
  bathrooms: 2,
  created_at: '2024-01-01T00:00:00Z',
}

const mockRoom: Room & { property?: Property } = {
  id: 'room-1',
  property_id: 'prop-1',
  name: 'The Suite',
  slug: 'the-suite',
  description: 'Nice room',
  short_description: 'Nice',
  guest_capacity: 4,
  bedrooms: 2,
  bathrooms: 1,
  nightly_rate: 150,
  monthly_rate: 2500,
  minimum_nights_short_term: 2,
  minimum_nights_long_term: 30,
  images: [],
  amenities: [],
  house_rules: 'No smoking',
  is_active: true,
  show_nightly_rate: true,
  show_monthly_rate: true,
  cancellation_window_hours: 24,
  ical_export_token: 'token-abc',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  property: mockProperty,
}

const mockBooking: Booking = {
  id: 'booking-123',
  room_id: 'room-1',
  booking_type: 'short_term',
  guest_first_name: 'Alice',
  guest_last_name: 'Smith',
  guest_email: 'alice@example.com',
  guest_phone: '555-1234',
  check_in: '2025-06-01',
  check_out: '2025-06-08',
  total_nights: 7,
  nightly_rate: 150,
  monthly_rate: 2500,
  cleaning_fee: 75,
  security_deposit: 200,
  extra_guest_fee: 0,
  processing_fee: 25,
  guest_count: 2,
  total_amount: 350,
  amount_paid: 350,
  amount_due_at_checkin: 0,
  stripe_payment_intent_id: null,
  stripe_session_id: null,
  status: 'confirmed',
  cancellation_reason: null,
  cancelled_at: null,
  refund_amount: null,
  ghl_contact_id: null,
  sms_consent: false,
  marketing_consent: false,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

const mockSiteSettings: SiteSettings = {
  id: 'settings-1',
  about_text: 'Welcome',
  contact_phone: '615-555-9999',
  contact_email: 'info@hillestate.com',
  contact_address: '123 Hill Rd, Nashville TN',
  business_name: 'Top of the Hill Estates',
  checkin_time: '15:00',
  checkout_time: '11:00',
  global_house_rules: 'No parties',
  updated_at: '2024-01-01T00:00:00Z',
}

const mockEmailSettings: EmailSettings = {
  id: 'email-settings-1',
  from_name: 'Hill Estates',
  from_email: 'noreply@hillestate.com',
  admin_recipients: ['admin@hillestate.com'],
  review_url: 'https://g.page/r/review',
}

describe('buildBookingVariables', () => {
  it('returns expected fields for a short_term booking', () => {
    const vars = buildBookingVariables(mockBooking, mockRoom, mockSiteSettings, mockEmailSettings)

    expect(vars.guest_first_name).toBe('Alice')
    expect(vars.guest_last_name).toBe('Smith')
    expect(vars.guest_email).toBe('alice@example.com')
    expect(vars.guest_phone).toBe('555-1234')
    expect(vars.booking_id).toBe('booking-123')
    expect(vars.total_nights).toBe('7')
    expect(vars.total_amount).toBe('$350.00')
    expect(vars.room_name).toBe('The Suite')
    expect(vars.property_name).toBe('Hill Estates')
    expect(vars.booking_type).toBe('Short-Term')
    expect(vars.business_name).toBe('Top of the Hill Estates')
    expect(vars.review_url).toBe('https://g.page/r/review')
  })

  it('returns Long-Term for long_term booking_type', () => {
    const longTermBooking: Booking = { ...mockBooking, booking_type: 'long_term' }
    const vars = buildBookingVariables(longTermBooking, mockRoom, mockSiteSettings, mockEmailSettings)
    expect(vars.booking_type).toBe('Long-Term')
  })

  it('falls back to emailSettings for business_name when siteSettings is null', () => {
    const vars = buildBookingVariables(mockBooking, mockRoom, null, mockEmailSettings)
    expect(vars.business_name).toBe('Hill Estates')
  })

  it('falls back to emailSettings for review_url when emailSettings has it', () => {
    const vars = buildBookingVariables(mockBooking, mockRoom, mockSiteSettings, mockEmailSettings)
    expect(vars.review_url).toBe('https://g.page/r/review')
  })

  it('returns checkin_time and checkout_time when present in siteSettings', () => {
    const vars = buildBookingVariables(mockBooking, mockRoom, mockSiteSettings, mockEmailSettings)
    expect(vars.checkin_time).toBeTruthy()
    expect(vars.checkout_time).toBeTruthy()
  })
})

// ── buildContactVariables ─────────────────────────────────────────────────────

describe('buildContactVariables', () => {
  it('returns contact fields', () => {
    const vars = buildContactVariables(
      { name: 'Bob Jones', email: 'bob@example.com', phone: '555-4321', message: 'Hello there' },
      mockSiteSettings,
      mockEmailSettings,
    )

    expect(vars.contact_name).toBe('Bob Jones')
    expect(vars.contact_email).toBe('bob@example.com')
    expect(vars.contact_phone).toBe('555-4321')
    expect(vars.contact_message).toBe('Hello there')
  })

  it('returns empty string for missing phone', () => {
    const vars = buildContactVariables(
      { name: 'Bob Jones', email: 'bob@example.com', message: 'Hello there' },
      mockSiteSettings,
      mockEmailSettings,
    )

    expect(vars.contact_phone).toBe('')
  })
})
