const store = new Map<string, { count: number; windowStart: number }>()
const WINDOW_MS = 60_000
const MAX_STORE_SIZE = 10_000

/**
 * In-process rate limiter using a Map for counter storage.
 *
 * LIMITATION: In multi-instance or serverless deployments, each instance
 * maintains its own counter store, so distributed requests can bypass the
 * rate limit across instances. For production deployments at scale, consider
 * using a distributed solution like @upstash/ratelimit with Redis.
 */
export function checkRateLimit(ip: string, action: string, limit: number): boolean {
  if (process.env.NODE_ENV === 'test') return true
  const key = `${action}:${ip}`
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    store.set(key, { count: 1, windowStart: now })

    // Schedule cleanup of this entry after the window expires
    // This prevents the map from accumulating stale entries over time
    setTimeout(() => store.delete(key), WINDOW_MS * 2)

    // Prevent unbounded memory growth: if store exceeds max size, clear it
    if (store.size > MAX_STORE_SIZE) {
      store.clear()
    }

    return true
  }

  if (entry.count >= limit) return false

  entry.count++
  return true
}

export function getClientIp(request: Request): string {
  const headers = new Headers((request as unknown as { headers: Headers }).headers)
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    headers.get('x-real-ip') ??
    'unknown'
  )
}
