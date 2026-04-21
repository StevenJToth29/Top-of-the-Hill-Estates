'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import EmailEditor, { EditorRef, EmailEditorProps } from 'react-email-editor'
import VariablePicker from './VariablePicker'
import { VARIABLE_GROUPS } from '@/lib/email-variables'
import type { EmailTemplate } from '@/types'

const inputClass =
  'bg-slate-50 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400/30 transition-colors'

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
    <div className="flex flex-col h-full">
      {/* ── Controls bar ── */}
      <div className="flex-shrink-0 bg-white border-b border-slate-200 px-6 py-3 flex flex-wrap items-center gap-3">
        {/* Title */}
        <span className="font-display text-sm font-bold text-slate-500 mr-1 whitespace-nowrap">
          {isNew ? 'New Template' : 'Edit Template'}
        </span>

        {/* Name */}
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={`${inputClass} w-48`}
          placeholder="Template name"
        />

        {/* Subject + variable picker */}
        <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className={`${inputClass} flex-1`}
            placeholder="Subject line — e.g. Your booking at {{room_name}} is confirmed!"
          />
          <VariablePicker onSelect={insertVariableInSubject} />
        </div>

        {/* Active toggle */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            role="switch"
            aria-checked={isActive}
            onClick={() => setIsActive((v) => !v)}
            className={[
              'relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none flex-shrink-0',
              isActive ? 'bg-teal-400' : 'bg-slate-200',
            ].join(' ')}
          >
            <span
              className={[
                'inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform',
                isActive ? 'translate-x-5' : 'translate-x-0.5',
              ].join(' ')}
            />
          </button>
          <span className="text-xs text-slate-500 whitespace-nowrap">
            {isActive ? 'Active' : 'Inactive'}
          </span>
        </div>

        {/* Error */}
        {error && <span className="text-xs text-red-500">{error}</span>}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Buttons */}
        <button
          type="button"
          onClick={() => { router.push('/admin/email/templates'); router.refresh() }}
          className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !editorReady}
          className="px-4 py-2 rounded-lg bg-teal-400 hover:bg-teal-500 text-slate-900 text-sm font-bold transition-colors disabled:opacity-60"
        >
          {saving ? 'Saving…' : isNew ? 'Create Template' : 'Save Template'}
        </button>
      </div>

      {/* ── Unlayer editor fills the rest ── */}
      {template && !template.design && (
        <div className="flex-shrink-0 bg-amber-50 border-b border-amber-200 px-6 py-2 text-xs text-amber-700">
          This template hasn&apos;t been edited in the visual editor yet. Build your design below and save.
        </div>
      )}
      {!editorReady && (
        <div className="flex-shrink-0 bg-slate-50 border-b border-slate-100 px-6 py-2 text-xs text-slate-400">
          Loading editor…
        </div>
      )}
      <div className="flex-1 min-h-0">
        <EmailEditor
          ref={emailEditorRef}
          onReady={onReady}
          minHeight="100%"
          options={{
            mergeTags: buildMergeTags(),
            appearance: { theme: 'modern_light' },
            features: { textEditor: { spellChecker: true } },
          }}
        />
      </div>
    </div>
  )
}
