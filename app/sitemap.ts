import type { MetadataRoute } from 'next'
import { createServiceRoleClient } from '@/lib/supabase'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://topofthehillrooms.com'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createServiceRoleClient()
  const { data: rooms } = await supabase
    .from('rooms')
    .select('slug, updated_at')
    .eq('is_active', true)

  const roomEntries: MetadataRoute.Sitemap = (rooms ?? []).map((room) => ({
    url: `${SITE_URL}/rooms/${room.slug}`,
    lastModified: room.updated_at ? new Date(room.updated_at) : new Date(),
    changeFrequency: 'weekly',
    priority: 0.8,
  }))

  return [
    { url: SITE_URL, lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
    { url: `${SITE_URL}/rooms`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    ...roomEntries,
    { url: `${SITE_URL}/contact`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/privacypolicy`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.2 },
    { url: `${SITE_URL}/termsandconditions`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.2 },
  ]
}
