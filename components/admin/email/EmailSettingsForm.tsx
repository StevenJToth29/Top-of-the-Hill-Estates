'use client'

import { useState } from 'react'
import AdminRecipientsInput from './AdminRecipientsInput'
import type { EmailSettings } from '@/types'

const inputClass =
  'w-full bg-surface-highest/40 rounded-xl px-4 py-3 text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary/50'
const labelClass = 'text-on-surface-variant text-sm mb-1 block'

interface Props {
  settings: EmailSettings
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
    <form onSubmit={handleSave} className="space-y-6">
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

      <div>
        <label className={labelClass}>Admin Recipients</label>
        <AdminRecipientsInput value={adminRecipients} onChange={setAdminRecipients} />
        <p className="text-xs text-on-surface-variant mt-1.5">
          These addresses receive admin-facing emails (new bookings, cancellations).
        </p>
      </div>

      <div>
        <label className={labelClass}>Review URL</label>
        <input
          type="url"
          value={reviewUrl}
          onChange={(e) => setReviewUrl(e.target.value)}
          className={inputClass}
          placeholder="https://g.page/r/…"
        />
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-background transition-opacity disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
        {saved && <span className="text-sm text-green-400">Saved!</span>}
      </div>
    </form>
  )
}
