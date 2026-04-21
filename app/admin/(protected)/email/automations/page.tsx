export const dynamic = 'force-dynamic'

import { createServiceRoleClient } from '@/lib/supabase'
import EmailAutomationsPage from '@/components/admin/email/EmailAutomationsPage'
import EmailSubNav from '@/components/admin/email/EmailSubNav'
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
    <div>
      <EmailSubNav />
      <h1 className="font-display text-3xl text-primary mb-8">Email Automations</h1>
      <EmailAutomationsPage
        automations={(automationsResult.data ?? []) as EmailAutomation[]}
        templates={(templatesResult.data ?? []) as EmailTemplate[]}
      />
    </div>
  )
}
