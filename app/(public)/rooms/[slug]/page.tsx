export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { format, addMonths } from 'date-fns'
import { createServerSupabaseClient } from '@/lib/supabase'
import { getBlockedDatesForRoom } from '@/lib/availability'
import { resolvePolicy } from '@/lib/cancellation'
import type { Room } from '@/types'
import dynamicImport from 'next/dynamic'
import ImageGallery from '@/components/public/ImageGallery'
import BookingWidget from '@/components/public/BookingWidget'
import AvailabilityCalendar from '@/components/public/AvailabilityCalendar'
import AmenitiesGrid from '@/components/public/AmenitiesGrid'
import PricingSection from '@/components/public/PricingSection'
import CancellationPolicyDisplay from '@/components/public/CancellationPolicyDisplay'

const LocationMap = dynamicImport(() => import('@/components/public/LocationMap'), { ssr: false })

interface Props {
  params: { slug: string }
  searchParams: { checkin?: string; checkout?: string; guests?: string }
}

export default async function RoomDetailPage({ params, searchParams }: Props) {
  const supabase = await createServerSupabaseClient()
  const [{ data: rawRoom }, { data: siteSettings }] = await Promise.all([
    supabase
      .from('rooms')
      .select('*, property:properties(*)')
      .eq('slug', params.slug)
      .eq('is_active', true)
      .single(),
    supabase.from('site_settings').select('global_house_rules, stripe_fee_percent, stripe_fee_flat, cancellation_policy').maybeSingle(),
  ])

  if (!rawRoom) notFound()

  const settings = siteSettings ?? null
  const resolvedPolicy = resolvePolicy(rawRoom, rawRoom.property ?? {}, settings)

  const today = new Date()
  const sixMonthsOut = addMonths(today, 6)

  const [{ data: roomFees, error: feesError }, blockedDates] = await Promise.all([
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
  ])

  if (feesError) {
    console.error('[room-detail] Failed to fetch room_fees:', feesError)
  }

  const room = { ...rawRoom, fees: roomFees ?? [] } as unknown as Room

  const mapAddress = room.property
    ? [room.property.address, room.property.city, room.property.state, room.property.zip]
        .filter(Boolean)
        .join(', ')
    : null

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
        <ImageGallery images={room.images ?? []} roomName={room.name} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          <div className="lg:col-span-2 space-y-8">
            <div className="space-y-2">
              {room.property && (
                <p className="text-xs uppercase tracking-widest text-secondary font-body">
                  {room.property.name}
                </p>
              )}
              <h1 className="font-display text-3xl sm:text-4xl font-bold text-primary">
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

            {room.description && (
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-widest text-on-surface-variant font-body">
                  About this room
                </p>
                <p className="text-on-surface-variant leading-relaxed">{room.description}</p>
              </div>
            )}

            <PricingSection
              nightlyRate={room.nightly_rate}
              monthlyRate={room.monthly_rate}
              minNightsShortTerm={room.minimum_nights_short_term}
              minNightsLongTerm={room.minimum_nights_long_term}
              showNightlyRate={room.show_nightly_rate ?? true}
              showMonthlyRate={room.show_monthly_rate ?? true}
            />

            {(() => {
              const allAmenities = Array.from(
                new Set([
                  ...(room.property?.amenities ?? []),
                  ...(room.amenities ?? []),
                ]),
              )
              return allAmenities.length > 0 ? (
                <AmenitiesGrid amenities={allAmenities} />
              ) : null
            })()}

            <AvailabilityCalendar blockedDates={blockedDates} roomName={room.name} />

            {(() => {
              const useGlobal = room.property?.use_global_house_rules ?? true
              const rules = useGlobal
                ? (siteSettings?.global_house_rules ?? '')
                : (room.property?.house_rules ?? '')
              return rules ? (
                <div className="bg-surface-highest/40 backdrop-blur-xl shadow-[0_8px_40px_rgba(45,212,191,0.06)] rounded-2xl p-5 space-y-3">
                  <p className="text-xs uppercase tracking-widest text-on-surface-variant font-body">
                    House Rules
                  </p>
                  <p className="text-on-surface-variant text-sm leading-relaxed whitespace-pre-line">
                    {rules}
                  </p>
                </div>
              ) : null
            })()}

            <CancellationPolicyDisplay variant="short_term" policy={resolvedPolicy} />

            {mapAddress && process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY && (
              <div className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <p className="text-xs uppercase tracking-widest text-on-surface-variant font-body">
                    Location
                  </p>
                  <p className="text-xs text-on-surface-variant/50">
                    Exact address provided after booking
                  </p>
                </div>
                <LocationMap address={mapAddress} />
              </div>
            )}
          </div>

          <div className="lg:col-span-1">
            <BookingWidget
              room={room}
              blockedDates={blockedDates}
              initialCheckin={searchParams.checkin}
              initialCheckout={searchParams.checkout}
              initialGuests={searchParams.guests ? parseInt(searchParams.guests, 10) : undefined}
              stripeFeePercent={siteSettings?.stripe_fee_percent != null ? Number(siteSettings.stripe_fee_percent) : 2.9}
              stripeFeeFlat={siteSettings?.stripe_fee_flat != null ? Number(siteSettings.stripe_fee_flat) : 0.30}
              cancellationPolicy={resolvedPolicy}
            />
          </div>
        </div>
      </div>
    </main>
  )
}
