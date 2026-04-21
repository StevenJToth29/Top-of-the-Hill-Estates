'use client'

import { useState } from 'react'
import AdminRecipientsInput from './AdminRecipientsInput'
import type { EmailSettings } from '@/types'

const inputClass =
  'w-full bg-slate-50 rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400/30 transition-colors'
const labelClass = 'block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5'

interface Props {
  settings: EmailSettings
}

interface SectionCardProps {
  icon: React.ReactNode
  title: string
  desc: string
  children: React.ReactNode
}

function SectionCard({ icon, title, desc, children }: SectionCardProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm mb-4 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center text-base flex-shrink-0">
          {icon}
        </div>
        <div>
          <div className="font-display text-sm font-bold text-slate-900">{title}</div>
          <div className="text-xs text-slate-400 mt-0.5">{desc}</div>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

export default function EmailSettingsForm({ settings }: Props) {
  const [fromName, setFromName] = useState(settings.from_name)
  const [fromEmail, setFromEmail] = useState(settings.from_email)
  const [adminRecipients, setAdminRecipients] = useState<string[]>(
    settings.admin_recipients ?? [],
  )
  const [reviewUrl, setReviewUrl] = useState(settings.review_url)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      const res = await fetch('/api/admin/email/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_name: fromName,
          from_email: fromEmail,
          admin_recipients: adminRecipients,
          review_url: reviewUrl,
        }),
      })
      if (!res.ok) {
        const json = await res.json()
        setError((json as { error?: string }).error ?? 'Failed to save settings')
      } else {
        setSaved(true)
        setTimeout(() => setSaved(false), 2500)
      }
    } catch {
      setError('Network error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSave}>
      {/* Section 1 — Sender Identity */}
      <SectionCard
        icon="✉️"
        title="Sender Identity"
        desc="How your emails appear in guests' inboxes"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>From Name</label>
            <input
              type="text"
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
              className={inputClass}
              placeholder="Top of the Hill Estates"
            />
          </div>
          <div>
            <label className={labelClass}>From Email</label>
            <input
              type="email"
              value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)}
              className={inputClass}
              placeholder="noreply@yourdomain.com"
            />
          </div>
        </div>
        <div className="mt-2 px-3.5 py-2.5 bg-teal-50 rounded-lg border border-teal-200/60 text-xs text-slate-500 flex items-center gap-2">
          <span>👁</span>
          <span>Preview:</span>
          <strong className="text-slate-800">{fromName || 'Your Name'}</strong>
          <span className="text-slate-400">&lt;{fromEmail || 'email@domain.com'}&gt;</span>
        </div>
      </SectionCard>

      {/* Section 2 — Admin Notifications */}
      <SectionCard
        icon="🔔"
        title="Admin Notifications"
        desc="Staff addresses that receive booking alerts and cancellations"
      >
        <label className={labelClass}>Recipients</label>
        <AdminRecipientsInput value={adminRecipients} onChange={setAdminRecipients} />
        <p className="text-xs text-slate-400 mt-2">
          Press Enter or comma to add. These addresses receive new booking and cancellation alerts.
        </p>
      </SectionCard>

      {/* Section 3 — Review Link */}
      <SectionCard
        icon="⭐"
        title="Review Link"
        desc="Sent to guests after checkout in your post-stay email"
      >
        <label className={labelClass}>Google Review URL</label>
        <input
          type="url"
          value={reviewUrl}
          onChange={(e) => setReviewUrl(e.target.value)}
          className={inputClass}
          placeholder="https://g.page/r/…"
        />
        <p className="text-xs text-slate-400 mt-2">
          Use{' '}
          <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px] font-mono text-purple-600">
            {'{{review_url}}'}
          </code>{' '}
          in email templates to insert this link automatically.
        </p>
      </SectionCard>

      {/* Save row */}
      <div className="flex items-center gap-3 mt-2">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-400 hover:bg-teal-500 text-slate-900 text-sm font-bold rounded-lg transition-colors disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
        {saved && <span className="text-sm font-semibold text-emerald-600">✓ Saved!</span>}
        {error && <span className="text-sm text-red-500">{error}</span>}
      </div>
    </form>
  )
}
