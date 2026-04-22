'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { PhotoIcon } from '@heroicons/react/24/outline'
import { createClient } from '@/lib/supabase-browser'
import type { SiteSettings, BusinessHours, CancellationPolicy, PaymentMethodConfig } from '@/types'
import { DEFAULT_POLICY } from '@/lib/cancellation'
import AIWriteButton from './AIWriteButton'
import FormTabBar from './FormTabBar'
import type { AiPrompts } from '@/types'
import { DEFAULT_SYSTEM_PROMPT, DEFAULT_USER_PROMPTS } from '@/lib/ai-prompts'

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

function parseCancellationPolicy(json?: string | null): CancellationPolicy {
  if (!json) return DEFAULT_POLICY
  try { return { ...DEFAULT_POLICY, ...JSON.parse(json) } }
  catch { return DEFAULT_POLICY }
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
  paymentMethodConfigs: PaymentMethodConfig[]
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
      canvas.toBlob((blob) => { URL.revokeObjectURL(url); resolve(blob!) }, 'image/png', 0.95)
    }
    img.src = url
  })
}

async function resizeToPng(file: File, size: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, size, size)
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url)
        if (blob) resolve(blob)
        else reject(new Error('Canvas toBlob returned null'))
      }, 'image/png')
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')) }
    img.src = url
  })
}

export default function SettingsForm({ settings, paymentMethodConfigs }: SettingsFormProps) {
  const [form, setForm] = useState({
    id: settings.id,
    business_name: settings.business_name ?? 'Top of the Hill Rooms',
    about_text: settings.about_text ?? '',
    contact_phone: settings.contact_phone ?? '',
    contact_email: settings.contact_email ?? '',
    contact_address: settings.contact_address ?? '',
    logo_url: settings.logo_url ?? '',
    logo_size: settings.logo_size ?? 52,
    global_house_rules: settings.global_house_rules ?? '',
    checkin_time: settings.checkin_time ?? '15:00',
    checkout_time: settings.checkout_time ?? '10:00',
    stripe_fee_percent: settings.stripe_fee_percent ?? 2.9,
    stripe_fee_flat: settings.stripe_fee_flat ?? 0.30,
    favicon_url: settings.favicon_url ?? '',
    favicon_large_url: settings.favicon_large_url ?? '',
    favicon_apple_url: settings.favicon_apple_url ?? '',
  })
  const [hours, setHours] = useState<BusinessHours>(() => parseHours(settings.business_hours))
  const [cancellationPolicy, setCancellationPolicy] = useState<CancellationPolicy>(
    () => parseCancellationPolicy(settings.cancellation_policy)
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ contact_phone?: string; contact_email?: string }>({})
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoError, setLogoError] = useState('')
  const logoInputRef = useRef<HTMLInputElement>(null)
  const [faviconUploading, setFaviconUploading] = useState(false)
  const [faviconError, setFaviconError] = useState('')
  const faviconInputRef = useRef<HTMLInputElement>(null)
  const [methodConfigs, setMethodConfigs] = useState<PaymentMethodConfig[]>(paymentMethodConfigs)
  const [methodSaving, setMethodSaving] = useState<Record<string, boolean>>({})
  const [methodError, setMethodError] = useState<Record<string, string>>({})

  type SettingsTab = 'general' | 'booking' | 'ai'
  const [tab, setTab] = useState<SettingsTab>('general')

  const [aiPrompts, setAiPrompts] = useState<AiPrompts>(() => {
    if (!settings.ai_prompts) return {}
    try { return JSON.parse(settings.ai_prompts) as AiPrompts } catch { return {} }
  })

  function formatPhone(raw: string): string {
    const digits = raw.replace(/\D/g, '').slice(0, 10)
    if (digits.length <= 3) return digits
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    const { name, value } = e.target
    const next = name === 'contact_phone' ? formatPhone(value) : value
    setForm((prev) => ({ ...prev, [name]: next }))
    setSaved(false)
    setError('')
    setFieldErrors((prev) => ({ ...prev, [name]: undefined }))
  }

  function validate(): boolean {
    const errors: { contact_phone?: string; contact_email?: string } = {}
    const digits = form.contact_phone.replace(/\D/g, '')
    if (form.contact_phone && digits.length !== 10) {
      errors.contact_phone = 'Phone number must be 10 digits'
    }
    if (form.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contact_email)) {
      errors.contact_email = 'Enter a valid email address'
    }
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
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

  async function handleFaviconUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFaviconUploading(true)
    setFaviconError('')
    try {
      const supabase = createClient()
      const ts = Date.now()
      const sizes: Array<{ key: 'favicon_url' | 'favicon_large_url' | 'favicon_apple_url'; size: number; name: string }> = [
        { key: 'favicon_url',       size: 32,  name: `favicon/32-${ts}.png`  },
        { key: 'favicon_large_url', size: 192, name: `favicon/192-${ts}.png` },
        { key: 'favicon_apple_url', size: 180, name: `favicon/180-${ts}.png` },
      ]

      const urls: Record<string, string> = {}

      for (const { key, size, name } of sizes) {
        const blob = await resizeToPng(file, size)
        const { data, error: uploadError } = await supabase.storage
          .from('site-assets')
          .upload(name, blob, { contentType: 'image/png', upsert: false })
        if (uploadError) throw uploadError
        const { data: { publicUrl } } = supabase.storage.from('site-assets').getPublicUrl(data.path)
        urls[key] = publicUrl
      }

      setForm((prev) => ({
        ...prev,
        favicon_url: urls.favicon_url,
        favicon_large_url: urls.favicon_large_url,
        favicon_apple_url: urls.favicon_apple_url,
      }))

      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: form.id,
          favicon_url: urls.favicon_url,
          favicon_large_url: urls.favicon_large_url,
          favicon_apple_url: urls.favicon_apple_url,
        }),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error ?? 'Failed to save favicon')
      }
    } catch (err) {
      setFaviconError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setFaviconUploading(false)
      if (faviconInputRef.current) faviconInputRef.current.value = ''
    }
  }

  function handleMethodConfigChange(
    id: string,
    field: 'is_enabled' | 'fee_percent' | 'fee_flat',
    value: boolean | number,
  ) {
    setMethodConfigs((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    )
  }

  async function saveMethodConfig(id: string, overrides?: Partial<Pick<PaymentMethodConfig, 'is_enabled' | 'fee_percent' | 'fee_flat'>>) {
    const config = methodConfigs.find((c) => c.id === id)
    if (!config) return
    const payload = { ...config, ...overrides }

    setMethodSaving((prev) => ({ ...prev, [id]: true }))
    setMethodError((prev) => ({ ...prev, [id]: '' }))

    try {
      const res = await fetch(`/api/admin/payment-method-configs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_enabled: payload.is_enabled,
          fee_percent: payload.fee_percent,
          fee_flat: payload.fee_flat,
        }),
      })
      if (!res.ok) {
        const json = await res.json()
        setMethodError((prev) => ({ ...prev, [id]: json.error ?? 'Save failed' }))
        if (overrides?.is_enabled !== undefined) {
          setMethodConfigs((prev) =>
            prev.map((c) => (c.id === id ? { ...c, is_enabled: !overrides.is_enabled } : c))
          )
        }
      }
    } catch {
      setMethodError((prev) => ({ ...prev, [id]: 'Network error' }))
      if (overrides?.is_enabled !== undefined) {
        setMethodConfigs((prev) =>
          prev.map((c) => (c.id === id ? { ...c, is_enabled: !overrides.is_enabled } : c))
        )
      }
    } finally {
      setMethodSaving((prev) => ({ ...prev, [id]: false }))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          business_hours: JSON.stringify(hours),
          global_house_rules: form.global_house_rules,
          cancellation_policy: JSON.stringify(cancellationPolicy),
          ai_prompts: JSON.stringify(aiPrompts),
        }),
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

  const settingsTabs = [
    { id: 'general', label: 'General', icon: '⚙' },
    { id: 'booking', label: 'Booking', icon: '📋' },
    { id: 'ai', label: 'AI Prompts', icon: '✨' },
  ]

  function renderMethodSection(label: string, bookingType: 'short_term' | 'long_term') {
    const methods = methodConfigs.filter((c) => c.booking_type === bookingType)
    return (
      <div>
        <h3 className="font-display text-base font-semibold text-on-surface mb-3">{label}</h3>
        <p className="text-on-surface-variant/60 text-xs mb-4 italic">
          Fee replaces the base processing fee for this payment method.
        </p>
        <div className="space-y-3">
          {methods.map((config) => (
            <div
              key={config.id}
              className="flex flex-col sm:flex-row sm:items-center gap-3 bg-surface-container rounded-xl px-4 py-3"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <button
                  type="button"
                  role="switch"
                  aria-checked={config.is_enabled}
                  aria-label={`Toggle ${config.label}`}
                  disabled={!!methodSaving[config.id]}
                  onClick={() => {
                    const newValue = !config.is_enabled
                    handleMethodConfigChange(config.id, 'is_enabled', newValue)
                    saveMethodConfig(config.id, { is_enabled: newValue })
                  }}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 disabled:cursor-not-allowed ${
                    config.is_enabled ? 'bg-primary' : 'bg-outline-variant'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                      config.is_enabled ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
                <span className="text-on-surface text-sm font-medium truncate">{config.label}</span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    aria-label={`${config.label} fee percent`}
                    value={config.fee_percent}
                    onChange={(e) =>
                      handleMethodConfigChange(config.id, 'fee_percent', Number(e.target.value))
                    }
                    onBlur={() => saveMethodConfig(config.id)}
                    className="w-16 bg-surface-highest/40 rounded-lg px-2 py-1.5 text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-secondary/50 text-right"
                  />
                  <span className="text-on-surface-variant text-sm">%</span>
                </div>
                <span className="text-on-surface-variant text-xs">+</span>
                <div className="flex items-center gap-1">
                  <span className="text-on-surface-variant text-sm">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    aria-label={`${config.label} flat fee`}
                    value={config.fee_flat}
                    onChange={(e) =>
                      handleMethodConfigChange(config.id, 'fee_flat', Number(e.target.value))
                    }
                    onBlur={() => saveMethodConfig(config.id)}
                    className="w-16 bg-surface-highest/40 rounded-lg px-2 py-1.5 text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-secondary/50 text-right"
                  />
                </div>
                {methodSaving[config.id] && (
                  <span className="text-secondary text-xs">Saving…</span>
                )}
                {methodError[config.id] && (
                  <span className="text-error text-xs">{methodError[config.id]}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <>
      <FormTabBar
        tabs={settingsTabs}
        active={tab}
        onChange={(id) => setTab(id as SettingsTab)}
      />

      <form onSubmit={handleSubmit} className="space-y-8 max-w-2xl mt-6">

        {/* ── Tab: General ── */}
        {tab === 'general' && (
          <>
            {/* Logo */}
            <section className="space-y-4">
              <h2 className="font-display text-base font-semibold text-on-surface">Site Logo</h2>
              <div className="flex items-center gap-6">
                <div className="rounded-2xl bg-surface-container flex items-center justify-center shrink-0 p-1" style={{ width: form.logo_size + 16, height: form.logo_size + 16 }}>
                  <Image
                    src={form.logo_url || '/logo.png'}
                    alt="Current logo"
                    width={form.logo_size}
                    height={form.logo_size}
                    style={{ width: form.logo_size, height: form.logo_size }}
                    className="object-contain rounded-xl"
                    unoptimized={!!form.logo_url}
                  />
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
                  {logoError && <p className="text-xs text-error">{logoError}</p>}
                </div>
                <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={handleLogoUpload} />
              </div>
              {form.logo_url && form.logo_url !== settings.logo_url && (
                <p className="text-xs text-secondary">Logo uploaded — click Save Settings below to apply it site-wide.</p>
              )}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className={labelClass}>Logo Size</label>
                  <span className="text-xs text-on-surface-variant">{form.logo_size}px</span>
                </div>
                <input type="range" min={32} max={96} step={4} value={form.logo_size} onChange={(e) => setForm((prev) => ({ ...prev, logo_size: Number(e.target.value) }))} className="w-full accent-primary" />
                <div className="flex justify-between text-xs text-on-surface-variant/50">
                  <span>Small</span><span>Large</span>
                </div>
              </div>
            </section>

            <div className="h-px bg-outline-variant" />

            {/* Favicon */}
            <section className="space-y-4">
              <h2 className="font-display text-base font-semibold text-on-surface">Favicon</h2>
              <div className="flex items-center gap-6">
                <div className="rounded-xl bg-surface-container flex items-center justify-center shrink-0" style={{ width: 48, height: 48 }}>
                  {form.favicon_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.favicon_url} alt="Favicon preview" width={32} height={32} className="object-contain" />
                  ) : (
                    <span className="text-on-surface-variant/40 text-xs">No icon</span>
                  )}
                </div>
                <div className="space-y-2">
                  <button type="button" disabled={faviconUploading} onClick={() => faviconInputRef.current?.click()} className="flex items-center gap-2 bg-surface-container hover:bg-surface-high text-on-surface-variant text-sm font-medium rounded-xl px-4 py-2.5 transition-colors disabled:opacity-50">
                    <PhotoIcon className="w-4 h-4" />
                    {faviconUploading ? 'Uploading…' : 'Upload Favicon'}
                  </button>
                  <p className="text-xs text-on-surface-variant/60">PNG, JPEG or WebP · Square image recommended · Generates 32px, 192px and 180px variants automatically</p>
                  {faviconError && <p className="text-xs text-error">{faviconError}</p>}
                </div>
                <input ref={faviconInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleFaviconUpload} />
              </div>
              {form.favicon_url && form.favicon_url !== settings.favicon_url && (
                <p className="text-xs text-secondary">Favicon saved — refresh the page to see it in the browser tab.</p>
              )}
            </section>

            <div className="h-px bg-outline-variant" />

            {/* Business info */}
            <section className="space-y-5">
              <h2 className="font-display text-base font-semibold text-on-surface">Business Info</h2>
              <div>
                <label htmlFor="business_name" className={labelClass}>Business Name</label>
                <input id="business_name" name="business_name" type="text" value={form.business_name} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <label htmlFor="about_text" className={labelClass}>About Us Text</label>
                <textarea id="about_text" name="about_text" rows={6} value={form.about_text} onChange={handleChange} className={`${inputClass} resize-y`} />
                <div className="mt-2">
                  <AIWriteButton
                    fieldType="about_us"
                    context={[
                      form.business_name && `Business name: ${form.business_name}`,
                      form.contact_address && `Address: ${form.contact_address}`,
                      form.contact_phone && `Phone: ${form.contact_phone}`,
                      form.contact_email && `Email: ${form.contact_email}`,
                      'Type of business: short-term and long-term residential rentals',
                    ].filter(Boolean).join('\n')}
                    onAccept={(text) => { setForm((prev) => ({ ...prev, about_text: text })); setSaved(false) }}
                  />
                </div>
              </div>
            </section>

            <div className="h-px bg-outline-variant" />

            {/* Contact info */}
            <section className="space-y-5">
              <h2 className="font-display text-base font-semibold text-on-surface">Contact Info</h2>
              <div>
                <label htmlFor="contact_phone" className={labelClass}>Phone</label>
                <input id="contact_phone" name="contact_phone" type="tel" value={form.contact_phone} onChange={handleChange} placeholder="(555) 555-5555" className={`${inputClass} ${fieldErrors.contact_phone ? 'ring-1 ring-error' : ''}`} />
                {fieldErrors.contact_phone && <p className="text-xs text-error mt-1">{fieldErrors.contact_phone}</p>}
              </div>
              <div>
                <label htmlFor="contact_email" className={labelClass}>Email</label>
                <input id="contact_email" name="contact_email" type="text" value={form.contact_email} onChange={handleChange} placeholder="you@example.com" className={`${inputClass} ${fieldErrors.contact_email ? 'ring-1 ring-error' : ''}`} />
                {fieldErrors.contact_email && <p className="text-xs text-error mt-1">{fieldErrors.contact_email}</p>}
              </div>
              <div>
                <label htmlFor="contact_address" className={labelClass}>Address</label>
                <textarea id="contact_address" name="contact_address" rows={2} value={form.contact_address} onChange={handleChange} className={`${inputClass} resize-y`} />
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
                      <button type="button" onClick={() => setHours((prev) => ({ ...prev, [day]: { ...prev[day], closed: !prev[day].closed } }))} className={['relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary', dayHours.closed ? 'bg-surface-high' : 'bg-primary'].join(' ')} aria-label={`Toggle ${day}`}>
                        <span className={['inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform', dayHours.closed ? 'translate-x-0.5' : 'translate-x-4'].join(' ')} />
                      </button>
                      <span className="w-8 text-sm font-medium text-on-surface shrink-0">{day}</span>
                      {dayHours.closed ? (
                        <span className="text-sm text-on-surface-variant/50 italic">Closed</span>
                      ) : (
                        <div className="flex items-center gap-2 flex-1">
                          <input type="time" value={dayHours.open} onChange={(e) => setHours((prev) => ({ ...prev, [day]: { ...prev[day], open: e.target.value } }))} className="bg-surface-highest/40 rounded-xl px-3 py-1.5 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary/50 [color-scheme:light]" />
                          <span className="text-on-surface-variant/50 text-sm">to</span>
                          <input type="time" value={dayHours.close} onChange={(e) => setHours((prev) => ({ ...prev, [day]: { ...prev[day], close: e.target.value } }))} className="bg-surface-highest/40 rounded-xl px-3 py-1.5 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary/50 [color-scheme:light]" />
                          {dayHours.open && dayHours.close && (
                            <span className="text-xs text-on-surface-variant/50 hidden sm:inline">{fmt12(dayHours.open)} – {fmt12(dayHours.close)}</span>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          </>
        )}

        {/* ── Tab: Booking ── */}
        {tab === 'booking' && (
          <>
            {/* Global House Rules */}
            <section className="space-y-4">
              <div>
                <h2 className="font-display text-base font-semibold text-on-surface">Global House Rules</h2>
                <p className="text-xs text-on-surface-variant/60 mt-0.5">Default rules applied to all properties. Each property can override these with its own custom rules.</p>
              </div>
              <textarea id="global_house_rules" name="global_house_rules" rows={6} value={form.global_house_rules} onChange={handleChange} placeholder="No smoking, no parties, quiet hours after 10pm…" className={`${inputClass} resize-y`} />
            </section>

            <div className="h-px bg-outline-variant" />

            {/* Short-term Booking Times */}
            <section className="space-y-4">
              <div>
                <h2 className="font-display text-base font-semibold text-on-surface">Short-term Booking Times</h2>
                <p className="text-xs text-on-surface-variant/60 mt-0.5">Standard check-in and check-out times applied to all short-term listings.</p>
              </div>
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label htmlFor="checkin_time" className={labelClass}>Check-in Time</label>
                  <div className="flex items-center gap-3">
                    <input id="checkin_time" name="checkin_time" type="time" value={form.checkin_time} onChange={handleChange} className="bg-surface-highest/40 rounded-xl px-3 py-2.5 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary/50 [color-scheme:light]" />
                    {form.checkin_time && <span className="text-sm text-on-surface-variant">{fmt12(form.checkin_time)}</span>}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="checkout_time" className={labelClass}>Check-out Time</label>
                  <div className="flex items-center gap-3">
                    <input id="checkout_time" name="checkout_time" type="time" value={form.checkout_time} onChange={handleChange} className="bg-surface-highest/40 rounded-xl px-3 py-2.5 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary/50 [color-scheme:light]" />
                    {form.checkout_time && <span className="text-sm text-on-surface-variant">{fmt12(form.checkout_time)}</span>}
                  </div>
                </div>
              </div>
            </section>

            <div className="h-px bg-outline-variant" />

            {/* Payment Processing */}
            <section className="space-y-4">
              <div>
                <h2 className="font-display text-base font-semibold text-on-surface">Payment Processing</h2>
                <p className="text-xs text-on-surface-variant/60 mt-0.5">Stripe&apos;s standard rate is 2.9% + $0.30 per transaction.</p>
              </div>
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label htmlFor="stripe_fee_percent" className={labelClass}>Processing fee (%)</label>
                  <input id="stripe_fee_percent" name="stripe_fee_percent" type="number" step="0.01" min="0" value={form.stripe_fee_percent} onChange={(e) => setForm((prev) => ({ ...prev, stripe_fee_percent: Number(e.target.value) }))} className={inputClass} />
                  <p className="text-xs text-on-surface-variant/50">e.g. 2.9 for 2.9%</p>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="stripe_fee_flat" className={labelClass}>Processing fee (flat, $)</label>
                  <input id="stripe_fee_flat" name="stripe_fee_flat" type="number" step="0.01" min="0" value={form.stripe_fee_flat} onChange={(e) => setForm((prev) => ({ ...prev, stripe_fee_flat: Number(e.target.value) }))} className={inputClass} />
                  <p className="text-xs text-on-surface-variant/50">e.g. 0.30 for $0.30</p>
                </div>
              </div>
            </section>

            <div className="h-px bg-outline-variant" />

            {/* Cancellation Policy */}
            <section className="space-y-4">
              <div>
                <h2 className="font-display text-base font-semibold text-on-surface">Default Cancellation Policy</h2>
                <p className="text-xs text-on-surface-variant/60 mt-0.5">System-wide default applied to all rooms unless overridden at property or room level.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div className="space-y-1.5">
                  <label htmlFor="full_refund_days" className={labelClass}>Full refund window (days)</label>
                  <input id="full_refund_days" type="number" min="0" step="1" value={cancellationPolicy.full_refund_days} onChange={(e) => setCancellationPolicy((p) => ({ ...p, full_refund_days: Number(e.target.value) }))} className={inputClass} />
                  <p className="text-xs text-on-surface-variant/50">e.g. 7 = full refund if cancelled &gt;7 days out</p>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="partial_refund_hours" className={labelClass}>Partial refund cutoff (hours)</label>
                  <input id="partial_refund_hours" type="number" min="0" step="1" value={cancellationPolicy.partial_refund_hours} onChange={(e) => setCancellationPolicy((p) => ({ ...p, partial_refund_hours: Number(e.target.value) }))} className={inputClass} />
                  <p className="text-xs text-on-surface-variant/50">e.g. 72 = partial% if &gt;72 hrs but within full window</p>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="partial_refund_percent" className={labelClass}>Partial refund amount (%)</label>
                  <input id="partial_refund_percent" type="number" min="0" max="100" step="1" value={cancellationPolicy.partial_refund_percent} onChange={(e) => setCancellationPolicy((p) => ({ ...p, partial_refund_percent: Number(e.target.value) }))} className={inputClass} />
                  <p className="text-xs text-on-surface-variant/50">e.g. 50 = 50% refund in the middle tier</p>
                </div>
              </div>
            </section>
          </>
        )}

        {/* ── Tab: AI Prompts ── */}
        {tab === 'ai' && (
          <section className="space-y-6">
            <div>
              <h2 className="font-display text-base font-semibold text-on-surface">AI Prompts</h2>
              <p className="text-xs text-on-surface-variant/60 mt-0.5">
                Customise the prompts used when generating copy. Leave blank to use the built-in defaults.
                Available variables: <code className="text-secondary text-xs">{'{context}'}</code> (property/room details),{' '}
                <code className="text-secondary text-xs">{'{hint}'}</code> (admin hint, omitted if blank).
              </p>
            </div>

            {([
              { key: 'system_prompt' as const, label: 'System Prompt', rows: 5, placeholder: DEFAULT_SYSTEM_PROMPT },
              { key: 'property_description' as const, label: 'Property Description Prompt', rows: 4, placeholder: DEFAULT_USER_PROMPTS.property_description },
              { key: 'room_description' as const, label: 'Room Description Prompt', rows: 4, placeholder: DEFAULT_USER_PROMPTS.room_description },
              { key: 'short_description' as const, label: 'Short Description Prompt', rows: 4, placeholder: DEFAULT_USER_PROMPTS.short_description },
              { key: 'about_us' as const, label: 'About Us Prompt', rows: 4, placeholder: DEFAULT_USER_PROMPTS.about_us },
            ] as const).map(({ key, label, rows, placeholder }) => (
              <div key={key}>
                <label className={labelClass}>{label}</label>
                <textarea
                  rows={rows}
                  value={aiPrompts[key] ?? ''}
                  onChange={(e) => setAiPrompts((prev) => ({ ...prev, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className={`${inputClass} resize-y font-mono text-xs`}
                />
              </div>
            ))}
          </section>
        )}

        {/* Save button — always visible */}
        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={saving}
            className="bg-gradient-to-r from-primary to-secondary text-background rounded-2xl px-6 py-2.5 font-semibold shadow-[0_0_10px_rgba(45,212,191,0.30)] disabled:opacity-50 transition-opacity"
          >
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
          {saved && <span className="text-sm text-secondary">Settings saved.</span>}
          {error && <span className="text-sm text-error">{error}</span>}
        </div>
      </form>

      {/* Payment Methods — only shown on Booking tab */}
      {tab === 'booking' && (
        <div className="mt-8 space-y-6 max-w-2xl">
          <div>
            <h2 className="font-display text-lg font-semibold text-on-surface mb-1">Payment Methods</h2>
            <p className="text-on-surface-variant text-sm mb-6">Configure which payment methods guests can use and the processing fee for each.</p>
          </div>
          <div className="h-px bg-outline-variant" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {renderMethodSection('Short-term Bookings', 'short_term')}
            {renderMethodSection('Long-term Bookings', 'long_term')}
          </div>
        </div>
      )}
    </>
  )
}
