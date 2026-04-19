import { Suspense } from 'react'
import { createServerSupabaseClient } from '@/lib/supabase'
import CheckoutPageInner from '@/components/public/CheckoutPageInner'

export default async function CheckoutPage() {
  let checkinTime = '15:00'
  let checkoutTime = '10:00'
  let stripeFeePercent = 2.9
  let stripeFeeFlat = 0.30
  try {
    const supabase = await createServerSupabaseClient()
    const { data } = await supabase
      .from('site_settings')
      .select('checkin_time, checkout_time, stripe_fee_percent, stripe_fee_flat')
      .maybeSingle()
    if (data?.checkin_time) checkinTime = data.checkin_time
    if (data?.checkout_time) checkoutTime = data.checkout_time
    if (data?.stripe_fee_percent != null) stripeFeePercent = Number(data.stripe_fee_percent)
    if (data?.stripe_fee_flat != null) stripeFeeFlat = Number(data.stripe_fee_flat)
  } catch {
    // fall through to defaults
  }

  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-background flex items-center justify-center">
          <p className="text-on-surface-variant">Loading checkout…</p>
        </main>
      }
    >
      <CheckoutPageInner
        checkinTime={checkinTime}
        checkoutTime={checkoutTime}
        stripeFeePercent={stripeFeePercent}
        stripeFeeFlat={stripeFeeFlat}
      />
    </Suspense>
  )
}
