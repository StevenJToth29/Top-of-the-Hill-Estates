'use client'

import posthog from 'posthog-js'
import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    posthog.captureException(error, { digest: error.digest })
  }, [error])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8 text-center">
      <h2 className="font-display text-xl font-semibold text-on-surface">Something went wrong</h2>
      <p className="text-on-surface-variant text-sm max-w-sm">
        An unexpected error occurred. Please try again or contact support if the problem persists.
      </p>
      <button
        onClick={reset}
        className="rounded-xl bg-primary px-6 py-2.5 font-semibold text-background hover:bg-secondary transition-colors"
      >
        Try again
      </button>
    </div>
  )
}
