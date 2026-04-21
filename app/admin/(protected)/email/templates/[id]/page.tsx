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
    <div className="-m-8 flex flex-col overflow-hidden" style={{ height: '100vh' }}>
      <TemplateEditorLoader template={data as EmailTemplate} />
    </div>
  )
}
