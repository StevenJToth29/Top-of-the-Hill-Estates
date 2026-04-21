const store = new Map<string, { count: number; windowStart: number }>()
const WINDOW_MS = 60_000

export function checkRateLimit(ip: string, action: string, limit: number): boolean {
  if (process.env.NODE_ENV === 'test') return true
  const key = `${action}:${ip}`
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    store.set(key, { count: 1, windowStart: now })
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
