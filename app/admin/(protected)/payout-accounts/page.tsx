export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createServiceRoleClient, createServerSupabaseClient } from '@/lib/supabase'
import PayoutAccountsTable from '@/components/admin/PayoutAccountsTable'
import type { StripeAccount } from '@/types'

export default async function PayoutAccountsPage() {
  const serverClient = await createServerSupabaseClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) redirect('/admin/login')

  const supabase = createServiceRoleClient()
  const { data: accounts } = await supabase
    .from('stripe_accounts')
    .select('*')
    .order('label')

  return (
    <div className="min-h-screen bg-background px-4 py-10 sm:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="font-display text-3xl font-bold text-on-surface">Payout Accounts</h1>
          <p className="text-on-surface-variant mt-1">
            Stripe connected accounts for per-property payout routing. Set these up in your Stripe dashboard first, then paste the account ID here.
          </p>
        </div>
        <PayoutAccountsTable accounts={(accounts ?? []) as StripeAccount[]} />
      </div>
    </div>
  )
}
