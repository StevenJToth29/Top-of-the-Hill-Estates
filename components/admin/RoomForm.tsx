'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ClipboardDocumentIcon, CheckIcon } from '@heroicons/react/24/outline'
import type { Room, Property, ICalSource, CancellationPolicy } from '@/types'
import { DEFAULT_POLICY } from '@/lib/cancellation'
import { slugify } from '@/lib/slugify'
import AmenitiesTagInput from './AmenitiesTagInput'
import ICalSourcesManager from './ICalSourcesManager'
import PropertyImagePicker from './PropertyImagePicker'
import AIWriteButton from './AIWriteButton'
import FormTabBar from './FormTabBar'

interface RoomFormProps {
  room?: Room
  properties: Property[]
  icalSources?: ICalSource[]
  roomId?: string
}

type RoomTab = 'info' | 'pricing' | 'amenities' | 'images' | 'ical'

function CompletenessBar({ checks }: { checks: [string, boolean][] }) {
  const done = checks.filter((c) => c[1]).length
  const pct = Math.round((done / checks.length) * 100)
  const barColor = pct === 100 ? 'bg-green-500' : pct >= 60 ? 'bg-secondary' : 'bg-amber-400'
  const textColor = pct === 100 ? 'text-green-600' : pct >= 60 ? 'text-secondary' : 'text-amber-600'
  return (
    <div className="flex flex-wrap gap-4 items-center bg-surface-highest/40 backdrop-blur-xl rounded-2xl border border-outline-variant/30 px-5 py-4">
      <div className="flex-1 min-w-48">
        <div className="flex justify-between items-baseline mb-1.5">
          <span className="font-display font-semibold text-sm text-on-surface">Completeness</span>
          <span className={`font-display font-bold text-base ${textColor}`}>{pct}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-surface-container overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {checks.map(([label, isDone]) => (
          <span
            key={label}
            className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${
              isDone
                ? 'bg-secondary/10 text-secondary border-secondary/20'
                : 'bg-error-container/20 text-error border-error/20'
            }`}
          >
            {isDone ? '✓ ' : ''}{label}
          </span>
        ))}
      </div>
    </div>
  )
}

function SCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface-highest/40 backdrop-blur-xl rounded-2xl border border-outline-variant/30 overflow-hidden mb-5">
      <div className="px-6 py-4 border-b border-outline-variant/20">
        <h3 className="font-display text-base font-semibold text-on-surface">{title}</h3>
        {subtitle && <p className="text-xs text-on-surface-variant/60 mt-0.5">{subtitle}</p>}
      </div>
      <div className="px-6 py-5 space-y-5">{children}</div>
    </div>
  )
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-secondary/50 focus:ring-offset-2 focus:ring-offset-background ${
          checked ? 'bg-secondary' : 'bg-surface-container'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
      <span className="text-sm text-on-surface-variant">{label}</span>
    </div>
  )
}

export default function RoomForm({ room, properties, icalSources, roomId }: RoomFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [tab, setTab] = useState<RoomTab>('info')
  const [name, setName] = useState(room?.name ?? '')
  const [slug, setSlug] = useState(room?.slug ?? '')
  const [slugManual, setSlugManual] = useState(!!room?.slug)
  const [propertyId, setPropertyId] = useState(room?.property_id ?? properties[0]?.id ?? '')
  const [shortDescription, setShortDescription] = useState(room?.short_description ?? '')
  const [description, setDescription] = useState(room?.description ?? '')
  const [guestCapacity, setGuestCapacity] = useState(room?.guest_capacity ?? 1)
  const [bedrooms, setBedrooms] = useState(room?.bedrooms ?? 1)
  const [bathrooms, setBathrooms] = useState(room?.bathrooms ?? 1)
  const [nightlyRate, setNightlyRate] = useState(room?.nightly_rate ?? 0)
  const [monthlyRate, setMonthlyRate] = useState(room?.monthly_rate ?? 0)
  const [showNightlyRate, setShowNightlyRate] = useState(room?.show_nightly_rate ?? true)
  const [showMonthlyRate, setShowMonthlyRate] = useState(room?.show_monthly_rate ?? true)
  const [minNightsShort, setMinNightsShort] = useState(room?.minimum_nights_short_term ?? 1)
  const [minNightsLong, setMinNightsLong] = useState(room?.minimum_nights_long_term ?? 30)
  const [isActive, setIsActive] = useState(room?.is_active ?? true)
  const [amenities, setAmenities] = useState<string[]>(room?.amenities ?? [])
  const [images, setImages] = useState<string[]>(room?.images ?? [])
  const [cleaningFee, setCleaningFee] = useState(room?.cleaning_fee ?? 0)
  const [cleaningFeeCalcType, setCleaningFeeCalcType] = useState<'fixed' | 'per_guest' | 'percent'>(room?.cleaning_fee_calculation_type ?? 'fixed')
  const [cleaningFeeBookingType, setCleaningFeeBookingType] = useState<'short_term' | 'long_term' | 'both'>(room?.cleaning_fee_booking_type ?? 'both')
  const [securityDeposit, setSecurityDeposit] = useState(room?.security_deposit ?? 0)
  const [securityDepositCalcType, setSecurityDepositCalcType] = useState<'fixed' | 'per_guest' | 'percent'>(room?.security_deposit_calculation_type ?? 'fixed')
  const [securityDepositBookingType, setSecurityDepositBookingType] = useState<'short_term' | 'long_term' | 'both'>(room?.security_deposit_booking_type ?? 'both')
  const [extraGuestFee, setExtraGuestFee] = useState(room?.extra_guest_fee ?? 0)
  const [extraGuestFeeCalcType, setExtraGuestFeeCalcType] = useState<'fixed' | 'per_guest' | 'percent'>(room?.extra_guest_fee_calculation_type ?? 'per_guest')
  const [extraGuestFeeBookingType, setExtraGuestFeeBookingType] = useState<'short_term' | 'long_term' | 'both'>(room?.extra_guest_fee_booking_type ?? 'both')
  const [cancellationWindowHours, setCancellationWindowHours] = useState(room?.cancellation_window_hours ?? 72)
  const [usePropertyCancellationPolicy, setUsePropertyCancellationPolicy] = useState(
    room?.use_property_cancellation_policy ?? true,
  )
  const [cancellationPolicy, setCancellationPolicy] = useState<CancellationPolicy>(() => {
    if (!room?.cancellation_policy) return DEFAULT_POLICY
    try {
      return { ...DEFAULT_POLICY, ...JSON.parse(room.cancellation_policy) }
    } catch {
      return DEFAULT_POLICY
    }
  })
  const [additionalFees, setAdditionalFees] = useState<
    { label: string; amount: number; calculation_type: 'fixed' | 'per_guest' | 'percent'; booking_type: 'short_term' | 'long_term' | 'both' }[]
  >((room?.fees ?? []).map(({ label, amount, calculation_type, booking_type }) => ({ label, amount, calculation_type: calculation_type ?? 'fixed', booking_type })))
  const [iframeBookingUrl, setIframeBookingUrl] = useState(room?.iframe_booking_url ?? '')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const isNew = !room
  const selectedProperty = properties.find((p) => p.id === propertyId)
  const propertyImages = selectedProperty?.images ?? []
  const [propertyAmenities, setPropertyAmenities] = useState<string[]>(
    selectedProperty?.amenities ?? []
  )
  const [propertyAmenitiesBaseline] = useState<string[]>(
    selectedProperty?.amenities ?? []
  )
  const [propertyAmenitiesSaving, setPropertyAmenitiesSaving] = useState(false)
  const [propertyAmenitiesSaved, setPropertyAmenitiesSaved] = useState(false)
  const [propertyAmenitiesError, setPropertyAmenitiesError] = useState<string | null>(null)

  const propertyAmenitiesDirty =
    JSON.stringify(propertyAmenities) !== JSON.stringify(propertyAmenitiesBaseline)

  async function handleSavePropertyAmenities() {
    setPropertyAmenitiesSaving(true)
    setPropertyAmenitiesError(null)
    try {
      const res = await fetch('/api/admin/properties', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: propertyId, amenities: propertyAmenities }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Save failed')
      setPropertyAmenitiesSaved(true)
      setTimeout(() => setPropertyAmenitiesSaved(false), 3000)
    } catch (err) {
      setPropertyAmenitiesError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setPropertyAmenitiesSaving(false)
    }
  }

  const icalExportUrl = room?.ical_export_token
    ? `https://tothrooms.com/api/ical/${room.ical_export_token}`
    : null

  const totalPreview = nightlyRate * minNightsShort + cleaningFee + securityDeposit

  const checks: [string, boolean][] = [
    ['Name', !!name],
    ['Property', !!propertyId],
    ['Nightly Rate', !!nightlyRate],
    ['Short desc', !!shortDescription],
    ['Full desc', !!description && description.length > 30],
    ['Image', images.length > 0],
    ['Amenities', amenities.length > 0],
  ]

  const tabs = [
    { id: 'info', label: 'Info & Details', icon: 'ℹ' },
    { id: 'pricing', label: 'Pricing & Fees', icon: '💰' },
    {
      id: 'amenities',
      label: 'Amenities',
      icon: '✨',
      badge: amenities.length + propertyAmenities.length || null,
    },
    { id: 'images', label: 'Images', icon: '🖼', badge: images.length || null, warn: images.length === 0 },
    { id: 'ical', label: 'iCal & Widget', icon: '🔗' },
  ]

  const inputClass =
    'w-full bg-surface-highest/40 rounded-xl px-4 py-3 text-on-surface placeholder-on-surface-variant/50 focus:outline-none focus:ring-1 focus:ring-secondary/50'
  const labelClass = 'block text-sm font-medium text-on-surface-variant mb-1.5'

  function buildAIContext() {
    const parts: string[] = []
    if (name) parts.push(`Room name: ${name}`)
    if (selectedProperty) parts.push(`Property: ${selectedProperty.name}`)
    if (bedrooms) parts.push(`Bedrooms: ${bedrooms}`)
    if (bathrooms) parts.push(`Bathrooms: ${bathrooms}`)
    if (guestCapacity) parts.push(`Guest capacity: ${guestCapacity}`)
    const allAmenities = Array.from(new Set([...propertyAmenities, ...amenities]))
    parts.push(`Amenities: ${allAmenities.length ? allAmenities.join(', ') : 'None listed'}`)
    const bookingTypes: string[] = []
    if (nightlyRate > 0) bookingTypes.push(`short-term (min ${minNightsShort} night${minNightsShort !== 1 ? 's' : ''})`)
    if (monthlyRate > 0) bookingTypes.push(`long-term (min ${minNightsLong} nights)`)
    if (bookingTypes.length) parts.push(`Available for: ${bookingTypes.join(' and ')}`)
    return parts.join('\n')
  }

  function handleNameChange(v: string) {
    setName(v)
    if (!slugManual) setSlug(slugify(v))
  }

  function handleSlugChange(v: string) {
    setSlug(v)
    setSlugManual(true)
  }

  async function copyICalUrl() {
    if (!icalExportUrl) return
    await navigator.clipboard.writeText(icalExportUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (additionalFees.some((f) => f.label.trim() === '')) {
      setError('All additional fees must have a label.')
      return
    }

    const payload = {
      id: roomId,
      property_id: propertyId,
      name,
      slug,
      short_description: shortDescription,
      description,
      guest_capacity: guestCapacity,
      bedrooms,
      bathrooms,
      nightly_rate: nightlyRate,
      monthly_rate: monthlyRate,
      show_nightly_rate: showNightlyRate,
      show_monthly_rate: showMonthlyRate,
      minimum_nights_short_term: minNightsShort,
      minimum_nights_long_term: minNightsLong,
      is_active: isActive,
      amenities,
      images,
      cleaning_fee: cleaningFee,
      cleaning_fee_calculation_type: cleaningFeeCalcType,
      cleaning_fee_booking_type: cleaningFeeBookingType,
      security_deposit: securityDeposit,
      security_deposit_calculation_type: securityDepositCalcType,
      security_deposit_booking_type: securityDepositBookingType,
      extra_guest_fee: extraGuestFee,
      extra_guest_fee_calculation_type: extraGuestFeeCalcType,
      extra_guest_fee_booking_type: extraGuestFeeBookingType,
      fees: additionalFees,
      cancellation_window_hours: cancellationWindowHours,
      cancellation_policy: usePropertyCancellationPolicy ? null : JSON.stringify(cancellationPolicy),
      use_property_cancellation_policy: usePropertyCancellationPolicy,
      iframe_booking_url: iframeBookingUrl || null,
    }

    startTransition(async () => {
      try {
        const res = await fetch('/api/admin/rooms', {
          method: roomId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Save failed')
        if (isNew) {
          window.location.href = `/admin/rooms/${data.id}/edit`
        } else {
          router.refresh()
          setSaved(true)
          setTimeout(() => setSaved(false), 3000)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Save failed')
      }
    })
  }

  const SaveButtons = (
    <div className="flex items-center gap-3">
      {saved && (
        <span className="flex items-center gap-1.5 text-sm text-secondary font-semibold">
          <CheckIcon className="w-4 h-4" /> Saved
        </span>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="bg-gradient-to-r from-primary to-secondary text-background font-semibold rounded-xl px-6 py-2.5 hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed text-sm"
      >
        {isPending ? 'Saving…' : isNew ? 'Create Room' : 'Save Changes'}
      </button>
    </div>
  )

  return (
    <form onSubmit={handleSubmit} className="flex flex-col min-h-screen">
      {/* ── Sticky header ── */}
      <div className="bg-background border-b border-outline-variant/30 px-6 sm:px-10 py-4 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-4 min-w-0">
          <Link
            href="/admin/rooms"
            className="flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-on-surface transition-colors shrink-0"
          >
            ← Units
          </Link>
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="font-display text-xl font-bold text-on-surface truncate">
              {isNew ? 'Add New Room' : name || 'Edit Room'}
            </h1>
            {!isNew && (
              <div
                className={`flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-semibold shrink-0 ${
                  isActive
                    ? 'bg-secondary/10 text-secondary border-secondary/20'
                    : 'bg-error-container/20 text-error border-error/20'
                }`}
              >
                <button
                  type="button"
                  role="switch"
                  aria-checked={isActive}
                  onClick={() => setIsActive((v) => !v)}
                  className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors focus:outline-none ${
                    isActive ? 'bg-secondary' : 'bg-surface-container'
                  }`}
                >
                  <span
                    className={`inline-block h-3 w-3 transform rounded-full bg-background transition-transform ${
                      isActive ? 'translate-x-3.5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
                {isActive ? 'Active' : 'Inactive'}
              </div>
            )}
          </div>
        </div>
        {SaveButtons}
      </div>

      {/* ── Content ── */}
      <div className="flex-1 px-6 sm:px-10 py-8">
        {/* Completeness bar */}
        <div className="mb-6">
          <CompletenessBar checks={checks} />
        </div>

        {/* Tab bar */}
        <div className="mb-8">
          <FormTabBar tabs={tabs} active={tab} onChange={(id) => setTab(id as RoomTab)} />
        </div>

        {/* ── Tab: Info & Details ── */}
        {tab === 'info' && (
          <div className="space-y-5">
            <SCard title="Basic Information" subtitle="Name, property assignment, and public listing content">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className={labelClass}>
                    Unit Name<span className="text-error">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    required
                    placeholder="e.g. Suite 13"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>URL Slug</label>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => handleSlugChange(e.target.value)}
                    required
                    placeholder="suite-13"
                    className={inputClass}
                  />
                  {slug && (
                    <p className="text-xs text-on-surface-variant/50 mt-1">
                      tothrooms.com/rooms/<span className="text-secondary">{slug}</span>
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className={labelClass}>
                  Property <span className="text-error">*</span>
                </label>
                {room ? (
                  <p className="px-4 py-3 rounded-xl bg-surface-highest/20 text-on-surface-variant text-sm">
                    {properties.find((p) => p.id === propertyId)?.name ?? propertyId}
                  </p>
                ) : (
                  <select
                    value={propertyId}
                    onChange={(e) => setPropertyId(e.target.value)}
                    required
                    className={inputClass}
                  >
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className={labelClass}>Short Description</label>
                <textarea
                  value={shortDescription}
                  onChange={(e) => setShortDescription(e.target.value)}
                  rows={2}
                  placeholder="Brief tagline shown on listing cards and search results…"
                  className={inputClass}
                />
                <div className="mt-2">
                  <AIWriteButton
                    fieldType="short_description"
                    context={buildAIContext()}
                    imageUrl={images[0] ?? null}
                    onAccept={setShortDescription}
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Full Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={6}
                  placeholder="Detailed description of the unit — bed type, bathroom setup, natural light, work space, what makes it special…"
                  className={inputClass}
                />
                <div className="mt-2">
                  <AIWriteButton fieldType="room_description" context={buildAIContext()} imageUrl={images[0] ?? null} onAccept={setDescription} />
                </div>
              </div>

              {isNew && (
                <Toggle
                  checked={isActive}
                  onChange={setIsActive}
                  label="Unit is active and bookable immediately after saving"
                />
              )}
            </SCard>

            <SCard title="Unit Details" subtitle="Physical specifications shown on the listing">
              <div className="grid grid-cols-3 gap-5">
                <div>
                  <label className={labelClass}>Max Guests</label>
                  <input
                    type="number"
                    value={guestCapacity}
                    onChange={(e) => setGuestCapacity(Number(e.target.value))}
                    min={1}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Bedrooms</label>
                  <input
                    type="number"
                    value={bedrooms}
                    onChange={(e) => setBedrooms(Number(e.target.value))}
                    min={1}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Bathrooms</label>
                  <input
                    type="number"
                    value={bathrooms}
                    onChange={(e) => setBathrooms(Number(e.target.value))}
                    min={0}
                    step={0.5}
                    className={inputClass}
                  />
                </div>
              </div>
            </SCard>
          </div>
        )}

        {/* ── Tab: Pricing & Fees ── */}
        {tab === 'pricing' && (
          <div className="space-y-5">
            <SCard title="Rates" subtitle="Set nightly and monthly rates for short-term and long-term guests">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="bg-surface-container/40 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-display text-sm font-semibold text-on-surface">Nightly Rate</span>
                    <Toggle checked={showNightlyRate} onChange={setShowNightlyRate} label="Show publicly" />
                  </div>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-on-surface-variant/60">
                      $
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={nightlyRate || ''}
                      onChange={(e) => setNightlyRate(Number(e.target.value))}
                      onFocus={(e) => e.target.select()}
                      placeholder="0"
                      className="w-full bg-surface-highest/40 rounded-xl pl-8 pr-4 py-3 text-2xl font-display font-bold text-secondary focus:outline-none focus:ring-1 focus:ring-secondary/50"
                    />
                  </div>
                  <p className="text-xs text-on-surface-variant/60">Per night · short-term stays</p>
                </div>

                <div className="bg-surface-container/40 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-display text-sm font-semibold text-on-surface">Monthly Rate</span>
                    <Toggle checked={showMonthlyRate} onChange={setShowMonthlyRate} label="Show publicly" />
                  </div>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-on-surface-variant/60">
                      $
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={monthlyRate || ''}
                      onChange={(e) => setMonthlyRate(Number(e.target.value))}
                      onFocus={(e) => e.target.select()}
                      placeholder="0"
                      className="w-full bg-surface-highest/40 rounded-xl pl-8 pr-4 py-3 text-2xl font-display font-bold text-secondary focus:outline-none focus:ring-1 focus:ring-secondary/50"
                    />
                  </div>
                  <p className="text-xs text-on-surface-variant/60">Per month · long-term tenants</p>
                </div>
              </div>
            </SCard>

            <SCard title="Fees & Deposits" subtitle="All charges collected at booking — set how each fee is calculated">
              {/* Column headers */}
              <div className="grid grid-cols-[1fr_140px_160px_140px_32px] gap-3 px-1 mb-1">
                <span className="text-xs font-semibold text-on-surface-variant/60 uppercase tracking-wide">Fee Name</span>
                <span className="text-xs font-semibold text-on-surface-variant/60 uppercase tracking-wide">Amount</span>
                <span className="text-xs font-semibold text-on-surface-variant/60 uppercase tracking-wide">Calculation</span>
                <span className="text-xs font-semibold text-on-surface-variant/60 uppercase tracking-wide">Applies To</span>
                <span />
              </div>

              {/* ── Standard fees ── */}
              <div className="space-y-2 pb-4 border-b border-outline-variant/20">
                {/* Cleaning Fee */}
                <div className="grid grid-cols-[1fr_140px_160px_140px_32px] gap-3 items-center bg-surface-container/30 rounded-xl px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🧹</span>
                    <div>
                      <p className="text-sm font-medium text-on-surface">Cleaning Fee</p>
                      <p className="text-xs text-on-surface-variant/50">One-time per stay</p>
                    </div>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60 text-sm">{cleaningFeeCalcType === 'percent' ? '%' : '$'}</span>
                    <input type="number" value={cleaningFee || ''} onChange={(e) => setCleaningFee(Number(e.target.value))} onFocus={(e) => e.target.select()} min={0} placeholder="0" className={`${inputClass} pl-7`} />
                  </div>
                  <select value={cleaningFeeCalcType} onChange={(e) => setCleaningFeeCalcType(e.target.value as 'fixed' | 'per_guest' | 'percent')} className={inputClass}>
                    <option value="fixed">Fixed amount</option>
                    <option value="per_guest">Per guest / night</option>
                    <option value="percent">% of rental</option>
                  </select>
                  <select value={cleaningFeeBookingType} onChange={(e) => setCleaningFeeBookingType(e.target.value as 'short_term' | 'long_term' | 'both')} className={inputClass}>
                    <option value="both">All stays</option>
                    <option value="short_term">Short-term only</option>
                    <option value="long_term">Long-term only</option>
                  </select>
                  <span />
                </div>

                {/* Security Deposit */}
                <div className="grid grid-cols-[1fr_140px_160px_140px_32px] gap-3 items-center bg-surface-container/30 rounded-xl px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🔒</span>
                    <div>
                      <p className="text-sm font-medium text-on-surface">Security Deposit</p>
                      <p className="text-xs text-on-surface-variant/50">Refundable after checkout</p>
                    </div>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60 text-sm">{securityDepositCalcType === 'percent' ? '%' : '$'}</span>
                    <input type="number" value={securityDeposit || ''} onChange={(e) => setSecurityDeposit(Number(e.target.value))} onFocus={(e) => e.target.select()} min={0} placeholder="0" className={`${inputClass} pl-7`} />
                  </div>
                  <select value={securityDepositCalcType} onChange={(e) => setSecurityDepositCalcType(e.target.value as 'fixed' | 'per_guest' | 'percent')} className={inputClass}>
                    <option value="fixed">Fixed amount</option>
                    <option value="per_guest">Per guest / night</option>
                    <option value="percent">% of rental</option>
                  </select>
                  <select value={securityDepositBookingType} onChange={(e) => setSecurityDepositBookingType(e.target.value as 'short_term' | 'long_term' | 'both')} className={inputClass}>
                    <option value="both">All stays</option>
                    <option value="short_term">Short-term only</option>
                    <option value="long_term">Long-term only</option>
                  </select>
                  <span />
                </div>

                {/* Extra Guest Fee */}
                <div className="grid grid-cols-[1fr_140px_160px_140px_32px] gap-3 items-center bg-surface-container/30 rounded-xl px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-base">👥</span>
                    <div>
                      <p className="text-sm font-medium text-on-surface">Extra Guest Fee</p>
                      <p className="text-xs text-on-surface-variant/50">Charged above base occupancy</p>
                    </div>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60 text-sm">{extraGuestFeeCalcType === 'percent' ? '%' : '$'}</span>
                    <input type="number" value={extraGuestFee || ''} onChange={(e) => setExtraGuestFee(Number(e.target.value))} onFocus={(e) => e.target.select()} min={0} placeholder="0" className={`${inputClass} pl-7`} />
                  </div>
                  <select value={extraGuestFeeCalcType} onChange={(e) => setExtraGuestFeeCalcType(e.target.value as 'fixed' | 'per_guest' | 'percent')} className={inputClass}>
                    <option value="fixed">Fixed amount</option>
                    <option value="per_guest">Per guest / night</option>
                    <option value="percent">% of rental</option>
                  </select>
                  <select value={extraGuestFeeBookingType} onChange={(e) => setExtraGuestFeeBookingType(e.target.value as 'short_term' | 'long_term' | 'both')} className={inputClass}>
                    <option value="both">All stays</option>
                    <option value="short_term">Short-term only</option>
                    <option value="long_term">Long-term only</option>
                  </select>
                  <span />
                </div>
              </div>

              {/* ── Booking preview ── */}
              {nightlyRate > 0 && (
                <div className="bg-secondary/8 rounded-xl border border-secondary/20 p-4 space-y-2">
                  <p className="font-display text-sm font-semibold text-secondary">
                    Guest-facing price — {minNightsShort} night{minNightsShort !== 1 ? 's' : ''} minimum stay
                  </p>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-sm text-secondary/80">
                      <span>${nightlyRate} × {minNightsShort} night{minNightsShort !== 1 ? 's' : ''}</span>
                      <span className="font-semibold">${(nightlyRate * minNightsShort).toLocaleString()}</span>
                    </div>
                    {cleaningFee > 0 && (
                      <div className="flex justify-between text-sm text-secondary/80">
                        <span>Cleaning fee</span>
                        <span className="font-semibold">${cleaningFee.toLocaleString()}</span>
                      </div>
                    )}
                    {securityDeposit > 0 && (
                      <div className="flex justify-between text-sm text-secondary/80">
                        <span>Security deposit (refundable)</span>
                        <span className="font-semibold">${securityDeposit.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-display font-bold text-base text-secondary border-t border-secondary/20 pt-2 mt-1">
                      <span>Total</span>
                      <span>${totalPreview.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Custom fees ── */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-medium text-on-surface">Additional Fees</p>
                    <p className="text-xs text-on-surface-variant/60">Pet fees, resort fees, parking, etc.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAdditionalFees([...additionalFees, { label: '', amount: 0, calculation_type: 'fixed', booking_type: 'both' }])}
                    className="text-sm text-secondary hover:opacity-80 transition-opacity border border-secondary/30 rounded-xl px-4 py-2"
                  >
                    + Add Fee
                  </button>
                </div>

                {additionalFees.length === 0 ? (
                  <div className="py-6 text-center border border-dashed border-outline-variant/50 rounded-xl text-sm text-on-surface-variant/60">
                    No additional fees yet
                  </div>
                ) : (
                  <div className="space-y-2">
                    {additionalFees.map((fee, idx) => (
                      <div key={idx} className="grid grid-cols-[1fr_140px_160px_140px_32px] gap-3 items-center">
                        <input
                          type="text"
                          value={fee.label}
                          onChange={(e) => {
                            const next = [...additionalFees]
                            next[idx] = { ...next[idx], label: e.target.value }
                            setAdditionalFees(next)
                          }}
                          placeholder="e.g. Pet fee"
                          className={inputClass}
                        />
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60 text-sm">
                            {fee.calculation_type === 'percent' ? '%' : '$'}
                          </span>
                          <input
                            type="number"
                            value={fee.amount || ''}
                            onChange={(e) => {
                              const next = [...additionalFees]
                              next[idx] = { ...next[idx], amount: Number(e.target.value) }
                              setAdditionalFees(next)
                            }}
                            onFocus={(e) => e.target.select()}
                            min={0}
                            placeholder="0"
                            className={`${inputClass} pl-7`}
                          />
                        </div>
                        <select
                          value={fee.calculation_type}
                          onChange={(e) => {
                            const next = [...additionalFees]
                            next[idx] = { ...next[idx], calculation_type: e.target.value as 'fixed' | 'per_guest' | 'percent' }
                            setAdditionalFees(next)
                          }}
                          className={inputClass}
                        >
                          <option value="fixed">Fixed amount</option>
                          <option value="per_guest">Per guest / night</option>
                          <option value="percent">% of rental</option>
                        </select>
                        <select
                          value={fee.booking_type}
                          onChange={(e) => {
                            const next = [...additionalFees]
                            next[idx] = { ...next[idx], booking_type: e.target.value as 'short_term' | 'long_term' | 'both' }
                            setAdditionalFees(next)
                          }}
                          className={inputClass}
                        >
                          <option value="both">All stays</option>
                          <option value="short_term">Short-term only</option>
                          <option value="long_term">Long-term only</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => setAdditionalFees(additionalFees.filter((_, i) => i !== idx))}
                          className="flex items-center justify-center w-8 h-8 rounded-lg text-error hover:bg-error-container/30 transition-colors"
                          aria-label="Remove fee"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </SCard>

            <SCard title="Stay Requirements & Policy" subtitle="Minimum stay, cancellation window, and policy override">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className={labelClass}>
                    Min Nights — Short-term{' '}
                    <span className="text-secondary font-bold">{minNightsShort}</span>
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min={1}
                      max={30}
                      value={minNightsShort}
                      onChange={(e) => setMinNightsShort(Number(e.target.value))}
                      className="flex-1 accent-secondary"
                    />
                    <input
                      type="number"
                      min={1}
                      value={minNightsShort}
                      onChange={(e) => setMinNightsShort(Number(e.target.value))}
                      className="w-16 bg-surface-highest/40 rounded-xl px-2 py-1.5 text-center text-sm font-semibold text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary/50"
                    />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Min Nights — Long-term</label>
                  <input
                    type="number"
                    value={minNightsLong}
                    onChange={(e) => setMinNightsLong(Number(e.target.value))}
                    min={1}
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Cancellation Window</label>
                <div className="grid grid-cols-5 gap-2">
                  {[24, 48, 72, 96, 120].map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setCancellationWindowHours(h)}
                      className={`py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                        cancellationWindowHours === h
                          ? 'bg-secondary/10 text-secondary border-secondary/30'
                          : 'bg-surface-highest/40 text-on-surface-variant border-outline-variant/30 hover:border-secondary/20'
                      }`}
                    >
                      {h}h
                    </button>
                  ))}
                </div>
                <p className="text-xs text-on-surface-variant/60 mt-2">
                  Guests cannot cancel within {cancellationWindowHours} hours of check-in.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-on-surface-variant">Cancellation Policy Override</p>
                  <p className="text-xs text-on-surface-variant/60 mt-0.5">
                    Use the property/system policy, or set a unit-specific one.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={usePropertyCancellationPolicy}
                  onClick={() => setUsePropertyCancellationPolicy((v) => !v)}
                  className="flex items-center gap-3 group"
                >
                  <span
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                      usePropertyCancellationPolicy ? 'bg-secondary' : 'bg-surface-container'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
                        usePropertyCancellationPolicy ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </span>
                  <span className="text-sm text-on-surface-variant group-hover:text-on-surface transition-colors">
                    Inherit from Property / System
                  </span>
                </button>

                {!usePropertyCancellationPolicy && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs text-on-surface-variant">Full refund window (days)</label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={cancellationPolicy.full_refund_days}
                        onChange={(e) =>
                          setCancellationPolicy((p) => ({ ...p, full_refund_days: Number(e.target.value) }))
                        }
                        className="w-full bg-surface-highest/40 rounded-xl px-3 py-2 text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-secondary/50"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-on-surface-variant">Partial refund cutoff (hours)</label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={cancellationPolicy.partial_refund_hours}
                        onChange={(e) =>
                          setCancellationPolicy((p) => ({ ...p, partial_refund_hours: Number(e.target.value) }))
                        }
                        className="w-full bg-surface-highest/40 rounded-xl px-3 py-2 text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-secondary/50"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-on-surface-variant">Partial refund amount (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        value={cancellationPolicy.partial_refund_percent}
                        onChange={(e) =>
                          setCancellationPolicy((p) => ({ ...p, partial_refund_percent: Number(e.target.value) }))
                        }
                        className="w-full bg-surface-highest/40 rounded-xl px-3 py-2 text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-secondary/50"
                      />
                    </div>
                  </div>
                )}
              </div>
            </SCard>
          </div>
        )}

        {/* ── Tab: Amenities ── */}
        {tab === 'amenities' && (
          <div className="space-y-5">
            <SCard
              title="Property Amenities"
              subtitle={`Changes here affect ${selectedProperty?.name ?? 'the property'} and all its units`}
            >
              <AmenitiesTagInput value={propertyAmenities} onChange={setPropertyAmenities} context="property" />
              <div className="flex items-center gap-3 pt-2 border-t border-outline-variant/20">
                <button
                  type="button"
                  onClick={handleSavePropertyAmenities}
                  disabled={!propertyAmenitiesDirty || propertyAmenitiesSaving}
                  className="bg-gradient-to-r from-primary to-secondary text-background font-semibold rounded-xl px-5 py-2 text-sm hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {propertyAmenitiesSaving ? 'Saving…' : 'Save Property Amenities'}
                </button>
                {propertyAmenitiesSaved && (
                  <span className="flex items-center gap-1.5 text-sm text-secondary font-semibold">
                    <CheckIcon className="w-4 h-4" /> Saved
                  </span>
                )}
                {propertyAmenitiesError && (
                  <span className="text-sm text-error">{propertyAmenitiesError}</span>
                )}
              </div>
            </SCard>

            <SCard
              title="Unit-Specific Amenities"
              subtitle="Add amenities unique to this unit. Duplicates of property amenities are shown only once."
            >
              <p className="text-xs text-on-surface-variant/60">Type and press Enter, or click a suggestion below.</p>
              <AmenitiesTagInput value={amenities} onChange={setAmenities} context="room" />
            </SCard>

            {[...propertyAmenities, ...amenities].length > 0 && (
              <SCard
                title="What Guests See"
                subtitle={`${Array.from(new Set([...propertyAmenities, ...amenities])).length} total amenities combined`}
              >
                <div className="flex flex-wrap gap-2">
                  {Array.from(new Set([...propertyAmenities, ...amenities])).map((a) => (
                    <span
                      key={a}
                      className="text-sm px-3 py-1.5 rounded-full bg-secondary/10 text-secondary border border-secondary/20 font-medium"
                    >
                      {a}
                    </span>
                  ))}
                </div>
              </SCard>
            )}
          </div>
        )}

        {/* ── Tab: Images ── */}
        {tab === 'images' && (
          <div className="space-y-5">
            <SCard
              title="Unit Images"
              subtitle={`Select from ${selectedProperty?.name ?? 'property'}'s image library. The first selected image is the cover photo.`}
            >
              <PropertyImagePicker propertyImages={propertyImages} selectedImages={images} onChange={setImages} />
            </SCard>
          </div>
        )}

        {/* ── Tab: iCal & Widget ── */}
        {tab === 'ical' && (
          <div className="space-y-5">
            {icalExportUrl && (
              <SCard title="iCal Export" subtitle="Share this URL with other platforms to sync your availability">
                <div className="flex items-center gap-3 bg-surface-container rounded-xl px-4 py-3">
                  <p className="flex-1 text-sm text-on-surface-variant/70 truncate font-mono">{icalExportUrl}</p>
                  <button
                    type="button"
                    onClick={copyICalUrl}
                    className="flex items-center gap-1.5 shrink-0 text-sm text-secondary hover:text-on-surface transition-colors"
                  >
                    {copied ? (
                      <>
                        <CheckIcon className="w-4 h-4 text-secondary" />
                        Copied
                      </>
                    ) : (
                      <>
                        <ClipboardDocumentIcon className="w-4 h-4" />
                        Copy
                      </>
                    )}
                  </button>
                </div>
              </SCard>
            )}

            {roomId && (
              <SCard
                title="iCal Import Sources"
                subtitle="Import availability from Airbnb, VRBO, and other platforms"
              >
                <ICalSourcesManager roomId={roomId} sources={icalSources ?? []} />
              </SCard>
            )}

            <SCard title="Booking Widget" subtitle="Override the built-in booking widget with an external embed">
              <p className="text-xs text-on-surface-variant/60">
                Paste an iframe booking URL (e.g. from Hospitable) to use it on this unit&apos;s page instead of the
                built-in booking widget. Leave blank to use the default widget.
              </p>
              <div>
                <label className={labelClass}>Iframe Booking URL</label>
                <input
                  type="url"
                  value={iframeBookingUrl}
                  onChange={(e) => setIframeBookingUrl(e.target.value)}
                  placeholder="https://booking.hospitable.com/widget/..."
                  className={inputClass}
                />
              </div>
            </SCard>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="">
            <p className="text-sm text-error bg-error-container/30 rounded-xl px-4 py-3 mt-4">{error}</p>
          </div>
        )}

        {/* Footer save bar */}
        <div className="mt-8 pb-12">
          <div className="flex justify-end gap-3 pt-4 border-t border-outline-variant/20">{SaveButtons}</div>
        </div>
      </div>
    </form>
  )
}
