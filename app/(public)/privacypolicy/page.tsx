import type { Metadata } from 'next'
import { createServiceRoleClient } from '@/lib/supabase'
import { format } from 'date-fns'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Privacy Policy | Top of the Hill Rooms',
  description: 'Privacy Policy for Top of the Hill Rooms — Top of the Hill Estates, LLC',
}

export default async function PrivacyPolicyPage() {
  const supabase = createServiceRoleClient()
  const { data } = await supabase
    .from('site_settings')
    .select('privacy_policy_html, legal_last_updated')
    .single()

  const html: string | null = data?.privacy_policy_html ?? null
  const lastUpdated: string | null = data?.legal_last_updated
    ? format(new Date(data.legal_last_updated), 'MMMM d, yyyy')
    : null

  return (
    <main className="min-h-screen bg-surface-low py-16 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="font-display text-4xl font-bold text-primary mb-2">Privacy Policy</h1>
        {lastUpdated && (
          <p className="font-body text-on-surface-variant mb-12">Last updated: {lastUpdated}</p>
        )}

        {html ? (
          <div
            className="font-body text-on-surface-variant leading-relaxed [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-primary [&_p]:mb-3 [&_ul]:list-disc [&_ul]:list-inside [&_strong]:text-on-surface [&_a]:text-secondary [&_a]:hover:underline"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <p className="font-body text-on-surface-variant">
            Privacy policy content is not yet available. Please check back later.
          </p>
        )}
      </div>
    </main>
  )
}
