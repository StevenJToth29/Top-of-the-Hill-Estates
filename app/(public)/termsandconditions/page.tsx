import type { Metadata } from 'next'
import { createServiceRoleClient } from '@/lib/supabase'
import { format } from 'date-fns'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Terms and Conditions | Top of the Hill Rooms',
  description: 'Terms and Conditions for booking with Top of the Hill Rooms — Top of the Hill Estates, LLC',
}

export default async function TermsAndConditionsPage() {
  const supabase = createServiceRoleClient()
  const { data } = await supabase
    .from('site_settings')
    .select('terms_of_service_html, legal_last_updated')
    .single()

  const html: string | null = data?.terms_of_service_html ?? null
  const lastUpdated: string | null = data?.legal_last_updated
    ? format(new Date(data.legal_last_updated), 'MMMM d, yyyy')
    : null

  return (
    <main className="min-h-screen bg-surface-low py-16 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="font-display text-4xl font-bold text-primary mb-2">
          Terms and Conditions
        </h1>
        {lastUpdated && (
          <p className="font-body text-on-surface-variant mb-12">Last updated: {lastUpdated}</p>
        )}

        {html ? (
          <div
            className="rich-text font-body text-on-surface-variant leading-relaxed"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <p className="font-body text-on-surface-variant">
            Terms and conditions content is not yet available. Please check back later.
          </p>
        )}
      </div>
    </main>
  )
}
