import ICalGenerator from 'ical-generator'
import { createServiceRoleClient } from '@/lib/supabase'

export async function GET(
  _request: Request,
  { params }: { params: { token: string } },
) {
  const supabase = createServiceRoleClient()

  const { data: person } = await supabase
    .from('people')
    .select('id, name')
    .eq('ical_token', params.token)
    .single()

  if (!person) return new Response('Not found', { status: 404 })

  const { data: tasks } = await supabase
    .from('calendar_tasks')
    .select('id, title, description, due_date, room:rooms(name, property:properties(name))')
    .eq('assignee_id', person.id)
    .eq('status', 'pending')
    .order('due_date')

  const cal = ICalGenerator({ name: `${person.name} – Tasks` })

  for (const task of tasks ?? []) {
    const [y, m, d] = (task.due_date as string).split('-').map(Number)
    const start = new Date(Date.UTC(y, m - 1, d))
    const end = new Date(Date.UTC(y, m - 1, d + 1))

    const roomName = (task.room as unknown as { name: string; property: { name: string } } | null)?.name
    const propName = (task.room as unknown as { name: string; property: { name: string } } | null)?.property?.name
    const location = [roomName, propName].filter(Boolean).join(' – ')

    cal.createEvent({
      id: `task-${task.id}@tothrooms.com`,
      summary: task.title as string,
      description: (task.description as string | null) ?? undefined,
      location: location || undefined,
      start,
      end,
      allDay: true,
    })
  }

  return new Response(cal.toString(), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="tasks-${person.name.toLowerCase().replace(/\s+/g, '-')}.ics"`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  })
}
