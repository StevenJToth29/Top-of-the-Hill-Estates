import { format } from 'date-fns/format'
import { addDays } from 'date-fns/addDays'
import { parseISO } from 'date-fns/parseISO'
import { createServiceRoleClient } from '@/lib/supabase'
import { DashboardStats } from '@/components/admin/DashboardStats'
import { RecentBookingsWidget } from '@/components/admin/RecentBookingsWidget'
import type { BookingWithRoom } from '@/components/admin/RecentBookingsWidget'

export const dynamic = 'force-dynamic'

export default async function AdminDashboardPage() {
  const supabase = createServiceRoleClient()
  const now = new Date()
  const today = format(now, 'yyyy-MM-dd')
  const nextWeek = format(addDays(now, 7), 'yyyy-MM-dd')
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [
    { count: totalBookings },
    { count: confirmedCount },
    { data: monthlyBookings },
    { data: upcomingCheckins },
    { data: recentBookings },
  ] = await Promise.all([
    supabase.from('bookings').select('*', { count: 'exact', head: true }),
    supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'confirmed'),
    supabase
      .from('bookings')
      .select('amount_paid')
      .eq('status', 'confirmed')
      .gte('created_at', monthStart),
    supabase
      .from('bookings')
      .select('*, room:rooms(name, property:properties(name))')
      .eq('status', 'confirmed')
      .gte('check_in', today)
      .lte('check_in', nextWeek)
      .order('check_in'),
    supabase
      .from('bookings')
      .select('*, room:rooms(name, property:properties(name))')
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  const monthlyRevenue =
    monthlyBookings?.reduce((sum, b) => sum + (b.amount_paid ?? 0), 0) ?? 0
  const checkins = (upcomingCheckins ?? []) as BookingWithRoom[]

  return (
    <main className="min-h-screen bg-background px-4 py-10 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="font-display text-3xl font-bold text-on-surface">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Overview of bookings and revenue
          </p>
        </div>

        <DashboardStats
          totalBookings={totalBookings ?? 0}
          monthlyRevenue={monthlyRevenue}
          upcomingCheckins={checkins.length}
          confirmedCount={confirmedCount ?? 0}
        />

        {checkins.length > 0 && (
          <section>
            <h2 className="font-display text-xl font-semibold text-on-surface mb-4">
              Upcoming Check-ins (Next 7 Days)
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {checkins.map((booking) => (
                <div
                  key={booking.id}
                  className="bg-surface-highest/40 backdrop-blur-xl rounded-2xl p-4 shadow-[0_8px_40px_rgba(175,201,234,0.06)]"
                >
                  <p className="font-semibold text-on-surface text-sm">
                    {booking.room?.name ?? '—'}
                  </p>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    {booking.room?.property?.name ?? ''}
                  </p>
                  <p className="text-sm text-secondary mt-2">
                    {booking.guest_first_name} {booking.guest_last_name}
                  </p>
                  <p className="text-xs text-on-surface-variant mt-1">
                    Check-in: {format(parseISO(booking.check_in), 'MMM d, yyyy')}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        <RecentBookingsWidget bookings={(recentBookings ?? []) as BookingWithRoom[]} />
      </div>
    </main>
  )
}
