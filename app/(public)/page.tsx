import { createServerSupabaseClient } from '@/lib/supabase'
import type { Property, Room, SiteSettings } from '@/types'
import Hero from '@/components/public/Hero'
import AboutSection from '@/components/public/AboutSection'
import PropertiesSection from '@/components/public/PropertiesSection'
import ReviewsSection from '@/components/public/ReviewsSection'

const DEFAULT_ABOUT =
  'Top of the Hill Estates offers fully furnished rooms in the heart of Mesa and Tempe, Arizona. Whether you need a short-term stay or a long-term home, we have flexible options to fit your lifestyle — with no platform fees when you book directly.'

async function getData() {
  try {
    const supabase = await createServerSupabaseClient()

    const [roomsResult, settingsResult] = await Promise.all([
      supabase
        .from('rooms')
        .select('*, property:properties(*)')
        .eq('is_active', true)
        .order('name'),
      supabase.from('site_settings').select('*').limit(1).single(),
    ])

    const rooms: Array<Room & { property: Property }> = roomsResult.data ?? []
    const settings: SiteSettings | null = settingsResult.data ?? null

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

    return {
      properties: Array.from(propertyMap.values()),
      aboutText: settings?.about_text ?? DEFAULT_ABOUT,
    }
  } catch {
    return { properties: [], aboutText: DEFAULT_ABOUT }
  }
}

export default async function HomePage() {
  const { properties, aboutText } = await getData()

  return (
    <>
      <Hero />
      <AboutSection aboutText={aboutText} />
      <PropertiesSection properties={properties} />
      <ReviewsSection />
    </>
  )
}
