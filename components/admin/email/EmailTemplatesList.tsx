'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PencilIcon, TrashIcon, MagnifyingGlassIcon, PlusIcon } from '@heroicons/react/24/outline'
import type { EmailTemplate } from '@/types'

interface Props {
  templates: EmailTemplate[]
}

function deriveCategory(name: string): 'booking' | 'checkin' | 'review' | 'system' {
  const lower = name.toLowerCase()
  if (lower.includes('check-in') || lower.includes('check-out') || lower.includes('checkout') || lower.includes('check in') || lower.includes('check out')) return 'checkin'
  if (lower.includes('review') || lower.includes('post-checkout') || lower.includes('post checkout')) return 'review'
  if (lower.includes('contact') || lower.includes('system')) return 'system'
  return 'booking'
}

function deriveRecipient(name: string): 'admin' | 'guest' {
  return name.toLowerCase().startsWith('admin') ? 'admin' : 'guest'
}

const CAT_CONFIG = {
  booking: { label: 'Booking', icon: '📄', bgClass: 'bg-teal-50', textClass: 'text-teal-700', borderClass: 'border-teal-200' },
  checkin: { label: 'Check-in/out', icon: '🗓', bgClass: 'bg-amber-50', textClass: 'text-amber-700', borderClass: 'border-amber-200' },
  review: { label: 'Review', icon: '⭐', bgClass: 'bg-yellow-50', textClass: 'text-yellow-700', borderClass: 'border-yellow-200' },
  system: { label: 'System', icon: '⚙', bgClass: 'bg-slate-100', textClass: 'text-slate-600', borderClass: 'border-slate-200' },
} as const

const RECIPIENT_CONFIG = {
  admin: { label: 'Admin', bgClass: 'bg-purple-50', textClass: 'text-purple-700', borderClass: 'border-purple-200' },
  guest: { label: 'Guest', bgClass: 'bg-teal-50', textClass: 'text-teal-700', borderClass: 'border-teal-200' },
} as const

export default function EmailTemplatesList({ templates: initial }: Props) {
  const [templates, setTemplates] = useState(initial)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [search, setSearch] = useState('')

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

  const filtered = templates.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      {/* Top bar */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates…"
            className="w-full bg-slate-50 rounded-lg border border-slate-200 pl-9 pr-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400/30"
          />
        </div>
        <Link
          href="/admin/email/templates/new"
          className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-teal-400 hover:bg-teal-500 text-slate-900 text-sm font-bold rounded-lg transition-colors whitespace-nowrap"
        >
          <PlusIcon className="h-4 w-4" />
          New Template
        </Link>
      </div>

      {/* Template list */}
      <div className="space-y-3">
        {filtered.map((t) => {
          const cat = CAT_CONFIG[deriveCategory(t.name)]
          const rec = RECIPIENT_CONFIG[deriveRecipient(t.name)]
          return (
            <div
              key={t.id}
              className="bg-white rounded-xl border border-slate-200 px-4 py-3.5 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow"
            >
              {/* Category icon */}
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 border ${cat.bgClass} ${cat.borderClass}`}>
                {cat.icon}
              </div>

              {/* Name + subject */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-display text-sm font-bold text-slate-900 truncate">{t.name}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wide flex-shrink-0 ${cat.bgClass} ${cat.textClass} ${cat.borderClass}`}>
                    {cat.label}
                  </span>
                </div>
                <p className="text-xs text-slate-400 truncate">{t.subject}</p>
              </div>

              {/* Recipient badge */}
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border uppercase tracking-wide flex-shrink-0 ${rec.bgClass} ${rec.textClass} ${rec.borderClass}`}>
                {rec.label}
              </span>

              {/* Active toggle */}
              <button
                type="button"
                onClick={() => toggleActive(t)}
                aria-label={`${t.is_active ? 'Deactivate' : 'Activate'} ${t.name}`}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors ${t.is_active ? 'bg-teal-400' : 'bg-slate-200'}`}
              >
                <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${t.is_active ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>

              {/* Edit + Delete buttons */}
              <div className="flex items-center gap-1.5">
                <Link
                  href={`/admin/email/templates/${t.id}`}
                  className="w-8 h-8 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors"
                >
                  <PencilIcon className="h-3.5 w-3.5" />
                </Link>
                <button
                  type="button"
                  onClick={() => handleDelete(t.id)}
                  disabled={deleting === t.id}
                  className="w-8 h-8 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center text-red-400 hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )
        })}

        {filtered.length === 0 && (
          <div className="text-center py-10 text-slate-400 text-sm">
            {search ? `No templates match "${search}"` : 'No templates yet. Create one to get started.'}
          </div>
        )}
      </div>
    </div>
  )
}
