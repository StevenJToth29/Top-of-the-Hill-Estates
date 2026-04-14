import ICalGenerator from 'ical-generator'
import nodeIcal from 'node-ical'

function parameterValueToString(value: nodeIcal.ParameterValue | undefined, fallback: string): string {
  if (value === undefined || value === null) return fallback
  return typeof value === 'string' ? value : value.val
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
