'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import EmailEditor, { EditorRef, EmailEditorProps } from 'react-email-editor'
import VariablePicker from './VariablePicker'
import { VARIABLE_GROUPS } from '@/lib/email-variables'
import type { EmailTemplate } from '@/types'

const inputClass =
  'w-full bg-surface-highest/40 rounded-xl px-4 py-3 text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary/50'
const labelClass = 'text-on-surface-variant text-sm mb-1 block'

interface Props {
  template: EmailTemplate | null
}

function buildMergeTags() {
  const tags: Record<string, { name: string; value: string; sample: string }> = {}
  for (const group of VARIABLE_GROUPS) {
    for (const v of group.variables) {
      tags[v.key] = {
        name: `${group.label}: ${v.label}`,
        value: `{{${v.key}}}`,
        sample: v.key,
      }
    }
  }
  return tags
}

export default function EmailTemplateEditor({ template }: Props) {
  const router = useRouter()
  const isNew = !template
  const emailEditorRef = useRef<EditorRef>(null)

  const [name, setName] = useState(template?.name ?? '')
  const [subject, setSubject] = useState(template?.subject ?? '')
  const [isActive, setIsActive] = useState(template?.is_active ?? true)
  const [saving, setSaving] = useState(false)
  const [editorReady, setEditorReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onReady: EmailEditorProps['onReady'] = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (unlayer: any) => {
      setEditorReady(true)
      if (template?.design) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        unlayer.loadDesign(template.design as any)
      }
    },
    [template],
  )

  function insertVariableInSubject(key: string) {
    setSubject((prev) => prev + `{{${key}}}`)
  }

  function handleSave() {
    if (!name.trim() || !subject.trim()) {
      setError('Name and subject are required')
      return
    }
    if (!editorReady) {
      setError('Editor is still loading — please wait')
      return
    }

    setSaving(true)
    setError(null)

    emailEditorRef.current?.editor?.exportHtml(async ({ html, design }) => {
      try {
        const payload = {
          name: name.trim(),
          subject: subject.trim(),
          body: html,
          design,
          is_active: isActive,
        }
        const url = isNew
          ? '/api/admin/email/templates'
          : `/api/admin/email/templates/${template!.id}`
        const res = await fetch(url, {
          method: isNew ? 'POST' : 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const json = await res.json()
          setError((json as { error?: string }).error ?? 'Failed to save')
          setSaving(false)
          return
        }
        router.push('/admin/email/templates')
        router.refresh()
      } catch {
        setError('Network error')
        setSaving(false)
      }
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <label className={labelClass}>Template Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
          placeholder="e.g. Booking Confirmed"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className={labelClass}>Subject Line</label>
          <VariablePicker onSelect={insertVariableInSubject} />
        </div>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className={inputClass}
          placeholder="Your booking at {{room_name}} is confirmed!"
        />
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

      {template && !template.design && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 text-sm text-amber-400">
          This template hasn't been edited in the visual editor yet. Build your design below and save — it will load automatically on future visits.
        </div>
      )}

      <div>
        <label className={labelClass}>Email Body</label>
        <p className="text-xs text-on-surface-variant mb-2">
          Use the Merge Tags button inside the editor to insert dynamic variables like{' '}
          <code className="text-primary">{'{{guest_first_name}}'}</code>.
        </p>
        <div className="rounded-xl overflow-hidden border border-white/10">
          <EmailEditor
            ref={emailEditorRef}
            onReady={onReady}
            minHeight={620}
            options={{
              mergeTags: buildMergeTags(),
              appearance: {
                theme: 'modern_light',
              },
              features: {
                textEditor: { spellChecker: true },
              },
            }}
          />
        </div>
        {!editorReady && (
          <p className="text-xs text-on-surface-variant mt-2">Loading editor…</p>
        )}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-background disabled:opacity-60"
        >
          {saving ? 'Saving…' : isNew ? 'Create Template' : 'Save Template'}
        </button>
        <button
          type="button"
          onClick={() => { router.push('/admin/email/templates'); router.refresh() }}
          className="rounded-xl bg-surface-high px-6 py-2.5 text-sm font-semibold text-on-surface"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
