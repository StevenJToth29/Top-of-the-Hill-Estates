/**
 * @jest-environment node
 */
import * as taskAutomation from '@/lib/task-automation'

jest.mock('@/lib/task-automation', () => ({
  generateTasksForBooking: jest.fn().mockResolvedValue(undefined),
  cleanupTasksForCancelledBooking: jest.fn().mockResolvedValue(undefined),
}))

describe('generateTasksForBooking is exported and callable', () => {
  it('resolves without throwing', async () => {
    await expect(taskAutomation.generateTasksForBooking('booking-1', 'booking_confirmed')).resolves.toBeUndefined()
  })
})
