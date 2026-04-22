/** @jest-environment node */

jest.mock('@/lib/ghl', () => ({
  syncLongTermInquiryToGHL: jest.fn().mockResolvedValue(undefined),
}))

import { syncLongTermInquiryToGHL } from '@/lib/ghl'
import { POST } from '@/app/api/inquiries/route'

function makeRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/inquiries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const validBody = {
  first_name: 'Jane',
  last_name: 'Smith',
  email: 'jane@example.com',
  phone: '5550000000',
  move_in: '2026-06-01',
  occupants: 2,
  room_slug: 'cozy-studio',
  room_name: 'Cozy Studio',
  property_name: 'Top of the Hill',
  sms_consent: true,
  marketing_consent: false,
}

describe('POST /api/inquiries', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 400 when first_name is missing', async () => {
    const res = await POST(makeRequest({ ...validBody, first_name: '' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('First name is required.')
  })

  it('returns 400 when last_name is missing', async () => {
    const res = await POST(makeRequest({ ...validBody, last_name: '' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Last name is required.')
  })

  it('returns 400 when email is invalid', async () => {
    const res = await POST(makeRequest({ ...validBody, email: 'not-an-email' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Valid email is required.')
  })

  it('returns 400 when phone has fewer than 10 digits', async () => {
    const res = await POST(makeRequest({ ...validBody, phone: '555123' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Valid phone number is required.')
  })

  it('returns 400 when move_in is missing', async () => {
    const res = await POST(makeRequest({ ...validBody, move_in: '' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Move-in date is required.')
  })

  it('returns 400 when occupants is less than 1', async () => {
    const res = await POST(makeRequest({ ...validBody, occupants: 0 }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Number of occupants is required.')
  })

  it('calls syncLongTermInquiryToGHL with correct shape and returns success', async () => {
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(syncLongTermInquiryToGHL).toHaveBeenCalledWith({
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane@example.com',
      phone: '5550000000',
      moveIn: '2026-06-01',
      occupants: 2,
      roomSlug: 'cozy-studio',
      roomName: 'Cozy Studio',
      propertyName: 'Top of the Hill',
      smsConsent: true,
      marketingConsent: false,
    })
  })

  it('returns 500 when syncLongTermInquiryToGHL throws', async () => {
    ;(syncLongTermInquiryToGHL as jest.Mock).mockRejectedValueOnce(new Error('GHL down'))
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toBe('Failed to submit inquiry. Please try again.')
  })
})
