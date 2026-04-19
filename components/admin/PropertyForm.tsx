'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Property, StripeAccount, CancellationPolicy } from '@/types'
import { DEFAULT_POLICY } from '@/lib/cancellation'
import AmenitiesTagInput from './AmenitiesTagInput'
import ImageUploader from './ImageUploader'
import AIWriteButton from './AIWriteButton'
import PlacesAddressInput from './PlacesAddressInput'
import CollapsibleSection from './CollapsibleSection'

interface PropertyFormProps {
  property?: Property
  propertyId?: string
  globalHouseRules?: string
  stripeAccounts?: StripeAccount[]
}

export default function PropertyForm({ property, propertyId, globalHouseRules = '', stripeAccounts = [] }: PropertyFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState(property?.name ?? '')
  const [address, setAddress] = useState(property?.address ?? '')
  const [city, setCity] = useState(property?.city ?? '')
  const [state, setState] = useState(property?.state ?? '')
  const [zip, setZip] = useState(property?.zip ?? '')
  const [description, setDescription] = useState(property?.description ?? '')
  const [bedrooms, setBedrooms] = useState(property?.bedrooms ?? 0)
  const [bathrooms, setBathrooms] = useState(property?.bathrooms ?? 0)
  const [amenities, setAmenities] = useState<string[]>(property?.amenities ?? [])
  const [useGlobalRules, setUseGlobalRules] = useState(property?.use_global_house_rules ?? true)
  const [houseRules, setHouseRules] = useState(property?.house_rules ?? '')
  const [useGlobalCancellationPolicy, setUseGlobalCancellationPolicy] = useState(
    property?.use_global_cancellation_policy ?? true
  )
  const [cancellationPolicy, setCancellationPolicy] = useState<CancellationPolicy>(() => {
    if (!property?.cancellation_policy) return DEFAULT_POLICY
    try { return { ...DEFAULT_POLICY, ...JSON.parse(property.cancellation_policy) } }
    catch { return DEFAULT_POLICY }
  })
  const [images, setImages] = useState<string[]>(property?.images ?? [])
  const [stripeAccountId, setStripeAccountId] = useState<string>(property?.stripe_account_id ?? '')
  const [platformFeePercent, setPlatformFeePercent] = useState<number>(property?.platform_fee_percent ?? 0)
  const [error, setError] = useState<string | null>(null)

  const inputClass =
    'w-full bg-surface-highest/40 rounded-xl px-4 py-3 text-on-surface placeholder-on-surface-variant/50 focus:outline-none focus:ring-1 focus:ring-secondary/50'
  const labelClass = 'block text-sm font-medium text-on-surface-variant mb-1.5'

  function buildAIContext() {
    const parts: string[] = []
    if (name) parts.push(`Property name: ${name}`)
    if (city && state) parts.push(`Location: ${city}, ${state}`)
    if (bedrooms) parts.push(`Bedrooms: ${bedrooms}`)
    if (bathrooms) parts.push(`Bathrooms: ${bathrooms}`)
    if (amenities.length) parts.push(`Amenities: ${amenities.join(', ')}`)
    return parts.join('\n')
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (stripeAccountId && (platformFeePercent < 0 || platformFeePercent > 100)) {
      setError('Platform fee must be between 0 and 100.')
      return
    }

    const payload = {
      id: propertyId,
      name,
      address,
      city,
      state,
      zip,
      description,
      bedrooms,
      bathrooms,
      amenities,
      house_rules: houseRules,
      use_global_house_rules: useGlobalRules,
      cancellation_policy: useGlobalCancellationPolicy ? null : JSON.stringify(cancellationPolicy),
      use_global_cancellation_policy: useGlobalCancellationPolicy,
      images,
      stripe_account_id: stripeAccountId || null,
      platform_fee_percent: stripeAccountId ? platformFeePercent : 0,
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
      <CollapsibleSection title="Basic Information" defaultOpen={!propertyId}>
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
          <PlacesAddressInput
            value={address}
            onChange={setAddress}
            onCityChange={setCity}
            onStateChange={setState}
            required
            placeholder="123 Main St"
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-3 gap-5">
          <div className="col-span-1">
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
          <div>
            <label className={labelClass}>ZIP Code</label>
            <input
              type="text"
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              placeholder="85201"
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
          <div className="mt-2">
            <AIWriteButton
              fieldType="property_description"
              context={buildAIContext()}
              onAccept={setDescription}
            />
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Property Details" defaultOpen={!propertyId}>
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
      </CollapsibleSection>

      <CollapsibleSection title="Amenities" defaultOpen={!propertyId}>
        <p className="text-xs text-on-surface-variant/60">These apply to all rooms in this property.</p>
        <AmenitiesTagInput value={amenities} onChange={setAmenities} />
      </CollapsibleSection>

      <CollapsibleSection title="House Rules" defaultOpen={!propertyId}>
        <button
          type="button"
          role="switch"
          aria-checked={useGlobalRules}
          onClick={() => setUseGlobalRules((v) => !v)}
          className="flex items-center gap-3 group"
        >
          <span className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${useGlobalRules ? 'bg-secondary' : 'bg-surface-container'}`}>
            <span className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${useGlobalRules ? 'translate-x-6' : 'translate-x-1'}`} />
          </span>
          <span className="text-sm text-on-surface-variant group-hover:text-on-surface transition-colors">
            Use Global House Rules
          </span>
        </button>

        {useGlobalRules ? (
          globalHouseRules ? (
            <div className="space-y-1.5">
              <p className="text-xs text-on-surface-variant/60">
                Showing global rules — edit them in{' '}
                <a href="/admin/settings" className="text-secondary underline">Site Settings</a>.
              </p>
              <div className="bg-surface-container rounded-xl px-4 py-3 text-sm text-on-surface-variant whitespace-pre-line leading-relaxed">
                {globalHouseRules}
              </div>
            </div>
          ) : (
            <p className="text-xs text-on-surface-variant/60">
              No global rules set yet — add them in{' '}
              <a href="/admin/settings" className="text-secondary underline">Site Settings</a>.
            </p>
          )
        ) : (
          <div className="space-y-1.5">
            <p className="text-xs text-on-surface-variant/60">Custom rules for this property only.</p>
            <textarea
              value={houseRules}
              onChange={(e) => setHouseRules(e.target.value)}
              rows={4}
              placeholder="No smoking, pets welcome, quiet hours after 10pm…"
              className={inputClass}
            />
          </div>
        )}
      </CollapsibleSection>

      <CollapsibleSection title="Cancellation Policy" defaultOpen={!propertyId}>
        <div>
          <p className="text-xs text-on-surface-variant/60 mt-0.5">
            Override the system cancellation policy for all rooms in this property.
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={useGlobalCancellationPolicy}
          onClick={() => setUseGlobalCancellationPolicy((v) => !v)}
          className="flex items-center gap-3 group"
        >
          <span className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${useGlobalCancellationPolicy ? 'bg-secondary' : 'bg-surface-container'}`}>
            <span className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${useGlobalCancellationPolicy ? 'translate-x-6' : 'translate-x-1'}`} />
          </span>
          <span className="text-sm text-on-surface-variant group-hover:text-on-surface transition-colors">
            Use System Cancellation Policy
          </span>
        </button>

        {!useGlobalCancellationPolicy && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
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
      </CollapsibleSection>

      <CollapsibleSection title="Property Images" defaultOpen={!propertyId}>
        <p className="text-xs text-on-surface-variant/60">
          Upload the full image library for this property. Rooms will select from these images.
        </p>
        <ImageUploader
          images={images}
          bucket="property-images"
          uploadFolder={propertyId ?? 'new'}
          onChange={setImages}
        />
      </CollapsibleSection>

      <CollapsibleSection title="Payout Routing" defaultOpen={!propertyId}>
        <p className="text-xs text-on-surface-variant/60">
          Select which Stripe connected account receives payments for this property.
          Manage accounts under{' '}
          <a href="/admin/payout-accounts" className="text-secondary underline">Payout Accounts</a>.
        </p>

        <div>
          <label className={labelClass}>Payout Account</label>
          <select
            value={stripeAccountId}
            onChange={(e) => setStripeAccountId(e.target.value)}
            className={inputClass}
          >
            <option value="">None — funds stay in main Stripe account</option>
            {stripeAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.label} ({account.stripe_account_id})
              </option>
            ))}
          </select>
        </div>

        {stripeAccountId && (
          <div>
            <label className={labelClass}>Platform Fee %</label>
            <input
              type="number"
              value={platformFeePercent}
              onChange={(e) => setPlatformFeePercent(Number(e.target.value))}
              min={0}
              max={100}
              step={0.1}
              placeholder="0"
              className={inputClass}
            />
            <p className="text-xs text-on-surface-variant/60 mt-1.5">
              Your cut before the remainder transfers to the selected account. Set to 0 for your own properties.
            </p>
          </div>
        )}
      </CollapsibleSection>

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
