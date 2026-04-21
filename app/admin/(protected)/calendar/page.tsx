import { format, subDays, addDays } from 'date-fns'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import { CalendarClient } from '@/components/admin/CalendarClient'
import type { CalendarData } from '@/types'

export default async function AdminCalendarPage() {
  const serverClient = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await serverClient.auth.getUser()
  if (authError || !user) redirect('/admin/login')

  const supabase = createServiceRoleClient()
  const today = new Date()
  const from = format(subDays(today, 60), 'yyyy-MM-dd')
  const to = format(addDays(today, 120), 'yyyy-MM-dd')

  const [roomsRes, bookingsRes, icalRes, overridesRes, tasksRes] = await Promise.all([
    supabase
      .from('rooms')
      .select('*, property:properties(id, name)')
      .eq('is_active', true)
      .order('name'),

    supabase
      .from('bookings')
      .select('*')
      .in('status', ['confirmed', 'pending'])
      .lt('check_in', to)
      .gte('check_out', from),

    supabase
      .from('ical_blocks')
      .select('*')
      .lt('start_date', to)
      .gte('end_date', from),

    supabase
      .from('date_overrides')
      .select('*')
      .gte('date', from)
      .lte('date', to),

    supabase
      .from('calendar_tasks')
      .select('*')
      .or(`recurrence_rule.not.is.null,and(due_date.gte.${from},due_date.lte.${to})`),
  ])

  const initialData: CalendarData = {
    rooms: roomsRes.data ?? [],
    bookings: bookingsRes.data ?? [],
    icalBlocks: icalRes.data ?? [],
    dateOverrides: overridesRes.data ?? [],
    tasks: tasksRes.data ?? [],
  }

  return (
    // -m-8 negates the layout's p-8 so the calendar fills wall-to-wall
    <div className="-m-8 h-[calc(100vh)] flex flex-col overflow-hidden">
      <CalendarClient initialData={initialData} today={format(today, 'yyyy-MM-dd')} />
    </div>
  )
}
