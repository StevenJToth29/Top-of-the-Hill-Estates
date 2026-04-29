'use client'

import { useState, useTransition } from 'react'
import type { Property, PropertyImage, StripeAccount, CancellationPolicy } from '@/types'
import { DEFAULT_POLICY } from '@/lib/cancellation'
import AmenitiesTagInput from './AmenitiesTagInput'
import ImageUploader from './ImageUploader'
import AIWriteButton from './AIWriteButton'
import PlacesAddressInput from './PlacesAddressInput'
import FormTabBar from './FormTabBar'
import { slugify } from '@/lib/slugify'

interface PropertyFormProps {
  property?: Property
  propertyId?: string
  globalHouseRules?: string
  stripeAccounts?: StripeAccount[]
  taskAutomationsTab?: React.ReactNode
}

type PropertyTab = 'info' | 'amenities' | 'policy' | 'images' | 'payout' | 'automations'

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

export default function PropertyForm({
  property,
  propertyId,
  globalHouseRules = '',
  stripeAccounts = [],
  taskAutomationsTab,
}: PropertyFormProps) {
  const [isPending, startTransition] = useTransition()
  const [tab, setTab] = useState<PropertyTab>('info')
  const [name, setName] = useState(property?.name ?? '')
  const [address, setAddress] = useState(property?.address ?? '')
  const [city, setCity] = useState(property?.city ?? '')
  const [state, setState] = useState(property?.state ?? '')
  const [zip, setZip] = useState(property?.zip ?? '')
  const [description, setDescription] = useState(property?.description ?? '')
  const [bedrooms, setBedrooms] = useState(String(property?.bedrooms ?? 0))
  const [bathrooms, setBathrooms] = useState(String(property?.bathrooms ?? 0))
  const [amenities, setAmenities] = useState<string[]>(property?.amenities ?? [])
  const [useGlobalRules, setUseGlobalRules] = useState(property?.use_global_house_rules ?? true)
  const [houseRules, setHouseRules] = useState(property?.house_rules ?? '')
  const [useGlobalCancellationPolicy, setUseGlobalCancellationPolicy] = useState(
    property?.use_global_cancellation_policy ?? true,
  )
  const [cancellationPolicy, setCancellationPolicy] = useState<CancellationPolicy>(() => {
    if (!property?.cancellation_policy) return DEFAULT_POLICY
    try {
      return { ...DEFAULT_POLICY, ...JSON.parse(property.cancellation_policy) }
    } catch {
      return DEFAULT_POLICY
    }
  })
  const [images, setImages] = useState<PropertyImage[]>(property?.images ?? [])
  const [stripeAccountId, setStripeAccountId] = useState<string>(property?.stripe_account_id ?? '')
  const [platformFeePercent, setPlatformFeePercent] = useState<number>(property?.platform_fee_percent ?? 0)
  const [trendsKeyword, setTrendsKeyword] = useState(property?.trends_keyword ?? '')
  const [trendsGeo, setTrendsGeo] = useState(property?.trends_geo ?? '')
  const [error, setError] = useState<string | null>(null)

  const isNew = !property

  const checks: [string, boolean][] = [
    ['Name', !!name],
    ['Address', !!address && !!city],
    ['Description', !!description && description.length > 20],
    ['Amenities', amenities.length > 0],
    ['3+ Images', images.length >= 3],
  ]

  const tabs = [
    { id: 'info', label: 'Info & Details', icon: 'ℹ' },
    { id: 'amenities', label: 'Amenities & Rules', icon: '✨', badge: amenities.length || null },
    { id: 'policy', label: 'Policy', icon: '🛡' },
    { id: 'images', label: 'Images', icon: '🖼', badge: images.length || null, warn: images.length === 0 },
    {
      id: 'payout',
      label: 'Payout',
      icon: '💳',
      warn: stripeAccounts.length > 0 && !stripeAccountId,
    },
    { id: 'automations', label: 'Automations' },
  ]

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
      bedrooms: parseFloat(bedrooms) || 0,
      bathrooms: parseFloat(bathrooms) || 0,
      amenities,
      house_rules: houseRules,
      use_global_house_rules: useGlobalRules,
      cancellation_policy: useGlobalCancellationPolicy ? null : JSON.stringify(cancellationPolicy),
      use_global_cancellation_policy: useGlobalCancellationPolicy,
      images,
      stripe_account_id: stripeAccountId || null,
      platform_fee_percent: stripeAccountId ? platformFeePercent : 0,
      trends_keyword: trendsKeyword.trim() || null,
      trends_geo: trendsGeo.trim() || null,
    }

    startTransition(async () => {
      try {
        const res = await fetch('/api/admin/properties', {
          method: propertyId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Save failed')
        window.location.href = '/admin/properties'
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Save failed')
      }
    })
  }

  const SaveButtons = (
    <div className="flex items-center gap-3">
      <a
        href="/admin/properties"
        className="text-sm text-on-surface-variant hover:text-on-surface transition-colors px-4 py-2.5 rounded-xl hover:bg-surface-container"
      >
        Cancel
      </a>
      <button
        type="submit"
        disabled={isPending}
        className="bg-gradient-to-r from-primary to-secondary text-background font-semibold rounded-xl px-6 py-2.5 hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed text-sm"
      >
        {isPending ? 'Saving…' : isNew ? 'Create Property' : 'Save Changes'}
      </button>
    </div>
  )

  return (
    <form onSubmit={handleSubmit} className="flex flex-col min-h-screen">
      {/* ── Sticky header ── */}
      <div className="bg-background border-b border-outline-variant/30 px-6 sm:px-10 py-4 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-4 min-w-0">
          <a
            href="/admin/properties"
            className="flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-on-surface transition-colors shrink-0"
          >
            ← Properties
          </a>
          <h1 className="font-display text-xl font-bold text-on-surface truncate">
            {isNew ? 'Add New Property' : name || 'Edit Property'}
          </h1>
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
          <FormTabBar tabs={tabs} active={tab} onChange={(id) => setTab(id as PropertyTab)} />
        </div>

        {/* ── Tab: Info & Details ── */}
        {tab === 'info' && (
          <div className="space-y-5">
            <SCard title="Basic Information" subtitle="The property's public name, address, and listing description">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className={labelClass}>
                    Property Name <span className="text-error">*</span>
                  </label>
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
                    onZipChange={setZip}
                    required
                    placeholder="123 Main St"
                    className={inputClass}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-5">
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
                <label className={labelClass}>Property Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                  placeholder="Describe the property — location highlights, vibe, shared spaces, nearby attractions…"
                  className={inputClass}
                />
                <div className="mt-2">
                  <AIWriteButton fieldType="property_description" context={buildAIContext()} onAccept={setDescription} />
                </div>
              </div>
            </SCard>

            <SCard title="Property Details" subtitle="Physical specifications shared with guests">
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className={labelClass}>Total Bedrooms</label>
                  <input
                    type="number"
                    value={bedrooms}
                    onChange={(e) => setBedrooms(e.target.value)}
                    min={0}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Total Bathrooms</label>
                  <input
                    type="number"
                    value={bathrooms}
                    onChange={(e) => setBathrooms(e.target.value)}
                    min={0}
                    step={0.5}
                    className={inputClass}
                  />
                </div>
              </div>
            </SCard>

            <SCard title="Demand Signals" subtitle="Google Trends configuration for Smart Pricing — leave blank to auto-derive from city and state">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className={labelClass}>Google Trends Keyword</label>
                  <input
                    type="text"
                    value={trendsKeyword}
                    onChange={(e) => setTrendsKeyword(e.target.value)}
                    placeholder="Nashville vacation rental"
                    className={inputClass}
                  />
                  <p className="text-xs text-on-surface-variant/50 mt-1">Auto: &quot;[city] vacation rental&quot; if blank</p>
                </div>
                <div>
                  <label className={labelClass}>Google Trends Geo</label>
                  <input
                    type="text"
                    value={trendsGeo}
                    onChange={(e) => setTrendsGeo(e.target.value)}
                    placeholder="US-TN or US-TN-659"
                    className={inputClass}
                  />
                  <p className="text-xs text-on-surface-variant/50 mt-1">Country (US), state (US-TN), or metro DMA (US-TN-659). Auto: US-[STATE] if blank</p>
                </div>
              </div>
            </SCard>
          </div>
        )}

        {/* ── Tab: Amenities & Rules ── */}
        {tab === 'amenities' && (
          <div className="space-y-5">
            <SCard
              title="Property Amenities"
              subtitle="These appear on every unit listing at this property. Add shared spaces, outdoor features, parking, etc."
            >
              <p className="text-xs text-on-surface-variant/60">
                Type an amenity and press Enter, or click a suggestion below.
              </p>
              <AmenitiesTagInput value={amenities} onChange={setAmenities} />
            </SCard>

            <SCard title="House Rules" subtitle="Rules that apply to all guests at this property">
              <button
                type="button"
                role="switch"
                aria-checked={useGlobalRules}
                onClick={() => setUseGlobalRules((v) => !v)}
                className="flex items-center gap-3 group"
              >
                <span
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                    useGlobalRules ? 'bg-secondary' : 'bg-surface-container'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
                      useGlobalRules ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
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
                      <a href="/admin/settings" className="text-secondary underline">
                        Site Settings
                      </a>
                      .
                    </p>
                    <div className="bg-surface-container rounded-xl px-4 py-3 text-sm text-on-surface-variant whitespace-pre-line leading-relaxed">
                      {globalHouseRules}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-on-surface-variant/60">
                    No global rules set yet — add them in{' '}
                    <a href="/admin/settings" className="text-secondary underline">
                      Site Settings
                    </a>
                    .
                  </p>
                )
              ) : (
                <div className="space-y-1.5">
                  <p className="text-xs text-on-surface-variant/60">Custom rules for this property only.</p>
                  <textarea
                    value={houseRules}
                    onChange={(e) => setHouseRules(e.target.value)}
                    rows={5}
                    placeholder="No smoking anywhere on the property. Pets welcome with prior approval. Quiet hours after 10pm…"
                    className={inputClass}
                  />
                </div>
              )}
            </SCard>
          </div>
        )}

        {/* ── Tab: Policy ── */}
        {tab === 'policy' && (
          <div className="space-y-5">
            <SCard
              title="Cancellation Policy"
              subtitle="Override the system cancellation policy for all units at this property"
            >
              <p className="text-xs text-on-surface-variant/60">
                Override the system cancellation policy for all units in this property.
              </p>
              <button
                type="button"
                role="switch"
                aria-checked={useGlobalCancellationPolicy}
                onClick={() => setUseGlobalCancellationPolicy((v) => !v)}
                className="flex items-center gap-3 group"
              >
                <span
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                    useGlobalCancellationPolicy ? 'bg-secondary' : 'bg-surface-container'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
                      useGlobalCancellationPolicy ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
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
                      type="number"
                      min="0"
                      step="1"
                      value={cancellationPolicy.full_refund_days}
                      onChange={(e) =>
                        setCancellationPolicy((p) => ({ ...p, full_refund_days: Number(e.target.value) }))
                      }
                      className={inputClass}
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
                      className={inputClass}
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
                      className={inputClass}
                    />
                  </div>
                </div>
              )}
            </SCard>
          </div>
        )}

        {/* ── Tab: Images ── */}
        {tab === 'images' && (
          <div className="space-y-5">
            <SCard
              title="Property Image Library"
              subtitle="Upload and manage all photos for this property. Units will select their images from this library."
            >
              <p className="text-xs text-on-surface-variant/60">
                Upload the full image library for this property. Units will select from these images.
              </p>
              <ImageUploader
                images={images}
                bucket="property-images"
                uploadFolder={(propertyId ?? slugify(name)) || 'new'}
                onChange={setImages}
              />
            </SCard>
          </div>
        )}

        {/* ── Tab: Payout ── */}
        {tab === 'payout' && (
          <div className="space-y-5">
            <SCard
              title="Payout Routing"
              subtitle="Select which Stripe connected account receives payments for this property"
            >
              <p className="text-xs text-on-surface-variant/60">
                Manage accounts under{' '}
                <a href="/admin/payout-accounts" className="text-secondary underline">
                  Payout Accounts
                </a>
                .
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
            </SCard>
          </div>
        )}

        {/* ── Tab: Automations ── */}
        {tab === 'automations' && (
          <div className="px-6 pb-8">
            {taskAutomationsTab}
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
          <div className="flex justify-end gap-3 pt-4 border-t border-outline-variant/20">
            {SaveButtons}
          </div>
        </div>
      </div>
    </form>
  )
}
