'use client'

import { useState } from 'react'
import type { SiteSettings } from '@/types'

interface SettingsFormProps {
  settings: SiteSettings
}

export default function SettingsForm({ settings }: SettingsFormProps) {
  const [form, setForm] = useState({
    id: settings.id,
    business_name: settings.business_name ?? 'Top of the Hill Rooms',
    about_text: settings.about_text ?? '',
    contact_phone: settings.contact_phone ?? '',
    contact_email: settings.contact_email ?? '',
    contact_address: settings.contact_address ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
    setSaved(false)
    setError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const json = await res.json()
        setError(json.error ?? 'Failed to save settings')
        return
      }
      setSaved(true)
    } catch {
      setError('Network error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <div>
        <label htmlFor="business_name" className="text-on-surface-variant text-sm mb-1 block">
          Business Name
        </label>
        <input
          id="business_name"
          name="business_name"
          type="text"
          value={form.business_name}
          onChange={handleChange}
          className="w-full bg-surface-highest/40 rounded-xl px-4 py-3 text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary/50"
        />
      </div>

      <div>
        <label htmlFor="about_text" className="text-on-surface-variant text-sm mb-1 block">
          About Us Text
        </label>
        <textarea
          id="about_text"
          name="about_text"
          rows={6}
          value={form.about_text}
          onChange={handleChange}
          className="w-full bg-surface-highest/40 rounded-xl px-4 py-3 text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary/50 resize-y"
        />
      </div>

      <div>
        <label htmlFor="contact_phone" className="text-on-surface-variant text-sm mb-1 block">
          Contact Phone
        </label>
        <input
          id="contact_phone"
          name="contact_phone"
          type="tel"
          value={form.contact_phone}
          onChange={handleChange}
          className="w-full bg-surface-highest/40 rounded-xl px-4 py-3 text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary/50"
        />
      </div>

      <div>
        <label htmlFor="contact_email" className="text-on-surface-variant text-sm mb-1 block">
          Contact Email
        </label>
        <input
          id="contact_email"
          name="contact_email"
          type="email"
          value={form.contact_email}
          onChange={handleChange}
          className="w-full bg-surface-highest/40 rounded-xl px-4 py-3 text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary/50"
        />
      </div>

      <div>
        <label htmlFor="contact_address" className="text-on-surface-variant text-sm mb-1 block">
          Contact Address
        </label>
        <textarea
          id="contact_address"
          name="contact_address"
          rows={2}
          value={form.contact_address}
          onChange={handleChange}
          className="w-full bg-surface-highest/40 rounded-xl px-4 py-3 text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary/50 resize-y"
        />
      </div>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={saving}
          className="bg-gradient-to-r from-primary to-secondary text-background rounded-2xl px-6 py-2.5 font-semibold shadow-[0_0_10px_rgba(175,201,234,0.30)] disabled:opacity-50 transition-opacity"
        >
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
        {saved && (
          <span className="text-sm text-secondary">Settings saved.</span>
        )}
        {error && (
          <span className="text-sm text-error">{error}</span>
        )}
      </div>
    </form>
  )
}
