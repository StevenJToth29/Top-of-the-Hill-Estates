export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { PlusIcon } from '@heroicons/react/24/outline'
import { createServiceRoleClient } from '@/lib/supabase'
import type { Room, Property, ICalSource } from '@/types'
import SyncAllButton from '@/components/admin/SyncAllButton'
import RoomCardWithIcal from './RoomCardWithIcal'

type RoomWithIcal = Room & { property: Property; ical_sources: ICalSource[] }

export default async function AdminRoomsPage() {
  const supabase = createServiceRoleClient()
  const [{ data: rooms }, { data: properties }] = await Promise.all([
    supabase.from('rooms').select('*, property:properties(*), ical_sources(*)').order('name'),
    supabase.from('properties').select('id, name, city, state').order('name'),
  ])

  const typedRooms = (rooms ?? []) as RoomWithIcal[]
  const typedProperties = (properties ?? []) as Pick<Property, 'id' | 'name' | 'city' | 'state'>[]
  const hasProperties = typedProperties.length > 0
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ''

  // Group rooms by property
  const grouped = typedRooms.reduce<Record<string, { property: Property; rooms: RoomWithIcal[] }>>(
    (acc, room) => {
      const propId = room.property_id
      if (!acc[propId]) {
        acc[propId] = { property: room.property, rooms: [] }
      }
      acc[propId].rooms.push(room)
      return acc
    },
    {},
  )

  return (
    <>
      {/* Header */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold text-on-surface">Units</h1>
            <p className="text-on-surface-variant mt-1">
              {typedRooms.length} unit{typedRooms.length !== 1 ? 's' : ''} across{' '}
              {Object.keys(grouped).length} propert{Object.keys(grouped).length === 1 ? 'y' : 'ies'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <SyncAllButton />
            {hasProperties ? (
              <Link
                href="/admin/rooms/new"
                className="flex items-center gap-2 bg-gradient-to-r from-primary to-secondary text-background font-semibold rounded-2xl px-5 py-2.5 hover:opacity-90 transition-opacity"
              >
                <PlusIcon className="w-4 h-4" />
                Add New Unit
              </Link>
            ) : (
              <span
                title="Create a property first before adding units."
                className="flex items-center gap-2 bg-surface-container text-on-surface-variant font-semibold rounded-2xl px-5 py-2.5 cursor-not-allowed opacity-50 select-none"
              >
                <PlusIcon className="w-4 h-4" />
                Add New Unit
              </span>
            )}
          </div>
        </div>

        {typedRooms.length === 0 ? (
          <div className="bg-surface-highest/40 backdrop-blur-xl rounded-2xl p-12 text-center space-y-2">
            <p className="text-on-surface-variant">No units yet.</p>
            {hasProperties ? (
              <Link href="/admin/rooms/new" className="inline-block text-secondary hover:underline text-sm">
                Add your first unit
              </Link>
            ) : (
              <p className="text-sm text-on-surface-variant/60">
                You need to{' '}
                <Link href="/admin/properties/new" className="text-secondary hover:underline">
                  create a property
                </Link>{' '}
                first before adding units.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            {Object.values(grouped).map(({ property, rooms: propRooms }) => (
              <div key={property.id}>
                {/* Property group header */}
                <div className="flex items-center gap-3 mb-4">
                  <div>
                    <h2 className="font-display text-base font-bold text-on-surface">{property.name}</h2>
                    <p className="text-xs text-on-surface-variant/60">
                      {property.city}, {property.state}
                    </p>
                  </div>
                  <div className="flex-1 h-px bg-outline-variant/30" />
                  <Link
                    href="/admin/rooms/new"
                    className="flex items-center gap-1.5 text-xs font-semibold text-secondary border border-dashed border-secondary/40 rounded-xl px-3 py-1.5 hover:bg-secondary/5 transition-colors"
                  >
                    + Add Unit
                  </Link>
                </div>

                {/* Room cards */}
                <div className="space-y-3">
                  {propRooms.map((room) => (
                    <RoomCardWithIcal key={room.id} room={room} siteUrl={siteUrl} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
    </>
  )
}
