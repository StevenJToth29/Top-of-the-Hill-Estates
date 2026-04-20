export const dynamic = 'force-dynamic'

import dynamic from 'next/dynamic'
import { notFound } from 'next/navigation'
import { createServiceRoleClient } from '@/lib/supabase'
import type { EmailTemplate } from '@/types'

const EmailTemplateEditor = dynamic(
  () => import('@/components/admin/email/EmailTemplateEditor'),
  { ssr: false },
)

export default async function EditTemplatePage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('email_templates')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !data) notFound()

  return (
    <div className="min-h-screen bg-background p-6 md:p-10">
      <div className="max-w-3xl mx-auto">
        <h1 className="font-display text-3xl text-primary mb-8">Edit Template</h1>
        <div className="bg-surface-highest/40 backdrop-blur-xl rounded-2xl shadow-[0_8px_40px_rgba(45,212,191,0.06)] p-6 md:p-8">
          <EmailTemplateEditor template={data as EmailTemplate} />
        </div>
      </div>
    </div>
  )
}
