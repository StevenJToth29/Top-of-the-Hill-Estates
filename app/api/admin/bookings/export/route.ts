import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase'

function escapeCSV(val: unknown): string {
  const str = val === null || val === undefined ? '' : String(val)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export async function GET(request: NextRequest) {
  const serverClient = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await serverClient.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceRoleClient()
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const type = searchParams.get('type')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  let query = supabase
    .from('bookings')
    .select('*, room:rooms(name, property:properties(name))')
    .order('created_at', { ascending: false })

  query = query.neq('status', 'pending_payment')
  if (status && status !== 'all') query = query.eq('status', status)
  if (type && type !== 'all') query = query.eq('booking_type', type)
  if (from) query = query.gte('check_in', from)
  if (to) query = query.lte('check_in', to)

  const { data: bookings, error } = await query
  if (error) return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 })

  const HEADERS = [
    'Booking ID', 'Guest Name', 'Guest Email', 'Room',
    'Check-in', 'Check-out', 'Nights', 'Total Price',
    'Status', 'Source', 'Notes', 'Created At',
  ]

  type BookingRow = {
    id: string
    guest_first_name: string
    guest_last_name: string
    guest_email: string
    room: { name: string } | null
    check_in: string
    check_out: string
    total_nights: number
    total_amount: number
    status: string
    source: string | null
    notes: string | null
    created_at: string
  }

  const rows = (bookings as BookingRow[]).map(b => [
    b.id,
    `${b.guest_first_name} ${b.guest_last_name}`,
    b.guest_email,
    b.room?.name ?? '',
    b.check_in,
    b.check_out,
    b.total_nights,
    b.total_amount,
    b.status,
    b.source ?? '',
    b.notes ?? '',
    b.created_at,
  ])

  const csv = [HEADERS, ...rows].map(row => row.map(escapeCSV).join(',')).join('\n')
  const filename = `bookings-${new Date().toISOString().split('T')[0]}.csv`

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
