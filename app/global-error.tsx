'use client'

import posthog from 'posthog-js'
import NextError from 'next/error'
import { useEffect } from 'react'

export default function GlobalError({
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
    <html>
      <body>
        <NextError statusCode={0} />
        <button onClick={reset} style={{ position: 'fixed', bottom: 16, right: 16, padding: '8px 16px', background: '#14b8a6', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
          Try again
        </button>
      </body>
    </html>
  )
}
