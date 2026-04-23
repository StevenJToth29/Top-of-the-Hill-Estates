import ICalGenerator from 'ical-generator'
import nodeIcal from 'node-ical'

function parameterValueToString(value: nodeIcal.ParameterValue | undefined, fallback: string): string {
  if (value === undefined || value === null) return fallback
  return typeof value === 'string' ? value : value.val
}

/**
 * Validates a URL before it is used for a server-side HTTP request.
 * Rejects non-http(s) schemes and known RFC-1918 / link-local IP literals
 * to prevent SSRF attacks.
 */
function validateICalUrl(raw: string): void {
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    throw new Error(`Invalid iCal URL: "${raw}"`)
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(`iCal URL must use http or https (got "${parsed.protocol}")`)
  }

  // If the hostname is an IP literal, reject private / link-local ranges.
  const host = parsed.hostname.replace(/^\[/, '').replace(/\]$/, '') // strip IPv6 brackets

  // IPv4 private / loopback / link-local ranges
  const ipv4Private =
    /^127\./ .test(host) ||           // 127.0.0.0/8 — loopback
    /^10\./ .test(host) ||            // 10.0.0.0/8
    /^192\.168\./ .test(host) ||      // 192.168.0.0/16
    /^169\.254\./ .test(host) ||      // 169.254.0.0/16 — link-local / AWS metadata
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) // 172.16-31.x

  // IPv6 loopback and ULA / link-local prefixes
  const ipv6Private =
    host === '::1' ||
    /^fe80:/i.test(host) ||           // link-local
    /^fc[0-9a-f]{2}:/i.test(host) ||  // ULA fc00::/7 lower half
    /^fd[0-9a-f]{2}:/i.test(host)     // ULA fc00::/7 upper half

  if (ipv4Private || ipv6Private) {
    throw new Error(`iCal URL points to a private or link-local address and is not allowed`)
  }
}

/**
 * Generates an iCal feed string from an array of events.
 */
export function generateICalFeed(
  events: Array<{
    uid: string
    summary: string
    start: Date
    end: Date
    description?: string
  }>,
): string {
  const cal = ICalGenerator({ name: 'Top of the Hill Rooms' })

  for (const event of events) {
    cal.createEvent({
      id: event.uid,
      summary: event.summary,
      start: event.start,
      end: event.end,
      description: event.description,
    })
  }

  return cal.toString()
}

/**
 * Fetches and parses a remote iCal URL.
 * Returns an array of events with uid, summary, start, and end.
 */
export async function parseICalUrl(url: string): Promise<
  Array<{
    uid: string
    summary: string
    start: Date
    end: Date
  }>
> {
  validateICalUrl(url)
  const data = await nodeIcal.async.fromURL(url)

  const events: Array<{ uid: string; summary: string; start: Date; end: Date }> = []

  for (const [key, component] of Object.entries(data)) {
    if (!component || component.type !== 'VEVENT') continue

    const event = component as nodeIcal.VEvent
    if (!event.start || !event.end) continue

    const start = event.start instanceof Date ? event.start : new Date(String(event.start))
    const end = event.end instanceof Date ? event.end : new Date(String(event.end))

    const summary = parameterValueToString(event.summary, 'Blocked')

    events.push({ uid: key, summary, start, end })
  }

  return events
}
