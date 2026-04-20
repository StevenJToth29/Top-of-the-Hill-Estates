export const dynamic = 'force-dynamic'

import { createServiceRoleClient } from '@/lib/supabase'
import EmailAutomationsPage from '@/components/admin/email/EmailAutomationsPage'
import type { EmailAutomation, EmailTemplate } from '@/types'

export default async function AdminEmailAutomationsPage() {
  const supabase = createServiceRoleClient()

  const [automationsResult, templatesResult] = await Promise.all([
    supabase
      .from('email_automations')
      .select('*')
      .order('is_pre_planned', { ascending: false })
      .order('name'),
    supabase.from('email_templates').select('*').eq('is_active', true).order('name'),
  ])

  return (
    <div className="min-h-screen bg-background p-6 md:p-10">
      <div className="max-w-4xl mx-auto">
        <h1 className="font-display text-3xl text-primary mb-8">Email Automations</h1>
        <div className="bg-surface-highest/40 backdrop-blur-xl rounded-2xl shadow-[0_8px_40px_rgba(45,212,191,0.06)] p-6 md:p-8">
          <EmailAutomationsPage
            automations={(automationsResult.data ?? []) as EmailAutomation[]}
            templates={(templatesResult.data ?? []) as EmailTemplate[]}
          />
        </div>
      </div>
    </div>
  )
}
