export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
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
  const { data: settings } = await supabase.from('site_settings').select('global_house_rules').maybeSingle()
  const globalHouseRules = settings?.global_house_rules ?? ''

  const { data: stripeAccounts } = await supabase
    .from('stripe_accounts')
    .select('*')
    .order('label')

  return (
    <div className="min-h-screen bg-background px-4 py-10 sm:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/properties"
            className="flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            Back to Properties
          </Link>
        </div>

        <div>
          <h1 className="font-display text-3xl font-bold text-on-surface">Add New Property</h1>
          <p className="text-on-surface-variant mt-1">
            Fill in the details below to create a new property.
          </p>
        </div>

        <PropertyForm
          globalHouseRules={globalHouseRules}
          stripeAccounts={(stripeAccounts ?? []) as StripeAccount[]}
        />
      </div>
    </div>
  )
}
