/**
 * @jest-environment node
 */
import { GET } from '@/app/api/cron/generate-booking-tasks/route'
import { NextRequest } from 'next/server'

jest.mock('@/lib/supabase', () => ({ createServiceRoleClient: jest.fn() }))
jest.mock('@/lib/task-automation', () => ({
  generateTasksForDateTrigger: jest.fn().mockResolvedValue(undefined),
  generateTasksForICalBlock: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('@/lib/timing-safe-compare', () => ({ timingSafeCompare: jest.fn() }))

import { createServiceRoleClient } from '@/lib/supabase'
import { generateTasksForDateTrigger, generateTasksForICalBlock } from '@/lib/task-automation'
import { timingSafeCompare } from '@/lib/timing-safe-compare'

function makeReq(auth = 'Bearer test-secret') {
  return new NextRequest('http://localhost/api/cron/generate-booking-tasks', {
    headers: { Authorization: auth },
  })
}

const booking = {
  id: 'b-1', check_in: '2026-05-01', check_out: '2026-05-05',
  room_id: 'room-1', room: { property_id: 'prop-1' },
}
const icalBlock = {
  id: 'ical-1', start_date: '2026-05-02', end_date: '2026-05-06',
  room_id: 'room-1', room: { property_id: 'prop-1' },
}

describe('GET /api/cron/generate-booking-tasks', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 401 when auth fails', async () => {
    ;(timingSafeCompare as jest.Mock).mockReturnValue(false)
    const res = await GET(makeReq('bad'))
    expect(res.status).toBe(401)
  })

  it('calls generateTasksForDateTrigger for each booking and generateTasksForICalBlock for each iCal block', async () => {
    ;(timingSafeCompare as jest.Mock).mockReturnValue(true)
    // The route makes 4 parallel queries. Mock all of them to return the relevant fixture.
    ;(createServiceRoleClient as jest.Mock).mockReturnValue({
      from: jest.fn().mockImplementation((table: string) => ({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lte: jest.fn().mockResolvedValue({
                data: table === 'bookings' ? [booking] : [icalBlock],
                error: null,
              }),
            }),
          }),
          gte: jest.fn().mockReturnValue({
            lte: jest.fn().mockResolvedValue({
              data: table === 'bookings' ? [booking] : [icalBlock],
              error: null,
            }),
          }),
        }),
      })),
    })
    const res = await GET(makeReq())
    expect(res.status).toBe(200)
    expect(generateTasksForDateTrigger).toHaveBeenCalledWith(
      'b-1', 'checkin_day', '2026-05-01', '2026-05-05', 'room-1', 'prop-1',
    )
    expect(generateTasksForDateTrigger).toHaveBeenCalledWith(
      'b-1', 'checkout', '2026-05-01', '2026-05-05', 'room-1', 'prop-1',
    )
    expect(generateTasksForICalBlock).toHaveBeenCalledWith(
      'ical-1', 'checkin_day', '2026-05-02', '2026-05-06', 'room-1', 'prop-1',
    )
    expect(generateTasksForICalBlock).toHaveBeenCalledWith(
      'ical-1', 'checkout', '2026-05-02', '2026-05-06', 'room-1', 'prop-1',
    )
  })
})
