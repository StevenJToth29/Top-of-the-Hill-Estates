import TemplateEditorLoader from '../[id]/TemplateEditorLoader'

export default function NewTemplatePage() {
  return (
    <div className="-m-8 flex flex-col overflow-hidden" style={{ height: '100vh' }}>
      <TemplateEditorLoader template={null} />
    </div>
  )
}
