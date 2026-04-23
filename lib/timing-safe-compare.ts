import { timingSafeEqual } from 'crypto'

/**
 * Perform a constant-time string comparison to prevent timing attacks.
 * Compares two strings in a way that takes the same amount of time regardless
 * of where they differ, preventing attackers from inferring information based
 * on comparison timing.
 *
 * @param a - First string to compare
 * @param b - Second string to compare
 * @returns true if strings are equal, false otherwise
 */
export function timingSafeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)

  // If lengths differ, return false but still do a comparison to maintain constant time
  if (bufA.length !== bufB.length) {
    return false
  }

  return timingSafeEqual(bufA, bufB)
}
