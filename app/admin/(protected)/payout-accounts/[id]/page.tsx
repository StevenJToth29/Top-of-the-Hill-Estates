export const dynamic = 'force-dynamic'

import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import nextDynamic from 'next/dynamic'
import { createServiceRoleClient, createServerSupabaseClient } from '@/lib/supabase'
import { stripe } from '@/lib/stripe'

const StripeConnectPanel = nextDynamic(() => import('@/components/admin/StripeConnectPanel'), { ssr: false })

interface PageProps {
  params: { id: string }
}

export default async function PayoutAccountDetailPage({ params }: PageProps) {
  const serverClient = await createServerSupabaseClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) redirect('/admin/login')

  const supabase = createServiceRoleClient()
  const { data: account } = await supabase
    .from('stripe_accounts')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!account) notFound()

  let detailsSubmitted = false
  try {
    const stripeAccount = await stripe.accounts.retrieve(account.stripe_account_id)
    detailsSubmitted = stripeAccount.details_submitted ?? false
  } catch {
    // Stripe unreachable or account deleted — show onboarding component as fallback
  }
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ''

  return (
    <div className="min-h-screen bg-background px-4 py-10 sm:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <Link
            href="/admin/payout-accounts"
            className="text-sm text-on-surface-variant hover:text-on-surface transition-colors"
          >
            ← Payout Accounts
          </Link>
        </div>
        <div>
          <h1 className="font-display text-3xl font-bold text-on-surface">{account.label}</h1>
          <p className="text-on-surface-variant mt-1 font-mono text-sm">{account.stripe_account_id}</p>
        </div>
        <div className="bg-surface-highest/40 backdrop-blur-xl rounded-2xl p-6">
          <StripeConnectPanel
            dbAccountId={account.id}
            detailsSubmitted={detailsSubmitted}
            publishableKey={publishableKey}
          />
        </div>
      </div>
    </div>
  )
}
