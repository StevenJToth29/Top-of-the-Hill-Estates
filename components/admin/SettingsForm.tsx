'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { PhotoIcon } from '@heroicons/react/24/outline'
import { createClient } from '@/lib/supabase-browser'
import type { SiteSettings, BusinessHours } from '@/types'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

const DEFAULT_HOURS: BusinessHours = {
  Mon: { open: '09:00', close: '17:00', closed: false },
  Tue: { open: '09:00', close: '17:00', closed: false },
  Wed: { open: '09:00', close: '17:00', closed: false },
  Thu: { open: '09:00', close: '17:00', closed: false },
  Fri: { open: '09:00', close: '17:00', closed: false },
  Sat: { open: '10:00', close: '15:00', closed: false },
  Sun: { open: '', close: '', closed: true },
}

function parseHours(json?: string): BusinessHours {
  if (!json) return DEFAULT_HOURS
  try {
    return { ...DEFAULT_HOURS, ...JSON.parse(json) }
  } catch {
    return DEFAULT_HOURS
  }
}

function fmt12(time: string) {
  if (!time) return ''
  const [h, m] = time.split(':').map(Number)
  const ampm = h < 12 ? 'am' : 'pm'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

interface SettingsFormProps {
  settings: SiteSettings
}

async function compressImage(file: File, maxWidth = 400): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new window.Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const scale = Math.min(1, maxWidth / img.width)
      canvas.width = img.width * scale
      canvas.height = img.height * scale
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob((blob) => resolve(blob!), 'image/png', 0.95)
      URL.revokeObjectURL(url)
    }
    img.src = url
  })
}

export default function SettingsForm({ settings }: SettingsFormProps) {
  const [form, setForm] = useState({
    id: settings.id,
    business_name: settings.business_name ?? 'Top of the Hill Rooms',
    about_text: settings.about_text ?? '',
    contact_phone: settings.contact_phone ?? '',
    contact_email: settings.contact_email ?? '',
    contact_address: settings.contact_address ?? '',
    logo_url: settings.logo_url ?? '',
  })
  const [hours, setHours] = useState<BusinessHours>(() => parseHours(settings.business_hours))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoError, setLogoError] = useState('')
  const logoInputRef = useRef<HTMLInputElement>(null)

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
    setSaved(false)
    setError('')
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoUploading(true)
    setLogoError('')
    try {
      const compressed = await compressImage(file)
      const supabase = createClient()
      const path = `logo/${Date.now()}.png`
      const { data, error: uploadError } = await supabase.storage
        .from('site-assets')
        .upload(path, compressed, { contentType: 'image/png', upsert: false })
      if (uploadError) throw uploadError
      const { data: { publicUrl } } = supabase.storage.from('site-assets').getPublicUrl(data.path)
      setForm((prev) => ({ ...prev, logo_url: publicUrl }))
      setSaved(false)
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setLogoUploading(false)
      if (logoInputRef.current) logoInputRef.current.value = ''
    }
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
        body: JSON.stringify({ ...form, business_hours: JSON.stringify(hours) }),
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

  const inputClass =
    'w-full bg-surface-highest/40 rounded-xl px-4 py-3 text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary/50'
  const labelClass = 'text-on-surface-variant text-sm mb-1 block'

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-2xl">

      {/* Logo */}
      <section className="space-y-4">
        <h2 className="font-display text-base font-semibold text-on-surface">Site Logo</h2>
        <div className="flex items-center gap-6">
          <div className="relative w-20 h-20 rounded-2xl overflow-hidden bg-surface-container flex items-center justify-center shrink-0">
            {form.logo_url ? (
              <Image
                src={form.logo_url}
                alt="Current logo"
                fill
                className="object-contain p-1"
                unoptimized
              />
            ) : (
              <Image
                src="/logo.png"
                alt="Current logo"
                fill
                className="object-contain p-1"
              />
            )}
          </div>
          <div className="space-y-2">
            <button
              type="button"
              disabled={logoUploading}
              onClick={() => logoInputRef.current?.click()}
              className="flex items-center gap-2 bg-surface-container hover:bg-surface-high text-on-surface-variant text-sm font-medium rounded-xl px-4 py-2.5 transition-colors disabled:opacity-50"
            >
              <PhotoIcon className="w-4 h-4" />
              {logoUploading ? 'Uploading…' : 'Upload New Logo'}
            </button>
            <p className="text-xs text-on-surface-variant/60">
              PNG or SVG recommended · Max 400px · Displayed site-wide
            </p>
            {logoError && (
              <p className="text-xs text-error">{logoError}</p>
            )}
          </div>
          <input
            ref={logoInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={handleLogoUpload}
          />
        </div>
        {form.logo_url && form.logo_url !== settings.logo_url && (
          <p className="text-xs text-secondary">
            Logo uploaded — click Save Settings below to apply it site-wide.
          </p>
        )}
      </section>

      <div className="h-px bg-outline-variant" />

      {/* Business info */}
      <section className="space-y-5">
        <h2 className="font-display text-base font-semibold text-on-surface">Business Info</h2>

        <div>
          <label htmlFor="business_name" className={labelClass}>Business Name</label>
          <input
            id="business_name"
            name="business_name"
            type="text"
            value={form.business_name}
            onChange={handleChange}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="about_text" className={labelClass}>About Us Text</label>
          <textarea
            id="about_text"
            name="about_text"
            rows={6}
            value={form.about_text}
            onChange={handleChange}
            className={`${inputClass} resize-y`}
          />
        </div>
      </section>

      <div className="h-px bg-outline-variant" />

      {/* Contact info */}
      <section className="space-y-5">
        <h2 className="font-display text-base font-semibold text-on-surface">Contact Info</h2>

        <div>
          <label htmlFor="contact_phone" className={labelClass}>Phone</label>
          <input
            id="contact_phone"
            name="contact_phone"
            type="tel"
            value={form.contact_phone}
            onChange={handleChange}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="contact_email" className={labelClass}>Email</label>
          <input
            id="contact_email"
            name="contact_email"
            type="email"
            value={form.contact_email}
            onChange={handleChange}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="contact_address" className={labelClass}>Address</label>
          <textarea
            id="contact_address"
            name="contact_address"
            rows={2}
            value={form.contact_address}
            onChange={handleChange}
            className={`${inputClass} resize-y`}
          />
        </div>
      </section>

      <div className="h-px bg-outline-variant" />

      {/* Business hours */}
      <section className="space-y-4">
        <div>
          <h2 className="font-display text-base font-semibold text-on-surface">Business Hours</h2>
          <p className="text-xs text-on-surface-variant/60 mt-0.5">Displayed on your contact and about pages.</p>
        </div>

        <div className="space-y-2">
          {DAYS.map((day) => {
            const dayHours = hours[day]
            return (
              <div key={day} className="flex items-center gap-3">
                {/* Closed toggle */}
                <button
                  type="button"
                  onClick={() =>
                    setHours((prev) => ({
                      ...prev,
                      [day]: { ...prev[day], closed: !prev[day].closed },
                    }))
                  }
                  className={[
                    'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    dayHours.closed ? 'bg-surface-high' : 'bg-primary',
                  ].join(' ')}
                  aria-label={`Toggle ${day}`}
                >
                  <span
                    className={[
                      'inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform',
                      dayHours.closed ? 'translate-x-0.5' : 'translate-x-4',
                    ].join(' ')}
                  />
                </button>

                {/* Day name */}
                <span className="w-8 text-sm font-medium text-on-surface shrink-0">{day}</span>

                {dayHours.closed ? (
                  <span className="text-sm text-on-surface-variant/50 italic">Closed</span>
                ) : (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="time"
                      value={dayHours.open}
                      onChange={(e) =>
                        setHours((prev) => ({
                          ...prev,
                          [day]: { ...prev[day], open: e.target.value },
                        }))
                      }
                      className="bg-surface-highest/40 rounded-xl px-3 py-1.5 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary/50 [color-scheme:light]"
                    />
                    <span className="text-on-surface-variant/50 text-sm">to</span>
                    <input
                      type="time"
                      value={dayHours.close}
                      onChange={(e) =>
                        setHours((prev) => ({
                          ...prev,
                          [day]: { ...prev[day], close: e.target.value },
                        }))
                      }
                      className="bg-surface-highest/40 rounded-xl px-3 py-1.5 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary/50 [color-scheme:light]"
                    />
                    {dayHours.open && dayHours.close && (
                      <span className="text-xs text-on-surface-variant/50 hidden sm:inline">
                        {fmt12(dayHours.open)} – {fmt12(dayHours.close)}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={saving}
          className="bg-gradient-to-r from-primary to-secondary text-background rounded-2xl px-6 py-2.5 font-semibold shadow-[0_0_10px_rgba(45,212,191,0.30)] disabled:opacity-50 transition-opacity"
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
