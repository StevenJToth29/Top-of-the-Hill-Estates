import type { Metadata } from 'next'
import { createServerSupabaseClient } from '@/lib/supabase'
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

    const [roomsResult, settings, reviewsResult] = await Promise.all([
      supabase.from('rooms').select('*, property:properties(*)').eq('is_active', true).order('name'),
      getSiteSettings(),
      supabase
        .from('reviews')
        .select('id, rating, comment, booking:bookings(guest_first_name, guest_last_name)')
        .eq('approved', true)
        .order('created_at', { ascending: false })
        .limit(6),
    ])

    const rooms: Array<Room & { property: Property }> = roomsResult.data ?? []

    const propertyMap = new Map<string, Property & { rooms: Room[] }>()
    for (const room of rooms) {
      if (!room.property) continue
      const existing = propertyMap.get(room.property_id)
      if (existing) {
        existing.rooms.push(room)
      } else {
        propertyMap.set(room.property_id, { ...room.property, rooms: [room] })
      }
    }

    const reviews: Review[] = (reviewsResult.data ?? []).map((r) => ({
      ...r,
      booking: Array.isArray(r.booking) ? (r.booking[0] ?? null) : r.booking,
    })) as Review[]

    return {
      properties: Array.from(propertyMap.values()),
      aboutText: settings?.about_text ?? DEFAULT_ABOUT,
      reviews,
    }
  } catch {
    return { properties: [], aboutText: DEFAULT_ABOUT, reviews: [] }
  }
}

export default async function HomePage() {
  const { properties, aboutText, reviews } = await getData()

  return (
    <>
      <Hero />
      <AboutSection aboutText={aboutText} />
      <PropertiesSection properties={properties} />
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
