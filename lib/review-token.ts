import { createHmac, timingSafeEqual } from 'crypto'

function getSecret(): string {
  const s = process.env.REVIEW_SECRET
  if (!s) throw new Error('REVIEW_SECRET env var is not set')
  return s
}

export function generateReviewToken(bookingId: string): string {
  return createHmac('sha256', getSecret()).update(bookingId).digest('hex')
}

export function verifyReviewToken(bookingId: string, token: string): boolean {
  try {
    const expected = generateReviewToken(bookingId)
    const a = Buffer.from(expected, 'hex')
    const b = Buffer.from(token, 'hex')
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}
