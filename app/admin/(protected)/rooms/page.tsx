export const dynamic = 'force-dynamic'

import { createServiceRoleClient } from '@/lib/supabase'
import type { Room, Property, ICalSource } from '@/types'
import RoomsClient from '@/components/admin/RoomsClient'

type RoomWithIcal = Room & { property: Property; ical_sources: ICalSource[] }

export default async function AdminRoomsPage() {
  const supabase = createServiceRoleClient()
  const [{ data: rooms }, { data: properties }] = await Promise.all([
    supabase.from('rooms').select('*, property:properties(*), ical_sources(*)').order('name'),
    supabase.from('properties').select('id, name, city, state').order('name'),
  ])

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ''

  return (
    <RoomsClient
      rooms={(rooms ?? []) as RoomWithIcal[]}
      properties={(properties ?? []) as Pick<Property, 'id' | 'name' | 'city' | 'state'>[]}
      siteUrl={siteUrl}
    />
  )
}
