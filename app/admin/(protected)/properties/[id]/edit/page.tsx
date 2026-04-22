export const dynamic = 'force-dynamic'

import { notFound, redirect } from 'next/navigation'
import { createServiceRoleClient, createServerSupabaseClient } from '@/lib/supabase'
import PropertyForm from '@/components/admin/PropertyForm'
import type { Property, StripeAccount } from '@/types'

interface EditPropertyPageProps {
  params: { id: string }
}

export default async function EditPropertyPage({ params }: EditPropertyPageProps) {
  const serverClient = await createServerSupabaseClient()
  const {
    data: { user },
  } = await serverClient.auth.getUser()
  if (!user) redirect('/admin/login')

  const supabase = createServiceRoleClient()
  const [{ data: property }, { data: settings }, { data: stripeAccounts }] = await Promise.all([
    supabase.from('properties').select('*').eq('id', params.id).single(),
    supabase.from('site_settings').select('global_house_rules').maybeSingle(),
    supabase.from('stripe_accounts').select('*').order('label'),
  ])

  if (!property) notFound()
  const globalHouseRules = settings?.global_house_rules ?? ''

  return (
    <div className="-m-8 bg-background">
      <PropertyForm
        property={property as Property}
        propertyId={params.id}
        globalHouseRules={globalHouseRules}
        stripeAccounts={(stripeAccounts ?? []) as StripeAccount[]}
      />
    </div>
  )
}
