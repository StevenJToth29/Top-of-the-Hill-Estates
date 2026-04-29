import type { Metadata } from 'next'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase'
import type { Property, Room } from '@/types'
import { getSiteSettings } from '@/lib/site-settings'

export const metadata: Metadata = {
  title: 'Room Rentals in Mesa & Tempe, AZ — Book Direct',
  description:
    'Fully furnished short-term and long-term rooms in Mesa and Tempe, Arizona. Flexible stays, no platform fees. Book directly with Top of the Hill Rooms.',
  openGraph: {
    title: 'Top of the Hill Rooms — Mesa & Tempe, AZ',
    description:
      'Fully furnished short-term and long-term rooms in Mesa and Tempe, Arizona. Flexible stays, no platform fees.',
    url: '/',
  },
}
import Hero from '@/components/public/Hero'
import AboutSection from '@/components/public/AboutSection'
import PropertiesSection from '@/components/public/PropertiesSection'
import ReviewsSection from '@/components/public/ReviewsSection'
import ContactForm from '@/components/public/ContactForm'

const DEFAULT_ABOUT =
  'Top of the Hill Estates offers fully furnished rooms in the heart of Mesa and Tempe, Arizona. Whether you need a short-term stay or a long-term home, we have flexible options to fit your lifestyle — with no platform fees when you book directly.'

type Review = {
  id: string
  rating: number
  comment: string | null
  booking: { guest_first_name: string; guest_last_name: string } | null
}

async function getData() {
  try {
    const supabase = await createServerSupabaseClient()
    const serviceSupabase = createServiceRoleClient()

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = today.toISOString().split('T')[0]

    const [roomsResult, settings, reviewsResult, bookingsResult, overridesResult, icalResult] = await Promise.all([
      supabase.from('rooms').select('*, property:properties(*)').eq('is_active', true).order('name'),
      getSiteSettings(),
      supabase
        .from('reviews')
        .select('id, rating, comment, booking:bookings(guest_first_name, guest_last_name)')
        .eq('approved', true)
        .order('created_at', { ascending: false })
        .limit(6),
      // Use service role for occupancy data — bookings table is RLS-protected
      serviceSupabase
        .from('bookings')
        .select('room_id, check_in, check_out')
        .in('status', ['confirmed', 'pending'])
        .gte('check_out', todayStr),
      serviceSupabase
        .from('date_overrides')
        .select('room_id, date')
        .eq('is_blocked', true)
        .gte('date', todayStr),
      serviceSupabase
        .from('ical_blocks')
        .select('room_id, start_date, end_date')
        .gte('end_date', todayStr),
    ])

    const rooms: Array<Room & { property: Property }> = roomsResult.data ?? []
    const bookings = (bookingsResult.data ?? []) as Array<{ room_id: string; check_in: string; check_out: string }>
    const icalBlocks = (icalResult.data ?? []) as Array<{ room_id: string; start_date: string; end_date: string }>

    // Compute next available date using a sweep-line over merged intervals.
    // Returns the earliest date string >= today that is not covered by any
    // booking or iCal block, or null if blocked for 365+ days.
    const nextAvailableDate = (roomId: string): string | null => {
      const intervals = [
        ...bookings
          .filter((b) => b.room_id === roomId)
          .map((b) => ({ start: b.check_in, end: b.check_out })),
        ...icalBlocks
          .filter((ib) => ib.room_id === roomId)
          .map((ib) => ({ start: ib.start_date, end: ib.end_date })),
      ].sort((a, b) => a.start.localeCompare(b.start))

      let cursor = todayStr
      for (const interval of intervals) {
        if (interval.start > cursor) break   // gap found — cursor is free
        if (interval.end > cursor) cursor = interval.end
      }

      // Treat anything 365+ days out as "no availability"
      const limitDate = new Date(today)
      limitDate.setFullYear(limitDate.getFullYear() + 1)
      const limitStr = limitDate.toISOString().split('T')[0]
      return cursor < limitStr ? cursor : null
    }

    // Sort rooms by next available date string ascending; null (fully blocked) goes last
    const sorted = rooms
      .map((room) => ({ room, nextAvailable: nextAvailableDate(room.id) }))
      .sort((a, b) => {
        if (!a.nextAvailable && !b.nextAvailable) return 0
        if (!a.nextAvailable) return 1
        if (!b.nextAvailable) return -1
        return a.nextAvailable.localeCompare(b.nextAvailable)
      })

    const featuredRooms = sorted.slice(0, 6).map((r) => r.room)

    const reviews: Review[] = (reviewsResult.data ?? []).map((r) => ({
      ...r,
      booking: Array.isArray(r.booking) ? (r.booking[0] ?? null) : r.booking,
    })) as Review[]

    return {
      featuredRooms,
      aboutText: settings?.about_text ?? DEFAULT_ABOUT,
      reviews,
    }
  } catch {
    return { featuredRooms: [], aboutText: DEFAULT_ABOUT, reviews: [] }
  }
}

export default async function HomePage() {
  const { featuredRooms, aboutText, reviews } = await getData()

  return (
    <>
      <Hero />
      <AboutSection aboutText={aboutText} />
      <PropertiesSection rooms={featuredRooms} />
      <ReviewsSection reviews={reviews} />
      <section id="contact" className="bg-background py-16 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <h2 className="font-display text-3xl font-bold text-primary mb-2">Get in Touch</h2>
          <p className="text-on-surface-variant font-body mb-8">
            Questions about availability or pricing? We&apos;d love to hear from you.
          </p>
          <ContactForm />
        </div>
      </section>
    </>
  )
}
