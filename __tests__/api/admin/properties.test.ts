/** @jest-environment node */

jest.mock('@/lib/supabase', () => ({
  createServerSupabaseClient: jest.fn(),
  createServiceRoleClient: jest.fn(),
}))

import { createServiceRoleClient, createServerSupabaseClient } from '@/lib/supabase'
import { PATCH } from '@/app/api/admin/properties/route'

function mockAuthed() {
  ;(createServerSupabaseClient as jest.Mock).mockResolvedValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: 'user-1' } },
        error: null,
      }),
    },
  })
}

function mockDb(updateResult = { data: { id: 'prop-1' }, error: null }) {
  const eqChain = {
    select: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(updateResult),
  }
  const propertiesUpdate = jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue(eqChain) })
  ;(createServiceRoleClient as jest.Mock).mockReturnValue({
    from: jest.fn(() => ({ update: propertiesUpdate })),
  })
  return { propertiesUpdate }
}

describe('PATCH /api/admin/properties — partial update', () => {
  beforeEach(() => jest.clearAllMocks())

  it('only writes amenities when that is the only field sent', async () => {
    mockAuthed()
    const { propertiesUpdate } = mockDb()

    const req = new Request('http://localhost/api/admin/properties', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'prop-1', amenities: ['Pool', 'WiFi Included'] }),
    })

    await PATCH(req)

    const updateArg = propertiesUpdate.mock.calls[0][0]
    expect(updateArg).toEqual({ amenities: ['Pool', 'WiFi Included'] })
    expect(updateArg).not.toHaveProperty('name')
    expect(updateArg).not.toHaveProperty('address')
  })

  it('writes all fields when a full payload is sent', async () => {
    mockAuthed()
    const { propertiesUpdate } = mockDb()

    const req = new Request('http://localhost/api/admin/properties', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'prop-1',
        name: 'Hill House',
        address: '123 Main St',
        city: 'Phoenix',
        state: 'AZ',
        zip: '85001',
        description: 'Nice place',
        bedrooms: 4,
        bathrooms: 2,
        amenities: ['Pool'],
        house_rules: 'No smoking',
        use_global_house_rules: false,
        images: [],
        stripe_account_id: null,
        platform_fee_percent: 0,
        cancellation_policy: null,
        use_global_cancellation_policy: true,
      }),
    })

    await PATCH(req)

    const updateArg = propertiesUpdate.mock.calls[0][0]
    expect(updateArg.name).toBe('Hill House')
    expect(updateArg.amenities).toEqual(['Pool'])
    expect(updateArg.bedrooms).toBe(4)
  })

  it('preserves falsy values — false, 0, null — when explicitly sent', async () => {
    mockAuthed()
    const { propertiesUpdate } = mockDb()

    const req = new Request('http://localhost/api/admin/properties', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'prop-1',
        platform_fee_percent: 0,
        use_global_house_rules: false,
        stripe_account_id: null,
      }),
    })

    await PATCH(req)

    const updateArg = propertiesUpdate.mock.calls[0][0]
    expect(updateArg.platform_fee_percent).toBe(0)
    expect(updateArg.use_global_house_rules).toBe(false)
    expect(updateArg.stripe_account_id).toBeNull()
  })

  it('returns 401 when not authenticated', async () => {
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }) },
    })

    const req = new Request('http://localhost/api/admin/properties', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'prop-1', amenities: [] }),
    })

    const res = await PATCH(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 when id is missing', async () => {
    mockAuthed()
    mockDb()

    const req = new Request('http://localhost/api/admin/properties', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amenities: ['Pool'] }),
    })

    const res = await PATCH(req)
    expect(res.status).toBe(400)
  })
})
