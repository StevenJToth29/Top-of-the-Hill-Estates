export const revalidate = 60

import { cache } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { format, addMonths } from 'date-fns'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase'
import { getBlockedDatesForRoom } from '@/lib/availability'
import { resolvePolicy } from '@/lib/cancellation'
import type { Room, PropertyImage } from '@/types'
import dynamicImport from 'next/dynamic'
import { hospitableBookingFlag } from '@/flags'

const getRoomBySlug = cache(async (slug: string) => {
  const supabase = await createServerSupabaseClient()
  return supabase
    .from('rooms')
    .select('*, property:properties(*)')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()
})

const geocodeAddress = cache(async (address: string): Promise<{ lat: number; lng: number } | null> => {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (!apiKey) return null
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`,
      { next: { revalidate: 86400 } },
    )
    const data = await res.json()
    const loc = data?.results?.[0]?.geometry?.location
    return loc ? { lat: loc.lat, lng: loc.lng } : null
  } catch {
    return null
  }
})

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { data: room } = await getRoomBySlug(params.slug)

  if (!room) return {}

  const property = room.property as unknown as { name: string; city: string; state: string } | null
  const location = property ? `${property.city}, ${property.state}` : 'Mesa/Tempe, AZ'
  const title = `${room.name} in ${location}`
  const bedroomStr = room.bedrooms > 0 ? `${room.bedrooms}BR` : 'Studio'
  const description =
    room.description
      ? `${room.description.slice(0, 140).trimEnd()}… Book directly from $${room.nightly_rate}/night.`
      : `${bedroomStr} room for up to ${room.guest_capacity} guests in ${location}. Short & long-term stays from $${room.nightly_rate}/night. No platform fees.`

  const ogImage = Array.isArray(room.images) && room.images.length > 0
    ? [{ url: room.images[0] as string, alt: room.name }]
    : undefined

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `/rooms/${params.slug}`,
      type: 'website',
      ...(ogImage ? { images: ogImage } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...(ogImage ? { images: [ogImage[0].url] } : {}),
    },
  }
}

import ImageGallery from '@/components/public/ImageGallery'
import BookingWidget from '@/components/public/BookingWidget'
import RoomBackButton from '@/components/public/RoomBackButton'
import AvailabilityCalendar from '@/components/public/AvailabilityCalendar'
import AmenitiesGrid from '@/components/public/AmenitiesGrid'
import PricingSection from '@/components/public/PricingSection'
import CancellationPolicyDisplay from '@/components/public/CancellationPolicyDisplay'
import RoomDescription from '@/components/public/RoomDescription'
import QuickInfoCard from '@/components/public/QuickInfoCard'
import MobileBookingBar from '@/components/public/MobileBookingBar'

const LocationMap = dynamicImport(() => import('@/components/public/LocationMap'), { ssr: false })

interface Props {
  params: { slug: string }
  searchParams: { checkin?: string; checkout?: string; guests?: string; source?: string }
}

export default async function RoomDetailPage({ params, searchParams }: Props) {
  const supabase = await createServerSupabaseClient()
  const [showHospitableWidget, { data: rawRoom }, { data: siteSettings }] = await Promise.all([
    hospitableBookingFlag(),
    getRoomBySlug(params.slug),
    supabase.from('site_settings').select('global_house_rules, stripe_fee_percent, stripe_fee_flat, cancellation_policy').maybeSingle(),
  ])

  if (!rawRoom) notFound()

  // Build URL → description lookup from property image library
  const propertyImages = (rawRoom.property?.images ?? []) as PropertyImage[]
  const imageDescriptions: Record<string, string> = {}
  for (const img of propertyImages) {
    if (img.description) imageDescriptions[img.url] = img.description
  }

  const settings = siteSettings ?? null
  const resolvedPolicy = resolvePolicy(rawRoom, rawRoom.property ?? {}, settings)

  const today = new Date()
  const sixMonthsOut = addMonths(today, 6)

  const serviceSupabase = createServiceRoleClient()

  const mapAddress = rawRoom.property
    ? [rawRoom.property.address, rawRoom.property.city, rawRoom.property.state, rawRoom.property.zip]
        .filter(Boolean)
        .join(', ')
    : null

  const [{ data: roomFees, error: feesError }, blockedDates, { data: rawOverrides }, mapCoords] = await Promise.all([
    supabase
      .from('room_fees')
      .select('*')
      .eq('room_id', rawRoom.id)
      .order('created_at'),
    getBlockedDatesForRoom(
      rawRoom.id,
      format(today, 'yyyy-MM-dd'),
      format(sixMonthsOut, 'yyyy-MM-dd'),
    ),
    serviceSupabase
      .from('date_overrides')
      .select('date, price_override')
      .eq('room_id', rawRoom.id)
      .gte('date', format(today, 'yyyy-MM-dd'))
      .lt('date', format(sixMonthsOut, 'yyyy-MM-dd'))
      .not('price_override', 'is', null),
    mapAddress && process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
      ? geocodeAddress(mapAddress)
      : Promise.resolve(null),
  ])

  const dateOverrides: Record<string, number> = {}
  for (const o of rawOverrides ?? []) {
    if (o.price_override != null) dateOverrides[o.date] = Number(o.price_override)
  }

  if (feesError) {
    console.error('[room-detail] Failed to fetch room_fees:', feesError)
  }

  const room = { ...rawRoom, fees: roomFees ?? [] } as unknown as Room

  const allAmenities = Array.from(
    new Set([...(room.property?.amenities ?? []), ...(room.amenities ?? [])]),
  )

  const useGlobal = room.property?.use_global_house_rules ?? true
  const houseRules = useGlobal
    ? (siteSettings?.global_house_rules ?? null)
    : (room.property?.house_rules ?? null)

  const stripeFeePercent = siteSettings?.stripe_fee_percent != null ? Number(siteSettings.stripe_fee_percent) : 2.9
  const stripeFeeFlat = siteSettings?.stripe_fee_flat != null ? Number(siteSettings.stripe_fee_flat) : 0.30

  const divider = <div className="h-px bg-outline-variant/15 my-7" />

  return (
    <main className="min-h-screen bg-background pb-20 lg:pb-10">
      {/* ── Gallery (full-width within max container) ── */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <RoomBackButton />
        <div className="mt-4">
          <ImageGallery images={room.images ?? []} roomName={room.name} descriptions={imageDescriptions} />
        </div>
      </div>

      {/* ── Main 2-column grid ── */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-4">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8 lg:gap-12 items-start">

          {/* ── RIGHT COLUMN (first in DOM → shows above content on mobile) ── */}
          <div
            id="booking-widget-anchor"
            className="order-first lg:order-last lg:sticky lg:top-24 space-y-3"
          >
            {showHospitableWidget && room.iframe_booking_url ? (
              /* Iframe widget — no card wrapper, full natural height */
              <iframe
                id="booking-iframe"
                sandbox="allow-top-navigation allow-scripts allow-same-origin"
                style={{ width: '100%', height: '900px', display: 'block' }}
                frameBorder={0}
                src={room.iframe_booking_url}
              />
            ) : (
              /* Native booking widget — card wrapper, auto-expands with content */
              <div className="rounded-2xl border border-outline-variant/20 bg-surface-highest/40 backdrop-blur-sm shadow-xl">
                <div className="p-4">
                  <BookingWidget
                    room={room}
                    blockedDates={blockedDates}
                    dateOverrides={dateOverrides}
                    initialCheckin={searchParams.checkin}
                    initialCheckout={searchParams.checkout}
                    initialGuests={searchParams.guests ? parseInt(searchParams.guests, 10) : undefined}
                    stripeFeePercent={stripeFeePercent}
                    stripeFeeFlat={stripeFeeFlat}
                    cancellationPolicy={resolvedPolicy}
                  />
                </div>
              </div>
            )}

            {/* Quick info — hidden when iframe (widget already shows this detail) */}
            {!showHospitableWidget && (
              <QuickInfoCard
                guestCapacity={room.guest_capacity}
                minNights={room.minimum_nights_short_term}
                cleaningFee={room.cleaning_fee ?? undefined}
                securityDeposit={room.security_deposit ?? undefined}
              />
            )}
          </div>

          {/* ── LEFT COLUMN ── */}
          <div className="order-last lg:order-first min-w-0">

            {/* Room header */}
            <div className="space-y-2 mb-7">
              {room.property && (
                <p className="text-xs uppercase tracking-widest text-secondary font-body">
                  {room.property.name}
                  {room.property.city ? ` · ${room.property.city}, ${room.property.state}` : ''}
                </p>
              )}
              <h1 className="font-display text-3xl sm:text-4xl font-bold text-on-surface">
                {room.name}
              </h1>
              <div className="flex flex-wrap gap-4 text-sm text-on-surface-variant">
                {room.bedrooms > 0 && (
                  <span>{room.bedrooms} bedroom{room.bedrooms !== 1 ? 's' : ''}</span>
                )}
                {room.bathrooms > 0 && (
                  <span>{room.bathrooms} bathroom{room.bathrooms !== 1 ? 's' : ''}</span>
                )}
                <span>Up to {room.guest_capacity} guest{room.guest_capacity !== 1 ? 's' : ''}</span>
              </div>
            </div>

            {/* Map — elevated near top */}
            {mapCoords && (
              <>
                <div className="space-y-3">
                  <p className="text-xs uppercase tracking-widest text-on-surface-variant font-body">
                    Location
                  </p>
                  <LocationMap lat={mapCoords.lat} lng={mapCoords.lng} />
                </div>
                {divider}
              </>
            )}

            {/* Description + house rules read-more */}
            {(room.description || room.property?.description || houseRules) && (
              <>
                <RoomDescription
                  description={room.description ?? null}
                  propertyDescription={room.property?.description ?? null}
                  houseRules={houseRules}
                />
                {divider}
              </>
            )}

            {/* Pricing */}
            {(room.show_nightly_rate !== false || room.show_monthly_rate !== false) && (
              <>
                <PricingSection
                  nightlyRate={room.nightly_rate}
                  monthlyRate={room.monthly_rate}
                  minNightsShortTerm={room.minimum_nights_short_term}
                  minNightsLongTerm={room.minimum_nights_long_term}
                  cleaningFee={room.cleaning_fee ?? undefined}
                  showNightlyRate={room.show_nightly_rate ?? true}
                  showMonthlyRate={room.show_monthly_rate ?? true}
                />
                {divider}
              </>
            )}

            {/* Amenities */}
            {allAmenities.length > 0 && (
              <>
                <AmenitiesGrid amenities={allAmenities} />
                {divider}
              </>
            )}

            {/* Availability calendar */}
            <>
              <AvailabilityCalendar blockedDates={blockedDates} roomName={room.name} />
              {divider}
            </>

            {/* Cancellation policy */}
            <CancellationPolicyDisplay variant="short_term" policy={resolvedPolicy} />
          </div>

        </div>
      </div>

      {/* ── Mobile sticky bottom bar ── */}
      <MobileBookingBar
        nightlyRate={room.nightly_rate}
        monthlyRate={room.monthly_rate}
        showNightly={room.show_nightly_rate ?? true}
      />
    </main>
  )
}
