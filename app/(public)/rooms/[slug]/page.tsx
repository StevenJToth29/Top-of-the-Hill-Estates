import { notFound } from 'next/navigation'
import { format, addMonths } from 'date-fns'
import { createServerSupabaseClient } from '@/lib/supabase'
import { getBlockedDatesForRoom } from '@/lib/availability'
import type { Room } from '@/types'
import dynamic from 'next/dynamic'
import ImageGallery from '@/components/public/ImageGallery'
import BookingWidget from '@/components/public/BookingWidget'
import AvailabilityCalendar from '@/components/public/AvailabilityCalendar'
import AmenitiesGrid from '@/components/public/AmenitiesGrid'
import PricingSection from '@/components/public/PricingSection'
import CancellationPolicyDisplay from '@/components/public/CancellationPolicyDisplay'

const LocationMap = dynamic(() => import('@/components/public/LocationMap'), { ssr: false })

interface Props {
  params: { slug: string }
}

export default async function RoomDetailPage({ params }: Props) {
  const supabase = await createServerSupabaseClient()
  const [{ data: rawRoom }, { data: siteSettings }] = await Promise.all([
    supabase
      .from('rooms')
      .select('*, property:properties(*)')
      .eq('slug', params.slug)
      .eq('is_active', true)
      .single(),
    supabase.from('site_settings').select('global_house_rules').maybeSingle(),
  ])

  if (!rawRoom) notFound()

  const room = rawRoom as unknown as Room

  const today = new Date()
  const sixMonthsOut = addMonths(today, 6)
  const blockedDates = await getBlockedDatesForRoom(
    room.id,
    format(today, 'yyyy-MM-dd'),
    format(sixMonthsOut, 'yyyy-MM-dd'),
  )

  // Geocode to city+state level for a general area (no street address exposed)
  let mapCoords: { lat: number; lng: number } | null = null
  if (room.property) {
    try {
      const query = encodeURIComponent(`${room.property.city}, ${room.property.state}`)
      const geoRes = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`,
        { headers: { 'User-Agent': 'tothrooms.com' }, next: { revalidate: 86400 } },
      )
      const geoData = await geoRes.json()
      if (geoData?.[0]) {
        mapCoords = { lat: parseFloat(geoData[0].lat), lng: parseFloat(geoData[0].lon) }
      }
    } catch {
      // silently skip map if geocoding fails
    }
  }

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

            <CancellationPolicyDisplay variant="short_term" />

            {mapCoords && (
              <div className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <p className="text-xs uppercase tracking-widest text-on-surface-variant font-body">
                    Location
                  </p>
                  <p className="text-xs text-on-surface-variant/50">
                    Exact address provided after booking
                  </p>
                </div>
                <LocationMap lat={mapCoords.lat} lng={mapCoords.lng} />
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
