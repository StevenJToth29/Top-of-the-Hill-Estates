import type { Metadata } from 'next'
import { getLegalContent } from '@/lib/site-settings'
import { format } from 'date-fns'

export const metadata: Metadata = {
  title: 'Privacy Policy | Top of the Hill Rooms',
  description: 'Privacy Policy for Top of the Hill Rooms — Top of the Hill Estates, LLC',
}

export default async function PrivacyPolicyPage() {
  const legal = await getLegalContent()

  const html: string | null = legal?.privacy_policy_html ?? null
  const lastUpdated: string | null = legal?.legal_last_updated
    ? format(new Date(legal.legal_last_updated), 'MMMM d, yyyy')
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
            className="rich-text font-body text-on-surface-variant leading-relaxed"
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
