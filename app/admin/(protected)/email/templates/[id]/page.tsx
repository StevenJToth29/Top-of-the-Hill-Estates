import { unstable_noStore as noStore } from 'next/cache'
import { notFound } from 'next/navigation'
import { createServiceRoleClient } from '@/lib/supabase'
import TemplateEditorLoader from './TemplateEditorLoader'
import type { EmailTemplate } from '@/types'

export default async function EditTemplatePage({
  params,
}: {
  params: { id: string }
}) {
  noStore()
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('email_templates')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !data) notFound()

  return (
    <div className="min-h-screen bg-background p-6 md:p-10">
      <div className="max-w-5xl mx-auto">
        <h1 className="font-display text-3xl text-primary mb-8">Edit Template</h1>
        <div className="bg-surface-highest/40 backdrop-blur-xl rounded-2xl shadow-[0_8px_40px_rgba(45,212,191,0.06)] p-6 md:p-8">
          <TemplateEditorLoader template={data as EmailTemplate} />
        </div>
      </div>
    </div>
  )
}
