export const dynamic = 'force-dynamic'

import { createServiceRoleClient } from '@/lib/supabase'
import EmailSettingsForm from '@/components/admin/email/EmailSettingsForm'
import EmailSubNav from '@/components/admin/email/EmailSubNav'
import type { EmailSettings } from '@/types'

const fallback: EmailSettings = {
  id: '',
  from_name: '',
  from_email: '',
  admin_recipients: [],
  review_url: '',
}

export default async function EmailSettingsPage() {
  const supabase = createServiceRoleClient()
  const { data } = await supabase.from('email_settings').select('*').maybeSingle()

  return (
    <div className="min-h-screen bg-background p-6 md:p-10">
      <div className="max-w-2xl mx-auto">
        <EmailSubNav />
        <h1 className="font-display text-3xl text-primary mb-8">Email Settings</h1>
        <div className="bg-surface-highest/40 backdrop-blur-xl rounded-2xl shadow-[0_8px_40px_rgba(45,212,191,0.06)] p-6 md:p-8">
          <EmailSettingsForm settings={(data as EmailSettings | null) ?? fallback} />
        </div>
      </div>
    </div>
  )
}
