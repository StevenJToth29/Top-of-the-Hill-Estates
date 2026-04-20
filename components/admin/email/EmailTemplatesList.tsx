'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PencilIcon, TrashIcon } from '@heroicons/react/24/outline'
import type { EmailTemplate } from '@/types'

interface Props {
  templates: EmailTemplate[]
}

export default function EmailTemplatesList({ templates: initial }: Props) {
  const [templates, setTemplates] = useState(initial)
  const [deleting, setDeleting] = useState<string | null>(null)

  async function toggleActive(t: EmailTemplate) {
    const res = await fetch(`/api/admin/email/templates/${t.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...t, is_active: !t.is_active }),
    })
    if (res.ok) {
      setTemplates((prev) =>
        prev.map((x) => (x.id === t.id ? { ...x, is_active: !x.is_active } : x)),
      )
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this template? This cannot be undone.')) return
    setDeleting(id)
    const res = await fetch(`/api/admin/email/templates/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setTemplates((prev) => prev.filter((t) => t.id !== id))
    }
    setDeleting(null)
  }

  if (!templates.length) {
    return (
      <p className="text-on-surface-variant text-sm">
        No templates yet. Create one to get started.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {templates.map((t) => (
        <div
          key={t.id}
          className="flex items-center gap-4 bg-surface-highest/40 rounded-xl px-4 py-3"
        >
          <div className="flex-1 min-w-0">
            <p className="font-medium text-on-surface truncate">{t.name}</p>
            <p className="text-sm text-on-surface-variant truncate">{t.subject}</p>
          </div>
          <button
            type="button"
            onClick={() => toggleActive(t)}
            aria-label={`${t.is_active ? 'Deactivate' : 'Activate'} ${t.name}`}
            className={[
              'relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors',
              t.is_active ? 'bg-primary' : 'bg-surface-high',
            ].join(' ')}
          >
            <span
              className={[
                'inline-block h-3.5 w-3.5 transform rounded-full bg-background transition-transform',
                t.is_active ? 'translate-x-5' : 'translate-x-0.5',
              ].join(' ')}
            />
          </button>
          <Link
            href={`/admin/email/templates/${t.id}`}
            className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-high hover:text-on-surface transition-colors"
          >
            <PencilIcon className="h-4 w-4" />
          </Link>
          <button
            type="button"
            onClick={() => handleDelete(t.id)}
            disabled={deleting === t.id}
            className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-high hover:text-red-400 transition-colors disabled:opacity-50"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
