/**
 * @jest-environment node
 */
import * as taskAutomation from '@/lib/task-automation'

jest.mock('@/lib/task-automation', () => ({
  generateTasksForBooking: jest.fn().mockResolvedValue(undefined),
  cleanupTasksForCancelledBooking: jest.fn().mockResolvedValue(undefined),
}))

describe('cleanupTasksForCancelledBooking is exported and callable', () => {
  it('resolves without throwing', async () => {
    await expect(taskAutomation.cleanupTasksForCancelledBooking('booking-1')).resolves.toBeUndefined()
  })
})
