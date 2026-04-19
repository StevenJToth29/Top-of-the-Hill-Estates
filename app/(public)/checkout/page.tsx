import { Suspense } from 'react'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase'
import CheckoutPageInner from '@/components/public/CheckoutPageInner'
import type { PaymentMethodConfig } from '@/types'

export default async function CheckoutPage() {
  let checkinTime = '15:00'
  let checkoutTime = '10:00'
  let shortTermMethods: PaymentMethodConfig[] = []
  let longTermMethods: PaymentMethodConfig[] = []

  try {
    const serverClient = await createServerSupabaseClient()
    const { data: settings } = await serverClient
      .from('site_settings')
      .select('checkin_time, checkout_time')
      .maybeSingle()
    if (settings?.checkin_time) checkinTime = settings.checkin_time
    if (settings?.checkout_time) checkoutTime = settings.checkout_time

    const supabase = createServiceRoleClient()
    const { data: configs } = await supabase
      .from('payment_method_configs')
      .select('id, booking_type, method_key, label, is_enabled, fee_percent, fee_flat, sort_order')
      .eq('is_enabled', true)
      .order('sort_order')

    const enabledConfigs = (configs ?? []) as PaymentMethodConfig[]
    shortTermMethods = enabledConfigs.filter((c) => c.booking_type === 'short_term')
    longTermMethods = enabledConfigs.filter((c) => c.booking_type === 'long_term')
  } catch (err) {
    console.error('[CheckoutPage] Failed to load payment config:', err)
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
        shortTermMethods={shortTermMethods}
        longTermMethods={longTermMethods}
      />
    </Suspense>
  )
}
