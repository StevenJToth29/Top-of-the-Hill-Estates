import { notFound } from 'next/navigation'
import { format, addMonths } from 'date-fns'
import { createServerSupabaseClient } from '@/lib/supabase'
import { getBlockedDatesForRoom } from '@/lib/availability'
import type { Room } from '@/types'
import ImageGallery from '@/components/public/ImageGallery'
import BookingWidget from '@/components/public/BookingWidget'
import AvailabilityCalendar from '@/components/public/AvailabilityCalendar'
import AmenitiesGrid from '@/components/public/AmenitiesGrid'
import PricingSection from '@/components/public/PricingSection'
import CancellationPolicyDisplay from '@/components/public/CancellationPolicyDisplay'

interface Props {
  params: { slug: string }
}

export default async function RoomDetailPage({ params }: Props) {
  const supabase = await createServerSupabaseClient()
  const { data: rawRoom } = await supabase
    .from('rooms')
    .select('*, property:properties(*)')
    .eq('slug', params.slug)
    .eq('is_active', true)
    .single()

  if (!rawRoom) notFound()

  const room = rawRoom as unknown as Room

  const today = new Date()
  const sixMonthsOut = addMonths(today, 6)
  const blockedDates = await getBlockedDatesForRoom(
    room.id,
    format(today, 'yyyy-MM-dd'),
    format(sixMonthsOut, 'yyyy-MM-dd'),
  )

  const address = room.property
    ? `${room.property.address}, ${room.property.city}, ${room.property.state}`
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

            <AvailabilityCalendar blockedDates={blockedDates} />

            {room.property?.house_rules && (
              <div className="bg-surface-highest/40 backdrop-blur-xl shadow-[0_8px_40px_rgba(45,212,191,0.06)] rounded-2xl p-5 space-y-3">
                <p className="text-xs uppercase tracking-widest text-on-surface-variant font-body">
                  House Rules
                </p>
                <p className="text-on-surface-variant text-sm leading-relaxed whitespace-pre-line">
                  {room.property.house_rules}
                </p>
              </div>
            )}

            <CancellationPolicyDisplay variant="short_term" />

            {address && (
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-widest text-on-surface-variant font-body">
                  Location
                </p>
                <iframe
                  src={`https://maps.google.com/maps?q=${encodeURIComponent(address)}&output=embed`}
                  className="w-full h-64 rounded-xl ring-1 ring-white/10"
                  loading="lazy"
                  title="Property location map"
                />
              </div>
            )}
          </div>

          <div className="lg:col-span-1">
            <BookingWidget room={room} blockedDates={blockedDates} />
          </div>
        </div>
      </div>
    </main>
  )
}
