'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Property } from '@/types'
import AmenitiesTagInput from './AmenitiesTagInput'
import ImageUploader from './ImageUploader'

interface PropertyFormProps {
  property?: Property
  propertyId?: string
}

export default function PropertyForm({ property, propertyId }: PropertyFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState(property?.name ?? '')
  const [address, setAddress] = useState(property?.address ?? '')
  const [city, setCity] = useState(property?.city ?? '')
  const [state, setState] = useState(property?.state ?? '')
  const [description, setDescription] = useState(property?.description ?? '')
  const [bedrooms, setBedrooms] = useState(property?.bedrooms ?? 0)
  const [bathrooms, setBathrooms] = useState(property?.bathrooms ?? 0)
  const [amenities, setAmenities] = useState<string[]>(property?.amenities ?? [])
  const [houseRules, setHouseRules] = useState(property?.house_rules ?? '')
  const [images, setImages] = useState<string[]>(property?.images ?? [])
  const [error, setError] = useState<string | null>(null)

  const inputClass =
    'w-full bg-surface-highest/40 rounded-xl px-4 py-3 text-on-surface placeholder-on-surface-variant/50 focus:outline-none focus:ring-1 focus:ring-secondary/50'
  const labelClass = 'block text-sm font-medium text-on-surface-variant mb-1.5'

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const payload = {
      id: propertyId,
      name,
      address,
      city,
      state,
      description,
      bedrooms,
      bathrooms,
      amenities,
      house_rules: houseRules,
      images,
    }

    startTransition(async () => {
      try {
        const res = await fetch('/api/admin/properties', {
          method: propertyId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error ?? 'Save failed')
        }

        window.location.href = '/admin/properties'
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Save failed')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Basic Info */}
      <section className="bg-surface-highest/40 backdrop-blur-xl rounded-2xl p-6 space-y-5">
        <h2 className="font-display text-lg font-semibold text-on-surface">Basic Information</h2>

        <div>
          <label className={labelClass}>Property Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="e.g. Hill House"
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Street Address</label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            required
            placeholder="123 Main St"
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-2 gap-5">
          <div>
            <label className={labelClass}>City</label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              required
              placeholder="Phoenix"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>State</label>
            <input
              type="text"
              value={state}
              onChange={(e) => setState(e.target.value)}
              required
              placeholder="AZ"
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Brief description of the property"
            className={inputClass}
          />
        </div>
      </section>

      {/* Property Details */}
      <section className="bg-surface-highest/40 backdrop-blur-xl rounded-2xl p-6 space-y-5">
        <h2 className="font-display text-lg font-semibold text-on-surface">Property Details</h2>
        <div className="grid grid-cols-2 gap-5">
          <div>
            <label className={labelClass}>Total Bedrooms</label>
            <input
              type="number"
              value={bedrooms}
              onChange={(e) => setBedrooms(Number(e.target.value))}
              min={0}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Total Bathrooms</label>
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
      </section>

      {/* Amenities */}
      <section className="bg-surface-highest/40 backdrop-blur-xl rounded-2xl p-6 space-y-4">
        <h2 className="font-display text-lg font-semibold text-on-surface">Amenities</h2>
        <p className="text-xs text-on-surface-variant/60">These apply to all rooms in this property.</p>
        <AmenitiesTagInput value={amenities} onChange={setAmenities} />
      </section>

      {/* House Rules */}
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
        <h2 className="font-display text-lg font-semibold text-on-surface">Property Images</h2>
        <p className="text-xs text-on-surface-variant/60">
          Upload the full image library for this property. Rooms will select from these images.
        </p>
        <ImageUploader
          images={images}
          bucket="property-images"
          uploadFolder={propertyId ?? 'new'}
          onChange={setImages}
        />
      </section>

      {error && (
        <p className="text-sm text-error bg-error-container/30 rounded-xl px-4 py-3">{error}</p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="bg-gradient-to-r from-primary to-secondary text-background font-semibold rounded-2xl px-8 py-3 hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? 'Saving…' : property ? 'Save Changes' : 'Create Property'}
        </button>
      </div>
    </form>
  )
}
