/**
 * @jest-environment node
 */
import { POST } from '@/app/api/cron/process-email-queue/route'
import { createServiceRoleClient } from '@/lib/supabase'
import { sendEmail } from '@/lib/email'

jest.mock('@/lib/supabase', () => ({ createServiceRoleClient: jest.fn() }))
jest.mock('@/lib/email', () => ({
  sendEmail: jest.fn(),
  resolveVariables: jest.requireActual('@/lib/email').resolveVariables,
}))

const mockCreateServiceClient = createServiceRoleClient as jest.Mock
const mockSendEmail = sendEmail as jest.Mock

function makeRequest() {
  return new Request('http://localhost/api/cron/process-email-queue', {
    method: 'POST',
    headers: { Authorization: `Bearer test-cron-secret` },
  })
}

beforeEach(() => {
  process.env.CRON_SECRET = 'test-cron-secret'
  jest.clearAllMocks()
})

function buildDbMock(rows: unknown[], settingsData: unknown = null) {
  const updateEq = jest.fn().mockResolvedValue({ error: null })

  const fromMap: Record<string, unknown> = {
    email_queue: {
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          lte: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({ data: rows, error: null }),
            }),
          }),
        }),
      }),
      update: jest.fn().mockReturnValue({ eq: updateEq }),
    },
    email_settings: {
      select: jest.fn().mockReturnValue({
        maybeSingle: jest.fn().mockResolvedValue({ data: settingsData, error: null }),
      }),
    },
  }

  return jest.fn().mockImplementation((table: string) => fromMap[table] ?? { update: jest.fn().mockReturnValue({ eq: updateEq }) })
}

describe('POST /api/cron/process-email-queue', () => {
  it('returns 401 without valid CRON_SECRET', async () => {
    const req = new Request('http://localhost/api/cron/process-email-queue', {
      method: 'POST',
      headers: { Authorization: 'Bearer wrong' },
    })
    const res = await POST(req as never)
    expect(res.status).toBe(401)
  })

  it('returns { processed: 0, failed: 0 } when queue is empty', async () => {
    mockCreateServiceClient.mockReturnValue({ from: buildDbMock([]) })
    const res = await POST(makeRequest() as never)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toEqual({ processed: 0, failed: 0 })
  })

  it('sends email and marks sent for a valid queue row', async () => {
    mockSendEmail.mockResolvedValue('resend-id-123')

    const row = {
      id: 'q-1',
      recipient_email: 'guest@example.com',
      resolved_variables: { guest_first_name: 'Alice' },
      attempts: 0,
      template: { subject: 'Hello {{guest_first_name}}', body: '<p>Hi {{guest_first_name}}</p>' },
    }

    const updateEq = jest.fn().mockResolvedValue({ error: null })
    const updateFn = jest.fn().mockReturnValue({ eq: updateEq })

    const fromMap: Record<string, unknown> = {
      email_queue: {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            lte: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({ data: [row], error: null }),
              }),
            }),
          }),
        }),
        update: updateFn,
      },
      email_settings: {
        select: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({
            data: { from_name: 'TOTH', from_email: 'noreply@example.com' },
            error: null,
          }),
        }),
      },
    }

    mockCreateServiceClient.mockReturnValue({
      from: jest.fn().mockImplementation((t: string) => fromMap[t]),
    })

    const res = await POST(makeRequest() as never)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.processed).toBe(1)
    expect(body.failed).toBe(0)
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'guest@example.com',
        subject: 'Hello Alice',
        html: '<p>Hi Alice</p>',
      }),
    )
  })

  it('increments attempts and marks failed after 3 failures', async () => {
    mockSendEmail.mockResolvedValue(null)

    const row = {
      id: 'q-2',
      recipient_email: 'guest@example.com',
      resolved_variables: {},
      attempts: 2,
      template: { subject: 'Test', body: '<p>Test</p>' },
    }

    const updateEq = jest.fn().mockResolvedValue({ error: null })
    const updateFn = jest.fn().mockReturnValue({ eq: updateEq })

    const fromMap: Record<string, unknown> = {
      email_queue: {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            lte: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({ data: [row], error: null }),
              }),
            }),
          }),
        }),
        update: updateFn,
      },
      email_settings: {
        select: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
      },
    }

    mockCreateServiceClient.mockReturnValue({
      from: jest.fn().mockImplementation((t: string) => fromMap[t]),
    })

    const res = await POST(makeRequest() as never)
    const body = await res.json()
    expect(body.failed).toBe(1)
    expect(updateFn).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed', attempts: 3 }),
    )
  })
})
