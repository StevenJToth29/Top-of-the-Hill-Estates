'use client'

import { loadConnectAndInitialize } from '@stripe/connect-js'
import {
  ConnectComponentsProvider,
  ConnectAccountOnboarding,
  ConnectAccountManagement,
} from '@stripe/react-connect-js'
import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

interface StripeConnectPanelProps {
  dbAccountId: string
  detailsSubmitted: boolean
  publishableKey: string
}

export default function StripeConnectPanel({
  dbAccountId,
  detailsSubmitted,
  publishableKey,
}: StripeConnectPanelProps) {
  const router = useRouter()
  const [onboardingDone, setOnboardingDone] = useState(detailsSubmitted)

  const fetchClientSecret = useCallback(async () => {
    const res = await fetch('/api/admin/stripe/account-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account_id: dbAccountId }),
    })
    const text = await res.text()
    const data = text ? JSON.parse(text) : {}
    if (!res.ok) throw new Error(data.error ?? 'Failed to create session')
    return data.client_secret as string
  }, [dbAccountId])

  const stripeConnectInstance = useMemo(
    () => loadConnectAndInitialize({
      publishableKey,
      fetchClientSecret,
      appearance: { overlays: 'dialog', variables: { colorPrimary: '#7c3aed' } },
    }),
    [publishableKey, fetchClientSecret],
  )

  return (
    <ConnectComponentsProvider connectInstance={stripeConnectInstance}>
      {onboardingDone ? (
        <ConnectAccountManagement />
      ) : (
        <ConnectAccountOnboarding
          collectionOptions={{ fields: 'eventually_due' }}
          onExit={() => {
            setOnboardingDone(true)
            router.refresh()
          }}
        />
      )}
    </ConnectComponentsProvider>
  )
}
