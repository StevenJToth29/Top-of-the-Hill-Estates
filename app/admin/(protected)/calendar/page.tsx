import { format, startOfMonth, endOfMonth } from 'date-fns'
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
  const from = format(startOfMonth(today), 'yyyy-MM-dd')
  const to = format(endOfMonth(today), 'yyyy-MM-dd')

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

  const initialMonth = format(startOfMonth(today), 'yyyy-MM-dd')

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Calendar
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage bookings, pricing, and tasks</p>
        </div>
      </div>

      <CalendarClient initialData={initialData} initialMonth={initialMonth} />
    </div>
  )
}
