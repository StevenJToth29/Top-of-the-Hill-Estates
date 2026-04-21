'use client'

import nextDynamic from 'next/dynamic'
import type { EmailTemplate } from '@/types'

const EmailTemplateEditor = nextDynamic(
  () => import('@/components/admin/email/EmailTemplateEditor'),
  { ssr: false },
)

export default function TemplateEditorLoader({ template }: { template: EmailTemplate | null }) {
  return <EmailTemplateEditor template={template} />
}
