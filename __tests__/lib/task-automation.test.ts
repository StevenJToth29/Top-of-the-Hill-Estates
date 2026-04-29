/**
 * @jest-environment node
 */

jest.mock('@/lib/supabase', () => ({
  createServiceRoleClient: jest.fn(),
}))

import { createServiceRoleClient } from '@/lib/supabase'
import {
  addDays,
  resolveAutomations,
  generateTasksForBooking,
  cleanupTasksForCancelledBooking,
} from '@/lib/task-automation'
import type { TaskAutomation } from '@/types'

// ── helpers ───────────────────────────────────────────────────────────────────

/** Build a minimal TaskAutomation fixture */
function makeRule(overrides: Partial<TaskAutomation> = {}): TaskAutomation {
  return {
    id: 'rule-1',
    scope_type: 'global',
    room_id: null,
    property_id: null,
    trigger_event: 'checkout',
    title: 'Clean Room',
    description: null,
    day_offset: 0,
    color: null,
    assignee_id: null,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

/**
 * Build a chainable Supabase-like mock.
 *
 * Each method in the chain returns `this` so callers can continue chaining.
 * Awaiting the chain resolves to `resolveValue`.
 *
 * For a single() call we also attach `.single` that resolves to `singleValue`.
 */
function makeChain(
  resolveValue: { data: unknown; error: null | Error },
  singleValue?: { data: unknown; error: null | Error },
) {
  const chain: Record<string, jest.Mock> = {}
  const methods = ['select', 'eq', 'neq', 'not', 'insert', 'update', 'delete']
  for (const m of methods) {
    chain[m] = jest.fn().mockReturnThis()
  }
  // Make awaiting the chain itself resolve to resolveValue
  ;(chain as unknown as { then: unknown }).then = (
    resolve: (v: unknown) => unknown,
    reject: (e: unknown) => unknown,
  ) => Promise.resolve(resolveValue).then(resolve, reject)

  chain['single'] = jest.fn().mockResolvedValue(singleValue ?? resolveValue)
  return chain
}

// ── addDays ───────────────────────────────────────────────────────────────────

describe('addDays', () => {
  it('returns the same date when offset is 0', () => {
    expect(addDays('2026-05-01', 0)).toBe('2026-05-01')
  })

  it('adds a positive offset', () => {
    expect(addDays('2026-05-01', 3)).toBe('2026-05-04')
  })

  it('subtracts when offset is negative', () => {
    expect(addDays('2026-05-03', -2)).toBe('2026-05-01')
  })

  it('rolls over month boundary correctly', () => {
    expect(addDays('2026-01-30', 3)).toBe('2026-02-02')
  })
})

// ── resolveAutomations ────────────────────────────────────────────────────────

describe('resolveAutomations', () => {
  function buildSupabase(
    roomRules: TaskAutomation[],
    propertyRules: TaskAutomation[],
    globalRules: TaskAutomation[],
  ) {
    // Each call to .from() returns a fresh chain whose resolution depends on
    // how many times from() has been called (room → property → global order).
    let callCount = 0
    const results = [
      { data: roomRules, error: null },
      { data: propertyRules, error: null },
      { data: globalRules, error: null },
    ]
    const from = jest.fn(() => {
      const result = results[callCount] ?? { data: [], error: null }
      callCount++
      return makeChain(result)
    })
    return { from } as unknown as ReturnType<typeof createServiceRoleClient>
  }

  it('returns room rules and stops when room rules exist', async () => {
    const roomRule = makeRule({ id: 'r1', scope_type: 'room', room_id: 'room-1' })
    const supabase = buildSupabase([roomRule], [], [])
    const result = await resolveAutomations(supabase, 'room-1', 'prop-1', 'checkout')
    expect(result).toEqual([roomRule])
    // Only one from() call — no property or global lookup
    expect((supabase.from as jest.Mock).mock.calls.length).toBe(1)
  })

  it('falls back to property rules when no room rules exist', async () => {
    const propRule = makeRule({ id: 'p1', scope_type: 'property', property_id: 'prop-1' })
    const supabase = buildSupabase([], [propRule], [])
    const result = await resolveAutomations(supabase, 'room-1', 'prop-1', 'checkout')
    expect(result).toEqual([propRule])
    expect((supabase.from as jest.Mock).mock.calls.length).toBe(2)
  })

  it('falls back to global rules when no room or property rules exist', async () => {
    const globalRule = makeRule({ id: 'g1', scope_type: 'global' })
    const supabase = buildSupabase([], [], [globalRule])
    const result = await resolveAutomations(supabase, 'room-1', 'prop-1', 'checkout')
    expect(result).toEqual([globalRule])
    expect((supabase.from as jest.Mock).mock.calls.length).toBe(3)
  })

  it('returns empty array when no rules exist at any level', async () => {
    const supabase = buildSupabase([], [], [])
    const result = await resolveAutomations(supabase, 'room-1', 'prop-1', 'checkout')
    expect(result).toEqual([])
  })
})

// ── generateTasksForBooking ───────────────────────────────────────────────────

describe('generateTasksForBooking', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns early when booking is not found', async () => {
    const from = jest.fn(() => makeChain({ data: null, error: null }, { data: null, error: null }))
    ;(createServiceRoleClient as jest.Mock).mockReturnValue({ from })

    await generateTasksForBooking('missing-id', 'booking_confirmed')

    // Only the initial bookings lookup should happen; no calendar_tasks insert
    const insertCalled = (from.mock.results as Array<{ value: ReturnType<typeof makeChain> }>).some(
      (r) => r.value.insert && (r.value.insert as jest.Mock).mock.calls.length > 0,
    )
    expect(insertCalled).toBe(false)
  })

  it('calls calendar_tasks insert when booking and rules exist', async () => {
    const booking = {
      id: 'booking-1',
      check_in: '2026-06-01',
      check_out: '2026-06-05',
      room_id: 'room-1',
      room: { property_id: 'prop-1' },
    }
    const rule = makeRule({ id: 'rule-1', scope_type: 'global', trigger_event: 'booking_confirmed' })

    // Track insert calls
    const insertMock = jest.fn().mockReturnThis()
    let callCount = 0

    const from = jest.fn((table: string) => {
      if (table === 'bookings') {
        return makeChain({ data: booking, error: null }, { data: booking, error: null })
      }
      if (table === 'task_automations') {
        callCount++
        // First call is room-level → empty; fall through to global
        if (callCount === 1) return makeChain({ data: [], error: null })
        if (callCount === 2) return makeChain({ data: [], error: null })
        return makeChain({ data: [rule], error: null })
      }
      if (table === 'calendar_tasks') {
        const chain = makeChain({ data: [], error: null })
        chain['insert'] = insertMock.mockReturnThis()
        ;(chain as unknown as { then: unknown }).then = (
          resolve: (v: unknown) => unknown,
          reject: (e: unknown) => unknown,
        ) => Promise.resolve({ error: null }).then(resolve, reject)
        return chain
      }
      return makeChain({ data: [], error: null })
    })

    ;(createServiceRoleClient as jest.Mock).mockReturnValue({ from })

    await generateTasksForBooking('booking-1', 'booking_confirmed')

    // calendar_tasks.insert should have been called
    expect(insertMock).toHaveBeenCalled()
  })
})

// ── cleanupTasksForCancelledBooking ───────────────────────────────────────────

describe('cleanupTasksForCancelledBooking', () => {
  beforeEach(() => jest.clearAllMocks())

  it('calls delete on calendar_tasks with the booking id', async () => {
    const deleteMock = jest.fn().mockReturnThis()
    const eqMock = jest.fn().mockReturnThis()
    const notMock = jest.fn().mockResolvedValue({ error: null })

    ;(createServiceRoleClient as jest.Mock).mockReturnValue({
      from: jest.fn(() => ({
        delete: deleteMock,
        eq: eqMock,
        not: notMock,
      })),
    })

    await cleanupTasksForCancelledBooking('booking-42')

    expect(deleteMock).toHaveBeenCalled()
    expect(eqMock).toHaveBeenCalledWith('source_booking_id', 'booking-42')
    expect(eqMock).toHaveBeenCalledWith('status', 'pending')
    expect(notMock).toHaveBeenCalledWith('automation_id', 'is', null)
  })
})
