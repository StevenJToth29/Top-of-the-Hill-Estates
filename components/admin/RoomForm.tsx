'use client'

import { useState, useTransition } from 'react'
import { ClipboardDocumentIcon, CheckIcon } from '@heroicons/react/24/outline'
import type { Room, Property, ICalSource } from '@/types'
import AmenitiesTagInput from './AmenitiesTagInput'
import ImageUploader from './ImageUploader'
import ICalSourcesManager from './ICalSourcesManager'

interface RoomFormProps {
  room?: Room
  properties: Property[]
  icalSources?: ICalSource[]
  roomId?: string
  onSave: (formData: FormData) => Promise<void>
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export default function RoomForm({ room, properties, icalSources, roomId, onSave }: RoomFormProps) {
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
  const [minNightsShort, setMinNightsShort] = useState(room?.minimum_nights_short_term ?? 1)
  const [minNightsLong, setMinNightsLong] = useState(room?.minimum_nights_long_term ?? 30)
  const [houseRules, setHouseRules] = useState(room?.house_rules ?? '')
  const [isActive, setIsActive] = useState(room?.is_active ?? true)
  const [amenities, setAmenities] = useState<string[]>(room?.amenities ?? [])
  const [images, setImages] = useState<string[]>(room?.images ?? [])
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    const fd = new FormData(e.currentTarget)
    // Append controlled fields
    fd.set('name', name)
    fd.set('slug', slug)
    fd.set('property_id', propertyId)
    fd.set('short_description', shortDescription)
    fd.set('description', description)
    fd.set('guest_capacity', String(guestCapacity))
    fd.set('bedrooms', String(bedrooms))
    fd.set('bathrooms', String(bathrooms))
    fd.set('nightly_rate', String(nightlyRate))
    fd.set('monthly_rate', String(monthlyRate))
    fd.set('minimum_nights_short_term', String(minNightsShort))
    fd.set('minimum_nights_long_term', String(minNightsLong))
    fd.set('house_rules', houseRules)
    fd.set('is_active', isActive ? 'true' : 'false')
    fd.set('amenities', JSON.stringify(amenities))
    fd.set('images', JSON.stringify(images))
    if (roomId) fd.set('id', roomId)

    startTransition(async () => {
      try {
        await onSave(fd)
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
      {/* Basic info */}
      <section className="bg-surface-highest/40 backdrop-blur-xl rounded-2xl p-6 space-y-5">
        <h2 className="font-display text-lg font-semibold text-on-surface">Basic Information</h2>

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
        </div>

        <div className="flex items-center gap-4">
          <label className={`${labelClass} mb-0`}>Active</label>
          <button
            type="button"
            role="switch"
            aria-checked={isActive}
            onClick={() => setIsActive((v) => !v)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-secondary/50 focus:ring-offset-2 focus:ring-offset-background ${
              isActive ? 'bg-secondary' : 'bg-surface-container'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
                isActive ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
          <span className="text-sm text-on-surface-variant">{isActive ? 'Active' : 'Inactive'}</span>
        </div>
      </section>

      {/* Room details */}
      <section className="bg-surface-highest/40 backdrop-blur-xl rounded-2xl p-6 space-y-5">
        <h2 className="font-display text-lg font-semibold text-on-surface">Room Details</h2>

        <div className="grid grid-cols-3 gap-5">
          <div>
            <label className={labelClass}>Guests</label>
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
              min={0.5}
              step={0.5}
              className={inputClass}
            />
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="bg-surface-highest/40 backdrop-blur-xl rounded-2xl p-6 space-y-5">
        <h2 className="font-display text-lg font-semibold text-on-surface">Pricing &amp; Minimums</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className={labelClass}>Nightly Rate</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/60">$</span>
              <input
                type="number"
                value={nightlyRate}
                onChange={(e) => setNightlyRate(Number(e.target.value))}
                min={0}
                className={`${inputClass} pl-8`}
              />
            </div>
          </div>
          <div>
            <label className={labelClass}>Monthly Rate</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/60">$</span>
              <input
                type="number"
                value={monthlyRate}
                onChange={(e) => setMonthlyRate(Number(e.target.value))}
                min={0}
                className={`${inputClass} pl-8`}
              />
            </div>
          </div>
          <div>
            <label className={labelClass}>Min Nights (Short-term)</label>
            <input
              type="number"
              value={minNightsShort}
              onChange={(e) => setMinNightsShort(Number(e.target.value))}
              min={1}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Min Nights (Long-term)</label>
            <input
              type="number"
              value={minNightsLong}
              onChange={(e) => setMinNightsLong(Number(e.target.value))}
              min={1}
              className={inputClass}
            />
          </div>
        </div>
      </section>

      {/* Amenities */}
      <section className="bg-surface-highest/40 backdrop-blur-xl rounded-2xl p-6 space-y-4">
        <h2 className="font-display text-lg font-semibold text-on-surface">Amenities</h2>
        <AmenitiesTagInput value={amenities} onChange={setAmenities} />
      </section>

      {/* House rules */}
      <section className="bg-surface-highest/40 backdrop-blur-xl rounded-2xl p-6 space-y-4">
        <h2 className="font-display text-lg font-semibold text-on-surface">House Rules</h2>
        <textarea
          value={houseRules}
          onChange={(e) => setHouseRules(e.target.value)}
          rows={4}
          placeholder="No smoking, pets welcome, quiet hours after 10pm…"
          className={inputClass}
        />
      </section>

      {/* Images */}
      <section className="bg-surface-highest/40 backdrop-blur-xl rounded-2xl p-6 space-y-4">
        <h2 className="font-display text-lg font-semibold text-on-surface">Images</h2>
        <ImageUploader
          images={images}
          roomId={roomId ?? 'new'}
          onChange={setImages}
        />
      </section>

      {/* iCal export */}
      {icalExportUrl && (
        <section className="bg-surface-highest/40 backdrop-blur-xl rounded-2xl p-6 space-y-3">
          <h2 className="font-display text-lg font-semibold text-on-surface">iCal Export</h2>
          <div className="flex items-center gap-3 bg-surface-container rounded-xl px-4 py-3">
            <p className="flex-1 text-sm text-on-surface-variant/70 truncate font-mono">
              {icalExportUrl}
            </p>
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
        </section>
      )}

      {/* iCal sources */}
      {roomId && (
        <section className="bg-surface-highest/40 backdrop-blur-xl rounded-2xl p-6 space-y-4">
          <h2 className="font-display text-lg font-semibold text-on-surface">iCal Import Sources</h2>
          <ICalSourcesManager roomId={roomId} sources={icalSources ?? []} />
        </section>
      )}

      {error && (
        <p className="text-sm text-error bg-error-container/30 rounded-xl px-4 py-3">{error}</p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="bg-gradient-to-r from-primary to-secondary text-background font-semibold rounded-2xl px-8 py-3 hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? 'Saving…' : room ? 'Save Changes' : 'Create Room'}
        </button>
      </div>
    </form>
  )
}
