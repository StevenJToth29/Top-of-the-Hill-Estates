/** @jest-environment node */

jest.mock('@/lib/stripe', () => ({
  stripe: {
    webhooks: {
      constructEvent: jest.fn(),
    },
  },
}))

jest.mock('@/lib/supabase', () => ({
  createServiceRoleClient: jest.fn(),
}))

jest.mock('@/lib/ghl', () => ({
  notifyGHLBookingConfirmed: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/email-queue', () => ({
  evaluateAndQueueEmails: jest.fn().mockResolvedValue(undefined),
  seedReminderEmails: jest.fn().mockResolvedValue(undefined),
}))

import { stripe } from '@/lib/stripe'
import { createServiceRoleClient } from '@/lib/supabase'
import { evaluateAndQueueEmails, seedReminderEmails } from '@/lib/email-queue'
import { POST } from '@/app/api/stripe/webhook/route'

function makeRequest(body = '{}', signature = 'valid-sig') {
  return new Request('http://localhost/api/stripe/webhook', {
    method: 'POST',
    headers: { 'stripe-signature': signature },
    body,
  })
}

function makeStripeEvent(type: string, data: Record<string, unknown>) {
  return { type, data: { object: data } }
}

/**
 * Creates a chainable, thenable Supabase mock chain.
 *
 * Routes like payment_intent.payment_failed end their DB chain with .eq() rather than .single(),
 * so the chain must implement .then/.catch to resolve correctly when awaited.
 */
function makeChain(result: { data: unknown; error: unknown }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {}
  for (const m of ['select', 'eq', 'neq', 'in', 'gte', 'lt', 'not', 'order', 'limit', 'update', 'upsert', 'insert']) {
    chain[m] = jest.fn().mockReturnValue(chain)
  }
  chain.single = jest.fn().mockResolvedValue(result)
  chain.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject)
  chain.catch = (reject: (e: unknown) => unknown) =>
    Promise.resolve(result).catch(reject)
  return chain
}

function setupSupabaseMock(overrides: Partial<{
  bookingData: Record<string, unknown> | null
  updateError: unknown
}> = {}) {
  const { bookingData = { id: 'booking-1', amount_paid: 100 }, updateError = null } = overrides
  const chain = makeChain({ data: bookingData, error: updateError })

  ;(createServiceRoleClient as jest.Mock).mockReturnValue({
    from: jest.fn(() => chain),
  })

  return chain
}

describe('POST /api/stripe/webhook — signature verification', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 400 when the Stripe signature is invalid', async () => {
    ;(stripe.webhooks.constructEvent as jest.Mock).mockImplementation(() => {
      throw new Error('Invalid signature')
    })

    const res = await POST(makeRequest('{}', 'bad-sig'))
    expect(res.status).toBe(400)
    const text = await res.text()
    expect(text).toMatch(/signature verification failed/i)
  })
})

describe('POST /api/stripe/webhook — payment_intent.succeeded', () => {
  beforeEach(() => jest.clearAllMocks())

  it('confirms the booking and sets amount_paid from amount_received', async () => {
    const chain = setupSupabaseMock({ bookingData: { id: 'booking-1' } })

    ;(stripe.webhooks.constructEvent as jest.Mock).mockReturnValue(
      makeStripeEvent('payment_intent.succeeded', {
        id: 'pi_test',
        amount: 50000,
        amount_received: 50000,
      }),
    )

    const res = await POST(makeRequest())
    expect(res.status).toBe(200)

    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'confirmed',
        amount_paid: 500, // 50000 cents / 100
      }),
    )
  })

  it('queues booking_confirmed and admin_new_booking emails after confirmation', async () => {
    setupSupabaseMock({ bookingData: { id: 'booking-1' } })

    ;(stripe.webhooks.constructEvent as jest.Mock).mockReturnValue(
      makeStripeEvent('payment_intent.succeeded', {
        id: 'pi_test',
        amount: 50000,
        amount_received: 50000,
      }),
    )

    await POST(makeRequest())
    await Promise.resolve()

    expect(evaluateAndQueueEmails).toHaveBeenCalledWith(
      'booking_confirmed',
      expect.objectContaining({ bookingId: 'booking-1' }),
    )
    expect(evaluateAndQueueEmails).toHaveBeenCalledWith(
      'admin_new_booking',
      expect.objectContaining({ bookingId: 'booking-1' }),
    )
  })

  it('seeds reminder emails after confirmation', async () => {
    setupSupabaseMock({ bookingData: { id: 'booking-1' } })

    ;(stripe.webhooks.constructEvent as jest.Mock).mockReturnValue(
      makeStripeEvent('payment_intent.succeeded', {
        id: 'pi_test',
        amount: 50000,
        amount_received: 50000,
      }),
    )

    await POST(makeRequest())
    await Promise.resolve()

    expect(seedReminderEmails).toHaveBeenCalledWith('booking-1')
  })

  it('returns 500 when the DB update fails', async () => {
    setupSupabaseMock({ bookingData: null, updateError: { message: 'db error' } })

    ;(stripe.webhooks.constructEvent as jest.Mock).mockReturnValue(
      makeStripeEvent('payment_intent.succeeded', {
        id: 'pi_test',
        amount: 50000,
        amount_received: 50000,
      }),
    )

    const res = await POST(makeRequest())
    expect(res.status).toBe(500)
  })
})

describe('POST /api/stripe/webhook — payment_intent.payment_failed', () => {
  beforeEach(() => jest.clearAllMocks())

  it('cancels the booking with reason payment_failed', async () => {
    const chain = setupSupabaseMock()

    ;(stripe.webhooks.constructEvent as jest.Mock).mockReturnValue(
      makeStripeEvent('payment_intent.payment_failed', { id: 'pi_test' }),
    )

    const res = await POST(makeRequest())
    expect(res.status).toBe(200)

    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'cancelled',
        cancellation_reason: 'payment_failed',
      }),
    )
  })

  it('returns 500 when the DB cancellation update fails', async () => {
    setupSupabaseMock({ updateError: { message: 'db error' } })

    ;(stripe.webhooks.constructEvent as jest.Mock).mockReturnValue(
      makeStripeEvent('payment_intent.payment_failed', { id: 'pi_test' }),
    )

    const res = await POST(makeRequest())
    expect(res.status).toBe(500)
  })
})

describe('POST /api/stripe/webhook — checkout.session.completed (standard)', () => {
  beforeEach(() => jest.clearAllMocks())

  it('confirms the booking and sets amount_paid when payment_status is paid', async () => {
    const chain = setupSupabaseMock()

    ;(stripe.webhooks.constructEvent as jest.Mock).mockReturnValue(
      makeStripeEvent('checkout.session.completed', {
        id: 'cs_test',
        payment_intent: 'pi_test',
        payment_status: 'paid',
        amount_total: 51480,
        metadata: {},
      }),
    )

    const res = await POST(makeRequest())
    expect(res.status).toBe(200)

    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'confirmed',
        amount_paid: 514.80,
        stripe_session_id: 'cs_test',
      }),
    )
  })

  it('updates stripe_session_id but does NOT set confirmed when payment is not paid', async () => {
    const chain = setupSupabaseMock()

    ;(stripe.webhooks.constructEvent as jest.Mock).mockReturnValue(
      makeStripeEvent('checkout.session.completed', {
        id: 'cs_test',
        payment_intent: 'pi_test',
        payment_status: 'unpaid',
        amount_total: 51480,
        metadata: {},
      }),
    )

    const res = await POST(makeRequest())
    expect(res.status).toBe(200)

    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ stripe_session_id: 'cs_test' }),
    )
    expect(chain.update).toHaveBeenCalledWith(
      expect.not.objectContaining({ status: 'confirmed' }),
    )
  })

  it('is a no-op when payment_intent is missing from the session', async () => {
    const chain = setupSupabaseMock()

    ;(stripe.webhooks.constructEvent as jest.Mock).mockReturnValue(
      makeStripeEvent('checkout.session.completed', {
        id: 'cs_test',
        payment_intent: null,
        payment_status: 'paid',
        amount_total: 51480,
        metadata: {},
      }),
    )

    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    expect(chain.update).not.toHaveBeenCalled()
  })
})

describe('POST /api/stripe/webhook — checkout.session.completed (additional charge)', () => {
  beforeEach(() => jest.clearAllMocks())

  it('increments amount_paid for booking_edit_additional_charge sessions', async () => {
    const chain = setupSupabaseMock({ bookingData: { id: 'booking-1', amount_paid: 200 } })

    ;(stripe.webhooks.constructEvent as jest.Mock).mockReturnValue(
      makeStripeEvent('checkout.session.completed', {
        id: 'cs_extra',
        payment_intent: 'pi_extra',
        payment_status: 'paid',
        amount_total: 5000, // $50 additional charge
        metadata: { type: 'booking_edit_additional_charge', booking_id: 'booking-1' },
      }),
    )

    const res = await POST(makeRequest())
    expect(res.status).toBe(200)

    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        amount_paid: 250, // 200 + 50
        amount_due_at_checkin: 0,
      }),
    )
  })
})

describe('POST /api/stripe/webhook — unknown event type', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 200 OK and takes no action for unrecognised event types', async () => {
    const chain = setupSupabaseMock()

    ;(stripe.webhooks.constructEvent as jest.Mock).mockReturnValue(
      makeStripeEvent('customer.created', { id: 'cus_test' }),
    )

    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).toBe('OK')
    expect(chain.update).not.toHaveBeenCalled()
  })
})
