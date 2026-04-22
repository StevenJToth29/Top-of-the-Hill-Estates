export const dynamic = 'force-dynamic'

import { createServiceRoleClient } from '@/lib/supabase'
import SettingsForm from '@/components/admin/SettingsForm'
import type { PaymentMethodConfig, SiteSettings } from '@/types'

export default async function SettingsAdminPage() {
  const supabase = createServiceRoleClient()

  const [settingsResult, configsResult] = await Promise.all([
    supabase.from('site_settings').select('*').single(),
    supabase
      .from('payment_method_configs')
      .select('*')
      .order('booking_type')
      .order('sort_order'),
  ])

  const fallback: SiteSettings = {
    id: '',
    business_name: 'Top of the Hill Rooms',
    about_text: '',
    contact_phone: '',
    contact_email: '',
    contact_address: '',
    updated_at: '',
    ai_prompts: null,
  }

  return (
    <div className="min-h-screen bg-background p-6 md:p-10">
      <div className="max-w-3xl mx-auto">
        <h1 className="font-display text-3xl text-primary mb-8">Settings</h1>
        <div className="bg-surface-highest/40 backdrop-blur-xl rounded-2xl shadow-[0_8px_40px_rgba(45,212,191,0.06)] p-6 md:p-8">
          <SettingsForm
            settings={settingsResult.data ?? fallback}
            paymentMethodConfigs={(configsResult.data ?? []) as PaymentMethodConfig[]}
          />
        </div>
      </div>
    </div>
  )
}
