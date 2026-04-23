import { addDays, format } from 'date-fns'
import { createServerSupabaseClient } from '@/lib/supabase'
import { getBlockedDatesForRoom } from '@/lib/availability'

export async function GET(
  _request: Request,
  { params }: { params: { slug: string } },
) {
  const supabase = await createServerSupabaseClient()

  const { data: room } = await supabase
    .from('rooms')
    .select(
      `id, property_id, name, slug, description, short_description,
       guest_capacity, bedrooms, bathrooms,
       nightly_rate, monthly_rate,
       minimum_nights_short_term, minimum_nights_long_term,
       images, amenities, house_rules,
       is_active, show_nightly_rate, show_monthly_rate,
       cleaning_fee, cleaning_fee_calculation_type, cleaning_fee_booking_type,
       security_deposit, security_deposit_calculation_type, security_deposit_booking_type,
       extra_guest_fee, extra_guest_fee_calculation_type, extra_guest_fee_booking_type,
       cancellation_window_hours, cancellation_policy, use_property_cancellation_policy,
       iframe_booking_url, price_min, price_max,
       created_at, updated_at,
       property:properties(*)`,
    )
    .eq('slug', params.slug)
    .eq('is_active', true)
    .single()

  if (!room) {
    return Response.json({ error: 'Room not found' }, { status: 404 })
  }

  const now = new Date()
  const today = format(now, 'yyyy-MM-dd')
  const ninetyDaysOut = format(addDays(now, 90), 'yyyy-MM-dd')

  const blockedDates = await getBlockedDatesForRoom(room.id, today, ninetyDaysOut)

  return Response.json({ room, blockedDates })
}
