import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase'
import { stripe } from '@/lib/stripe'

const EXPIRY_MINUTES = 30

async function handler(request: NextRequest) {
  if (request.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceRoleClient()
  const cutoff = new Date(Date.now() - EXPIRY_MINUTES * 60 * 1000).toISOString()

  const { data: stale, error } = await supabase
    .from('bookings')
    .select('id, stripe_payment_intent_id')
    .eq('status', 'pending')
    .lt('created_at', cutoff)

  if (error) {
    console.error('expire-pending-bookings: failed to fetch stale bookings:', error)
    return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 })
  }

  const results = await Promise.all(
    (stale ?? []).map(async (booking) => {
      try {
        if (booking.stripe_payment_intent_id) {
          const pi = await stripe.paymentIntents.retrieve(booking.stripe_payment_intent_id)
          if (['requires_payment_method', 'requires_confirmation', 'requires_action'].includes(pi.status)) {
            await stripe.paymentIntents.cancel(booking.stripe_payment_intent_id)
          }
        }
        await supabase.from('bookings').update({ status: 'expired' }).eq('id', booking.id)
        return true
      } catch (err) {
        console.error(`expire-pending-bookings: failed to expire booking ${booking.id}:`, err)
        return false
      }
    }),
  )

  const expired = results.filter(Boolean).length
  const failed = results.filter((r) => !r).length
  return NextResponse.json({ expired, failed })
}

export const GET = handler
export const POST = handler
