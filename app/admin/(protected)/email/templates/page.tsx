export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { createServiceRoleClient } from '@/lib/supabase'
import EmailTemplatesList from '@/components/admin/email/EmailTemplatesList'
import type { EmailTemplate } from '@/types'

export default async function EmailTemplatesPage() {
  const supabase = createServiceRoleClient()
  const { data } = await supabase.from('email_templates').select('*').order('name')

  return (
    <div className="min-h-screen bg-background p-6 md:p-10">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="font-display text-3xl text-primary">Email Templates</h1>
          <Link
            href="/admin/email/templates/new"
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-background"
          >
            New Template
          </Link>
        </div>
        <div className="bg-surface-highest/40 backdrop-blur-xl rounded-2xl shadow-[0_8px_40px_rgba(45,212,191,0.06)] p-6">
          <EmailTemplatesList templates={(data ?? []) as EmailTemplate[]} />
        </div>
      </div>
    </div>
  )
}
