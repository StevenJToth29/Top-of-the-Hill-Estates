import {
  format,
  subMonths,
  startOfMonth,
  endOfMonth,
  getDaysInMonth,
  differenceInDays,
  parseISO,
} from 'date-fns'
import { createServiceRoleClient } from '@/lib/supabase'
import NewManualBookingButton from '@/components/admin/NewManualBookingButton'
import DashboardStats from '@/components/admin/DashboardStats'
import DashboardCharts from '@/components/admin/DashboardCharts'
import DashboardTodayPanel from '@/components/admin/DashboardTodayPanel'
import DashboardRoomGrid from '@/components/admin/DashboardRoomGrid'
import { RecentBookingsWidget } from '@/components/admin/RecentBookingsWidget'
import type { BookingWithRoom } from '@/components/admin/RecentBookingsWidget'

export const dynamic = 'force-dynamic'

type RoomRow = { id: string; name: string; nightly_rate: number; property: { name: string } | null }
type ConfirmedRow = {
  id: string; room_id: string; check_in: string; check_out: string
  amount_paid: number; total_amount: number; processing_fee: number | null; created_at: string
}
type PendingRow = { id: string; total_amount: number; amount_paid: number }
type UpcomingRow = {
  room_id: string; guest_first_name: string; guest_last_name: string
  check_in: string; check_out: string; status: string
}

export default async function AdminDashboardPage() {
  const supabase = createServiceRoleClient()
  const now = new Date()
  const today = format(now, 'yyyy-MM-dd')

  const thisMonthStart = startOfMonth(now)
  const lastMonthStart = startOfMonth(subMonths(now, 1))
  const sevenMonthsAgo = startOfMonth(subMonths(now, 6))

  const [
    { data: roomsData },
    { data: confirmedData },
    { data: pendingData },
    { data: arrivalsData },
    { data: departuresData },
    { data: recentData },
    { data: upcomingData },
  ] = await Promise.all([
    supabase
      .from('rooms')
      .select('id, name, nightly_rate, property:properties(name)')
      .eq('is_active', true)
      .order('name'),

    supabase
      .from('bookings')
      .select('id, room_id, check_in, check_out, amount_paid, total_amount, processing_fee, created_at')
      .eq('status', 'confirmed')
      .gte('check_out', format(sevenMonthsAgo, 'yyyy-MM-dd'))
      .order('created_at', { ascending: false })
      .limit(1000),

    supabase
      .from('bookings')
      .select('id, total_amount, amount_paid')
      .eq('status', 'pending'),

    supabase
      .from('bookings')
      .select('*, room:rooms(name, property:properties(name))')
      .in('status', ['confirmed', 'pending'])
      .eq('check_in', today)
      .order('created_at'),

    supabase
      .from('bookings')
      .select('*, room:rooms(name, property:properties(name))')
      .in('status', ['confirmed', 'pending'])
      .eq('check_out', today)
      .order('created_at'),

    supabase
      .from('bookings')
      .select('*, room:rooms(name, property:properties(name))')
      .order('created_at', { ascending: false })
      .limit(20),

    supabase
      .from('bookings')
      .select('room_id, guest_first_name, guest_last_name, check_in, check_out, status')
      .in('status', ['confirmed', 'pending'])
      .gte('check_out', today)
      .order('check_in')
      .limit(50),
  ])

  const rooms = (roomsData ?? []) as unknown as RoomRow[]
  const confirmed = (confirmedData ?? []) as ConfirmedRow[]
  const pending = (pendingData ?? []) as PendingRow[]
  const arrivals = (arrivalsData ?? []) as BookingWithRoom[]
  const departures = (departuresData ?? []) as BookingWithRoom[]
  const recent = (recentData ?? []) as BookingWithRoom[]
  const upcoming = (upcomingData ?? []) as UpcomingRow[]

  const roomCount = rooms.length
  const thisMonthKey = format(thisMonthStart, 'yyyy-MM')
  const lastMonthKey = format(lastMonthStart, 'yyyy-MM')

  function calcOccupancy(mStart: Date, mEnd: Date, days: number) {
    if (roomCount === 0 || days === 0) return 0
    const capacity = roomCount * days
    let bookedNights = 0
    const endPlusOne = new Date(mEnd.getTime() + 86400000)
    for (const b of confirmed) {
      const ci = parseISO(b.check_in)
      const co = parseISO(b.check_out)
      const oStart = ci > mStart ? ci : mStart
      const oEnd = co < endPlusOne ? co : endPlusOne
      if (oStart < oEnd) bookedNights += differenceInDays(oEnd, oStart)
    }
    return Math.min(100, Math.round((bookedNights / capacity) * 100))
  }

  const thisMonthBookings = confirmed.filter(b => b.created_at.startsWith(thisMonthKey))
  const thisMonthRevenue = thisMonthBookings.reduce((s, b) => s + (b.amount_paid ?? 0), 0)
  const thisMonthProcessingFees = thisMonthBookings.reduce((s, b) => s + (b.processing_fee ?? 0), 0)
  const thisMonthNet = thisMonthRevenue - thisMonthProcessingFees

  const lastMonthRevenue = confirmed
    .filter(b => b.created_at.startsWith(lastMonthKey))
    .reduce((s, b) => s + (b.amount_paid ?? 0), 0)

  const revenueDelta =
    lastMonthRevenue > 0
      ? Math.round(((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)
      : 0

  const occupancyPercent = calcOccupancy(thisMonthStart, endOfMonth(now), getDaysInMonth(now))
  const prevOccupancyPercent = calcOccupancy(
    lastMonthStart,
    endOfMonth(lastMonthStart),
    getDaysInMonth(lastMonthStart),
  )
  const occupancyDelta = occupancyPercent - prevOccupancyPercent

  const upcomingCheckinsCount = upcoming.filter(
    b => b.check_in > today && b.status === 'confirmed',
  ).length
  const pendingCount = pending.length
  const outstandingBalance = Math.round(
    pending.reduce((s, b) => s + Math.max(0, (b.total_amount ?? 0) - (b.amount_paid ?? 0)), 0),
  )
  const avgNightlyRate =
    roomCount > 0
      ? Math.round(rooms.reduce((s, r) => s + r.nightly_rate, 0) / roomCount)
      : 0

  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(now, 5 - i)
    const mStart = startOfMonth(d)
    const mEnd = endOfMonth(d)
    const mKey = format(mStart, 'yyyy-MM')
    const mBookings = confirmed.filter(b => b.created_at.startsWith(mKey))
    const revenue = mBookings.reduce((s, b) => s + (b.amount_paid ?? 0), 0)
    const processingFees = mBookings.reduce((s, b) => s + (b.processing_fee ?? 0), 0)
    const net = revenue - processingFees
    const occ = calcOccupancy(mStart, mEnd, getDaysInMonth(d))
    return { label: format(d, 'MMM'), revenue, processingFees, net, occupancyPercent: occ, isCurrent: mKey === thisMonthKey }
  })

  const mEnd = endOfMonth(now)
  const endPlusOne = new Date(mEnd.getTime() + 86400000)
  const roomsWithStatus = rooms.map(room => {
    const roomUpcoming = upcoming.filter(b => b.room_id === room.id)
    const current = roomUpcoming.find(b => b.check_in <= today && b.check_out > today)
    const next = roomUpcoming.find(b => b.check_in > today)

    let roomNights = 0
    for (const b of confirmed.filter(x => x.room_id === room.id)) {
      const ci = parseISO(b.check_in)
      const co = parseISO(b.check_out)
      const oStart = ci > thisMonthStart ? ci : thisMonthStart
      const oEnd = co < endPlusOne ? co : endPlusOne
      if (oStart < oEnd) roomNights += differenceInDays(oEnd, oStart)
    }
    const roomOccPct = Math.min(
      100,
      getDaysInMonth(now) > 0 ? Math.round((roomNights / getDaysInMonth(now)) * 100) : 0,
    )

    return {
      id: room.id,
      name: room.name,
      propertyName: (room.property as { name: string } | null)?.name ?? '',
      isOccupied: !!current,
      isCheckoutToday: roomUpcoming.some(b => b.check_out === today),
      isCheckinToday: roomUpcoming.some(b => b.check_in === today),
      currentGuest: current ? `${current.guest_first_name} ${current.guest_last_name}` : undefined,
      currentCheckout: current?.check_out,
      nextGuest: next ? `${next.guest_first_name} ${next.guest_last_name}` : undefined,
      nextCheckin: next?.check_in,
      monthOccupancyPercent: roomOccPct,
    }
  })

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-on-surface">Dashboard</h1>
          <p className="text-sm text-on-surface-variant mt-0.5">
            {format(now, 'EEEE, MMMM d, yyyy')}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <a
            href="/admin/bookings"
            className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant bg-white px-4 py-2 text-sm font-semibold text-on-surface-variant hover:bg-surface-highest/40 transition-colors"
          >
            Today&apos;s Arrivals ({arrivals.length})
          </a>
          <NewManualBookingButton />
        </div>
      </div>

      <DashboardStats
        thisMonthRevenue={thisMonthRevenue}
        thisMonthProcessingFees={thisMonthProcessingFees}
        thisMonthNet={thisMonthNet}
        revenueDelta={revenueDelta}
        occupancyPercent={occupancyPercent}
        occupancyDelta={occupancyDelta}
        upcomingCheckinsCount={upcomingCheckinsCount}
        pendingCount={pendingCount}
        outstandingBalance={outstandingBalance}
        avgNightlyRate={avgNightlyRate}
      />

      <DashboardCharts
        monthlyData={monthlyData}
        currentRevenue={thisMonthRevenue}
        currentProcessingFees={thisMonthProcessingFees}
        currentNet={thisMonthNet}
        revenueDelta={revenueDelta}
        currentOccupancy={occupancyPercent}
        occupancyDelta={occupancyDelta}
      />

      <DashboardTodayPanel arrivals={arrivals} departures={departures} />

      {rooms.length > 0 && <DashboardRoomGrid rooms={roomsWithStatus} />}

      <RecentBookingsWidget bookings={recent} today={today} />
    </div>
  )
}
