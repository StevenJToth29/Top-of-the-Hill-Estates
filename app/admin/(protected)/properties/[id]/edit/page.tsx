export const dynamic = 'force-dynamic'

import { notFound, redirect } from 'next/navigation'
import { createServiceRoleClient, createServerSupabaseClient } from '@/lib/supabase'
import PropertyForm from '@/components/admin/PropertyForm'
import { PropertyTaskAutomations } from '@/components/admin/PropertyTaskAutomations'
import type { Property, StripeAccount, TaskAutomation, Person, Room } from '@/types'

interface EditPropertyPageProps { params: { id: string } }

export default async function EditPropertyPage({ params }: EditPropertyPageProps) {
  const serverClient = await createServerSupabaseClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) redirect('/admin/login')

  const supabase = createServiceRoleClient()
  const [
    { data: property }, { data: settings }, { data: stripeAccounts },
    { data: propRules }, { data: globalRules }, { data: people },
    { data: allRooms }, { data: allProperties },
  ] = await Promise.all([
    supabase.from('properties').select('*').eq('id', params.id).single(),
    supabase.from('site_settings').select('global_house_rules').maybeSingle(),
    supabase.from('stripe_accounts').select('*').order('label'),
    supabase.from('task_automations').select('*').eq('scope_type', 'property').eq('property_id', params.id).eq('is_active', true),
    supabase.from('task_automations').select('*').eq('scope_type', 'global').eq('is_active', true),
    supabase.from('people').select('*').order('name'),
    supabase.from('rooms').select('*, property:properties(id,name)').order('name'),
    supabase.from('properties').select('id, name').order('name'),
  ])

  if (!property) notFound()

  return (
    <div className="-m-8 bg-background">
      <PropertyForm
        property={property as Property}
        propertyId={params.id}
        globalHouseRules={settings?.global_house_rules ?? ''}
        stripeAccounts={(stripeAccounts ?? []) as StripeAccount[]}
        taskAutomationsTab={
          <PropertyTaskAutomations
            propertyId={params.id}
            initialPropertyRules={(propRules ?? []) as TaskAutomation[]}
            globalRules={(globalRules ?? []) as TaskAutomation[]}
            people={(people ?? []) as Person[]}
            rooms={(allRooms ?? []) as Room[]}
            properties={(allProperties ?? []) as Property[]}
          />
        }
      />
    </div>
  )
}
