import EmailTemplateEditor from '@/components/admin/email/EmailTemplateEditor'

export default function NewTemplatePage() {
  return (
    <div className="min-h-screen bg-background p-6 md:p-10">
      <div className="max-w-3xl mx-auto">
        <h1 className="font-display text-3xl text-primary mb-8">New Template</h1>
        <div className="bg-surface-highest/40 backdrop-blur-xl rounded-2xl shadow-[0_8px_40px_rgba(45,212,191,0.06)] p-6 md:p-8">
          <EmailTemplateEditor template={null} />
        </div>
      </div>
    </div>
  )
}
