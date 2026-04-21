export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { createServiceRoleClient } from '@/lib/supabase'
import EmailTemplatesList from '@/components/admin/email/EmailTemplatesList'
import EmailSubNav from '@/components/admin/email/EmailSubNav'
import type { EmailTemplate } from '@/types'

export default async function EmailTemplatesPage() {
  const supabase = createServiceRoleClient()
  const { data } = await supabase.from('email_templates').select('*').order('name')

  return (
    <div>
      <EmailSubNav />
      <h1 className="font-display text-3xl text-primary mb-8">Email Templates</h1>
      <EmailTemplatesList templates={(data ?? []) as EmailTemplate[]} />
    </div>
  )
}
