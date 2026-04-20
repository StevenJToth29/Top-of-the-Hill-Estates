'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import { VariableNode } from './VariableNode'
import VariablePicker from './VariablePicker'
import { resolveVariables } from '@/lib/email'
import { SAMPLE_VARIABLES } from '@/lib/email-variables'
import type { EmailTemplate } from '@/types'

const inputClass =
  'w-full bg-surface-highest/40 rounded-xl px-4 py-3 text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary/50'
const labelClass = 'text-on-surface-variant text-sm mb-1 block'

interface Props {
  template: EmailTemplate | null
}

export default function EmailTemplateEditor({ template }: Props) {
  const router = useRouter()
  const isNew = !template

  const [name, setName] = useState(template?.name ?? '')
  const [subject, setSubject] = useState(template?.subject ?? '')
  const [isActive, setIsActive] = useState(template?.is_active ?? true)
  const [showPreview, setShowPreview] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false }),
      VariableNode,
    ],
    content: template?.body ?? '',
  })

  const getBodyHtml = useCallback(() => editor?.getHTML() ?? '', [editor])

  function insertVariableInBody(key: string) {
    editor?.chain().focus().insertContent({ type: 'variable', attrs: { key } }).run()
  }

  function insertVariableInSubject(key: string) {
    setSubject((s) => s + `{{${key}}}`)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !subject.trim()) {
      setError('Name and subject are required')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const payload = { name, subject, body: getBodyHtml(), is_active: isActive }
      const url = isNew
        ? '/api/admin/email/templates'
        : `/api/admin/email/templates/${template!.id}`
      const method = isNew ? 'POST' : 'PUT'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const json = await res.json()
        setError((json as { error?: string }).error ?? 'Failed to save')
        return
      }
      router.push('/admin/email/templates')
      router.refresh()
    } catch {
      setError('Network error')
    } finally {
      setSaving(false)
    }
  }

  const previewSubject = resolveVariables(subject, SAMPLE_VARIABLES)
  const previewBody = resolveVariables(getBodyHtml(), SAMPLE_VARIABLES)

  function toolbarBtn(label: string, active: boolean, onClick: () => void) {
    return (
      <button
        key={label}
        type="button"
        onClick={onClick}
        className={[
          'rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
          active
            ? 'bg-surface-high text-primary'
            : 'text-on-surface-variant hover:bg-surface-high hover:text-on-surface',
        ].join(' ')}
      >
        {label}
      </button>
    )
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div>
        <label className={labelClass}>Template Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
          placeholder="e.g. Booking Confirmation"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className={labelClass}>Subject</label>
          <VariablePicker onSelect={insertVariableInSubject} />
        </div>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className={inputClass}
          placeholder="Your booking is confirmed!"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className={labelClass}>Body</label>
          <VariablePicker onSelect={insertVariableInBody} />
        </div>
        <div className="bg-surface-highest/40 rounded-xl overflow-hidden focus-within:ring-1 focus-within:ring-secondary/50">
          <div className="flex flex-wrap items-center gap-1 px-3 py-2 border-b border-surface-high">
            {toolbarBtn('Bold', !!editor?.isActive('bold'), () =>
              editor?.chain().focus().toggleBold().run(),
            )}
            {toolbarBtn('Italic', !!editor?.isActive('italic'), () =>
              editor?.chain().focus().toggleItalic().run(),
            )}
            {toolbarBtn('Underline', !!editor?.isActive('underline'), () =>
              editor?.chain().focus().toggleUnderline().run(),
            )}
            {toolbarBtn('List', !!editor?.isActive('bulletList'), () =>
              editor?.chain().focus().toggleBulletList().run(),
            )}
          </div>
          <EditorContent
            editor={editor}
            className="prose prose-invert max-w-none px-4 py-3 text-on-surface min-h-[200px] focus:outline-none"
          />
        </div>
      </div>

      <div>
        <button
          type="button"
          onClick={() => setShowPreview((v) => !v)}
          className="text-sm text-primary hover:underline"
        >
          {showPreview ? 'Hide' : 'Show'} Preview
        </button>
        {showPreview && (
          <div className="mt-3 bg-surface-highest/40 rounded-xl p-4 space-y-2">
            <p className="text-sm text-on-surface-variant">
              Subject: <span className="text-on-surface">{previewSubject}</span>
            </p>
            <div
              className="prose prose-invert max-w-none text-sm text-on-surface"
              dangerouslySetInnerHTML={{ __html: previewBody }}
            />
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={isActive}
          onClick={() => setIsActive((v) => !v)}
          className={[
            'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none',
            isActive ? 'bg-primary' : 'bg-surface-high',
          ].join(' ')}
        >
          <span
            className={[
              'inline-block h-4 w-4 transform rounded-full bg-background transition-transform',
              isActive ? 'translate-x-6' : 'translate-x-1',
            ].join(' ')}
          />
        </button>
        <span className="text-sm text-on-surface-variant">
          {isActive ? 'Active' : 'Inactive'}
        </span>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-background disabled:opacity-60"
        >
          {saving ? 'Saving…' : isNew ? 'Create Template' : 'Save Template'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-xl bg-surface-high px-6 py-2.5 text-sm font-semibold text-on-surface"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
