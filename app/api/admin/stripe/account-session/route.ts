import { NextResponse } from 'next/server'
import { createServiceRoleClient, createServerSupabaseClient } from '@/lib/supabase'
import { stripe } from '@/lib/stripe'

export async function POST(request: Request) {
  const serverClient = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await serverClient.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const account_id = body.account_id?.trim()
  if (!account_id) return NextResponse.json({ error: 'account_id is required' }, { status: 400 })

  const supabase = createServiceRoleClient()
  const { data: account, error: dbError } = await supabase
    .from('stripe_accounts')
    .select('stripe_account_id')
    .eq('id', account_id)
    .single()

  if (dbError || !account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

  try {
    const session = await stripe.accountSessions.create({
      account: account.stripe_account_id,
      components: {
        account_onboarding: { enabled: true },
        account_management: { enabled: true },
      },
    })
    return NextResponse.json({ client_secret: session.client_secret })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Stripe error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
