'use client'

import { useState, useTransition } from 'react'
import { ClipboardDocumentIcon, CheckIcon } from '@heroicons/react/24/outline'
import type { Room, Property, ICalSource } from '@/types'
import AmenitiesTagInput from './AmenitiesTagInput'
import ICalSourcesManager from './ICalSourcesManager'
import PropertyImagePicker from './PropertyImagePicker'
import AIWriteButton from './AIWriteButton'
import CollapsibleSection from './CollapsibleSection'

interface RoomFormProps {
  room?: Room
  properties: Property[]
  icalSources?: ICalSource[]
  roomId?: string
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
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
        <span className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
      <span className="text-sm text-on-surface-variant">{label}</span>
    </div>
  )
}

export default function RoomForm({ room, properties, icalSources, roomId }: RoomFormProps) {
  const [isPending, startTransition] = useTransition()
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
  const [securityDeposit, setSecurityDeposit] = useState(room?.security_deposit ?? 0)
  const [extraGuestFee, setExtraGuestFee] = useState(room?.extra_guest_fee ?? 0)
  const [cancellationWindowHours, setCancellationWindowHours] = useState(room?.cancellation_window_hours ?? 72)
  const [usePropertyCancellationPolicy, setUsePropertyCancellationPolicy] = useState(
    room?.use_property_cancellation_policy ?? true
  )
  const [cancellationPolicy, setCancellationPolicy] = useState<{
    full_refund_days: number
    partial_refund_hours: number
    partial_refund_percent: number
  }>(() => {
    const DEFAULT = { full_refund_days: 7, partial_refund_hours: 72, partial_refund_percent: 50 }
    if (!room?.cancellation_policy) return DEFAULT
    try { return { ...DEFAULT, ...JSON.parse(room.cancellation_policy) } }
    catch { return DEFAULT }
  })
  const [additionalFees, setAdditionalFees] = useState<
    { label: string; amount: number; booking_type: 'short_term' | 'long_term' | 'both' }[]
  >(
    (room?.fees ?? []).map(({ label, amount, booking_type }) => ({ label, amount, booking_type }))
  )
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedProperty = properties.find((p) => p.id === propertyId)
  const propertyImages = selectedProperty?.images ?? []
  const propertyAmenities = selectedProperty?.amenities ?? []

  function buildAIContext() {
    const parts: string[] = []
    if (name) parts.push(`Room name: ${name}`)
    if (selectedProperty) parts.push(`Property: ${selectedProperty.name}`)
    if (bedrooms) parts.push(`Bedrooms: ${bedrooms}`)
    if (bathrooms) parts.push(`Bathrooms: ${bathrooms}`)
    if (guestCapacity) parts.push(`Guest capacity: ${guestCapacity}`)
    const allAmenities = Array.from(new Set([...propertyAmenities, ...amenities]))
    if (allAmenities.length) parts.push(`Amenities: ${allAmenities.join(', ')}`)
    if (showNightlyRate && nightlyRate) parts.push(`Nightly rate: $${nightlyRate}`)
    if (showMonthlyRate && monthlyRate) parts.push(`Monthly rate: $${monthlyRate}`)
    return parts.join('\n')
  }

  const icalExportUrl = room?.ical_export_token
    ? `https://tothrooms.com/api/ical/${room.ical_export_token}`
    : null

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
      security_deposit: securityDeposit,
      extra_guest_fee: extraGuestFee,
      fees: additionalFees,
      cancellation_window_hours: cancellationWindowHours,
      cancellation_policy: usePropertyCancellationPolicy ? null : JSON.stringify(cancellationPolicy),
      use_property_cancellation_policy: usePropertyCancellationPolicy,
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
        window.location.href = '/admin/rooms'
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Save failed')
      }
    })
  }

  const inputClass =
    'w-full bg-surface-highest/40 rounded-xl px-4 py-3 text-on-surface placeholder-on-surface-variant/50 focus:outline-none focus:ring-1 focus:ring-secondary/50'
  const labelClass = 'block text-sm font-medium text-on-surface-variant mb-1.5'

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <CollapsibleSection title="Basic Information" defaultOpen={!roomId}>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className={labelClass}>Room Name</label>
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
            <label className={labelClass}>Slug</label>
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
                Preview: tothrooms.com/rooms/<span className="text-secondary">{slug}</span>
              </p>
            )}
          </div>
        </div>

        <div>
          <label className={labelClass}>Property</label>
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
            placeholder="Brief tagline shown on listing cards"
            className={inputClass}
          />
          <div className="mt-2">
            <AIWriteButton
              fieldType="short_description"
              context={buildAIContext()}
              onAccept={setShortDescription}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Full Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="Detailed description of the room"
            className={inputClass}
          />
          <div className="mt-2">
            <AIWriteButton
              fieldType="room_description"
              context={buildAIContext()}
              onAccept={setDescription}
            />
          </div>
        </div>

        <Toggle checked={isActive} onChange={setIsActive} label={isActive ? 'Active' : 'Inactive'} />
      </CollapsibleSection>

      <CollapsibleSection title="Room Details" defaultOpen={!roomId}>

        <div className="grid grid-cols-3 gap-5">
          <div>
            <label className={labelClass}>Guests</label>
            <input type="number" value={guestCapacity} onChange={(e) => setGuestCapacity(Number(e.target.value))} min={1} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Bedrooms</label>
            <input type="number" value={bedrooms} onChange={(e) => setBedrooms(Number(e.target.value))} min={1} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Bathrooms</label>
            <input type="number" value={bathrooms} onChange={(e) => setBathrooms(Number(e.target.value))} min={0} step={0.5} className={inputClass} />
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Pricing & Minimums" defaultOpen={!roomId}>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Nightly */}
          <div className="space-y-3">
            <Toggle checked={showNightlyRate} onChange={setShowNightlyRate} label="Show nightly rate" />
            <div className={showNightlyRate ? '' : 'opacity-40 pointer-events-none'}>
              <label className={labelClass}>Nightly Rate</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/60">$</span>
                <input type="number" value={nightlyRate} onChange={(e) => setNightlyRate(Number(e.target.value))} min={0} className={`${inputClass} pl-8`} />
              </div>
            </div>
            <div className={showNightlyRate ? '' : 'opacity-40 pointer-events-none'}>
              <label className={labelClass}>Cleaning Fee</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/60">$</span>
                <input
                  type="number"
                  value={cleaningFee}
                  onChange={(e) => setCleaningFee(Number(e.target.value))}
                  min={0}
                  className={`${inputClass} pl-8`}
                />
              </div>
            </div>
            <div className={showNightlyRate ? '' : 'opacity-40 pointer-events-none'}>
              <label className={labelClass}>Min Nights (Short-term)</label>
              <input type="number" value={minNightsShort} onChange={(e) => setMinNightsShort(Number(e.target.value))} min={1} className={inputClass} />
            </div>
          </div>

          {/* Monthly */}
          <div className="space-y-3">
            <Toggle checked={showMonthlyRate} onChange={setShowMonthlyRate} label="Show monthly rate" />
            <div className={showMonthlyRate ? '' : 'opacity-40 pointer-events-none'}>
              <label className={labelClass}>Monthly Rate</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/60">$</span>
                <input type="number" value={monthlyRate} onChange={(e) => setMonthlyRate(Number(e.target.value))} min={0} className={`${inputClass} pl-8`} />
              </div>
            </div>
            <div className={showMonthlyRate ? '' : 'opacity-40 pointer-events-none'}>
              <label className={labelClass}>Security Deposit</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/60">$</span>
                <input
                  type="number"
                  value={securityDeposit}
                  onChange={(e) => setSecurityDeposit(Number(e.target.value))}
                  min={0}
                  className={`${inputClass} pl-8`}
                />
              </div>
            </div>
            <div className={showMonthlyRate ? '' : 'opacity-40 pointer-events-none'}>
              <label className={labelClass}>Min Nights (Long-term)</label>
              <input type="number" value={minNightsLong} onChange={(e) => setMinNightsLong(Number(e.target.value))} min={1} className={inputClass} />
            </div>
          </div>
        </div>

        <div>
          <label className={labelClass}>
            Extra Guest Fee{' '}
            <span className="font-normal text-xs text-on-surface-variant/50">
              (per additional guest / night or month)
            </span>
          </label>
          <div className="relative max-w-xs">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/60">$</span>
            <input
              type="number"
              value={extraGuestFee}
              onChange={(e) => setExtraGuestFee(Number(e.target.value))}
              min={0}
              className={`${inputClass} pl-8`}
            />
          </div>
        </div>
        <div>
          <label className={labelClass}>Cancellation Window (hours)</label>
          <input
            type="number"
            min={0}
            step={1}
            value={cancellationWindowHours}
            onChange={(e) => setCancellationWindowHours(Number(e.target.value))}
            className={`${inputClass} max-w-xs`}
          />
          <p className="text-xs text-on-surface-variant/60 mt-1">
            Guests cannot cancel or modify within this many hours of check-in. Default: 72.
          </p>
        </div>

        {/* Cancellation policy override */}
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium text-on-surface-variant">Cancellation Policy Override</p>
            <p className="text-xs text-on-surface-variant/60 mt-0.5">
              Use the property/system policy, or set a room-specific one.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={usePropertyCancellationPolicy}
            onClick={() => setUsePropertyCancellationPolicy((v) => !v)}
            className="flex items-center gap-3 group"
          >
            <span className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${usePropertyCancellationPolicy ? 'bg-secondary' : 'bg-surface-container'}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${usePropertyCancellationPolicy ? 'translate-x-6' : 'translate-x-1'}`} />
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
                  type="number" min="0" step="1"
                  value={cancellationPolicy.full_refund_days}
                  onChange={(e) => setCancellationPolicy((p) => ({ ...p, full_refund_days: Number(e.target.value) }))}
                  className="w-full bg-surface-highest/40 rounded-xl px-3 py-2 text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-secondary/50"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-on-surface-variant">Partial refund cutoff (hours)</label>
                <input
                  type="number" min="0" step="1"
                  value={cancellationPolicy.partial_refund_hours}
                  onChange={(e) => setCancellationPolicy((p) => ({ ...p, partial_refund_hours: Number(e.target.value) }))}
                  className="w-full bg-surface-highest/40 rounded-xl px-3 py-2 text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-secondary/50"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-on-surface-variant">Partial refund amount (%)</label>
                <input
                  type="number" min="0" max="100" step="1"
                  value={cancellationPolicy.partial_refund_percent}
                  onChange={(e) => setCancellationPolicy((p) => ({ ...p, partial_refund_percent: Number(e.target.value) }))}
                  className="w-full bg-surface-highest/40 rounded-xl px-3 py-2 text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-secondary/50"
                />
              </div>
            </div>
          )}
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Additional Fees" defaultOpen={!roomId}>
        <p className="text-xs text-on-surface-variant/60">
          Custom fees charged to guests at booking, in addition to the cleaning fee, security deposit, and extra guest fee above.
        </p>

        <div className="space-y-3">
          {additionalFees.map((fee, idx) => (
            <div key={idx} className="grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center">
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
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60 text-sm">$</span>
                <input
                  type="number"
                  value={fee.amount}
                  onChange={(e) => {
                    const next = [...additionalFees]
                    next[idx] = { ...next[idx], amount: Number(e.target.value) }
                    setAdditionalFees(next)
                  }}
                  min={0}
                  className={`${inputClass} pl-7 w-28`}
                />
              </div>
              <select
                value={fee.booking_type}
                onChange={(e) => {
                  const next = [...additionalFees]
                  next[idx] = { ...next[idx], booking_type: e.target.value as 'short_term' | 'long_term' | 'both' }
                  setAdditionalFees(next)
                }}
                className={`${inputClass} w-36`}
              >
                <option value="short_term">Short-term</option>
                <option value="long_term">Long-term</option>
                <option value="both">Both</option>
              </select>
              <button
                type="button"
                onClick={() => setAdditionalFees(additionalFees.filter((_, i) => i !== idx))}
                className="text-error hover:opacity-70 transition-opacity text-sm px-2"
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() =>
            setAdditionalFees([...additionalFees, { label: '', amount: 0, booking_type: 'both' }])
          }
          className="text-sm text-secondary hover:opacity-80 transition-opacity border border-secondary/30 rounded-xl px-4 py-2"
        >
          + Add Fee
        </button>
      </CollapsibleSection>

      <CollapsibleSection title="Amenities" defaultOpen={!roomId}>

        {propertyAmenities.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-on-surface-variant uppercase tracking-wider">
              Inherited from property
            </p>
            <div className="flex flex-wrap gap-2">
              {propertyAmenities.map((a) => (
                <span
                  key={a}
                  className="px-3 py-1 rounded-full text-xs bg-surface-container text-on-surface-variant border border-outline-variant/40"
                >
                  {a}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-xs font-medium text-on-surface-variant uppercase tracking-wider">
            Room-specific
          </p>
          <p className="text-xs text-on-surface-variant/60">Add amenities unique to this room. Duplicates of property amenities will be merged automatically.</p>
          <AmenitiesTagInput value={amenities} onChange={setAmenities} context="room" />
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Images" defaultOpen={!roomId}>
        <PropertyImagePicker propertyImages={propertyImages} selectedImages={images} onChange={setImages} />
      </CollapsibleSection>

      {icalExportUrl && (
        <CollapsibleSection title="iCal Export" defaultOpen={!roomId}>
          <div className="flex items-center gap-3 bg-surface-container rounded-xl px-4 py-3">
            <p className="flex-1 text-sm text-on-surface-variant/70 truncate font-mono">{icalExportUrl}</p>
            <button type="button" onClick={copyICalUrl} className="flex items-center gap-1.5 shrink-0 text-sm text-secondary hover:text-on-surface transition-colors">
              {copied ? (<><CheckIcon className="w-4 h-4 text-secondary" />Copied</>) : (<><ClipboardDocumentIcon className="w-4 h-4" />Copy</>)}
            </button>
          </div>
        </CollapsibleSection>
      )}

      {roomId && (
        <CollapsibleSection title="iCal Import Sources" defaultOpen={false}>
          <ICalSourcesManager roomId={roomId} sources={icalSources ?? []} />
        </CollapsibleSection>
      )}

      {error && <p className="text-sm text-error bg-error-container/30 rounded-xl px-4 py-3">{error}</p>}

      <div className="flex justify-end">
        <button type="submit" disabled={isPending} className="bg-gradient-to-r from-primary to-secondary text-background font-semibold rounded-2xl px-8 py-3 hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed">
          {isPending ? 'Saving…' : room ? 'Save Changes' : 'Create Room'}
        </button>
      </div>
    </form>
  )
}
