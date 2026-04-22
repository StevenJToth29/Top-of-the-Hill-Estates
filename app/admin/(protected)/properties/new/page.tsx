export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createServiceRoleClient, createServerSupabaseClient } from '@/lib/supabase'
import PropertyForm from '@/components/admin/PropertyForm'
import type { StripeAccount } from '@/types'

export default async function NewPropertyPage() {
  const serverClient = await createServerSupabaseClient()
  const {
    data: { user },
  } = await serverClient.auth.getUser()
  if (!user) redirect('/admin/login')

  const supabase = createServiceRoleClient()
  const [{ data: settings }, { data: stripeAccounts }] = await Promise.all([
    supabase.from('site_settings').select('global_house_rules').maybeSingle(),
    supabase.from('stripe_accounts').select('*').order('label'),
  ])
  const globalHouseRules = settings?.global_house_rules ?? ''

  return (
    <div className="-m-8 bg-background">
      <PropertyForm
        globalHouseRules={globalHouseRules}
        stripeAccounts={(stripeAccounts ?? []) as StripeAccount[]}
      />
    </div>
  )
}
