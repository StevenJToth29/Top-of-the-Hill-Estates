import { Suspense } from 'react'
import { createServerSupabaseClient } from '@/lib/supabase'
import CheckoutPageInner from '@/components/public/CheckoutPageInner'

export default async function CheckoutPage() {
  let checkinTime = '15:00'
  let checkoutTime = '10:00'
  try {
    const supabase = await createServerSupabaseClient()
    const { data } = await supabase
      .from('site_settings')
      .select('checkin_time, checkout_time')
      .maybeSingle()
    if (data?.checkin_time) checkinTime = data.checkin_time
    if (data?.checkout_time) checkoutTime = data.checkout_time
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
      <CheckoutPageInner checkinTime={checkinTime} checkoutTime={checkoutTime} />
    </Suspense>
  )
}
