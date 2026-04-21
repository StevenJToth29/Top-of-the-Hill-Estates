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
  const [{ data: rooms }, { count: propertyCount }] = await Promise.all([
    supabase.from('rooms').select('*, property:properties(*), ical_sources(*)').order('name'),
    supabase.from('properties').select('id', { count: 'exact', head: true }),
  ])

  const typedRooms = (rooms ?? []) as RoomWithIcal[]
  const hasProperties = (propertyCount ?? 0) > 0
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ''

  // Group by property
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
    <div className="min-h-screen bg-background px-4 py-10 sm:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold text-on-surface">Rooms</h1>
            <p className="text-on-surface-variant mt-1">{typedRooms.length} rooms across {Object.keys(grouped).length} properties</p>
          </div>
          <div className="flex items-center gap-3">
            <SyncAllButton />
            {hasProperties ? (
              <Link
                href="/admin/rooms/new"
                className="flex items-center gap-2 bg-gradient-to-r from-primary to-secondary text-background font-semibold rounded-2xl px-5 py-2.5 hover:opacity-90 transition-opacity"
              >
                <PlusIcon className="w-4 h-4" />
                Add New Room
              </Link>
            ) : (
              <span
                title="Create a property first before adding rooms."
                className="flex items-center gap-2 bg-surface-container text-on-surface-variant font-semibold rounded-2xl px-5 py-2.5 cursor-not-allowed opacity-50 select-none"
              >
                <PlusIcon className="w-4 h-4" />
                Add New Room
              </span>
            )}
          </div>
        </div>

        {/* Properties + rooms */}
        {typedRooms.length === 0 ? (
          <div className="bg-surface-highest/40 backdrop-blur-xl rounded-2xl p-12 text-center space-y-2">
            <p className="text-on-surface-variant">No rooms yet.</p>
            {hasProperties ? (
              <Link href="/admin/rooms/new" className="inline-block text-secondary hover:underline text-sm">
                Add your first room
              </Link>
            ) : (
              <p className="text-sm text-on-surface-variant/60">
                You need to{' '}
                <Link href="/admin/properties/new" className="text-secondary hover:underline">
                  create a property
                </Link>{' '}
                first before adding rooms.
              </p>
            )}
          </div>
        ) : (
          Object.values(grouped).map(({ property, rooms: propRooms }) => (
            <div key={property.id} className="bg-surface-highest/40 backdrop-blur-xl rounded-2xl overflow-hidden">
              {/* Property header */}
              <div className="px-6 py-4 bg-surface-container/60">
                <h2 className="font-display text-lg font-semibold text-on-surface">{property.name}</h2>
                <p className="text-sm text-on-surface-variant/70">
                  {property.city}, {property.state}
                </p>
              </div>

              {/* Room rows */}
              <div className="divide-y divide-outline-variant">
                {propRooms.map((room) => (
                  <RoomCardWithIcal key={room.id} room={room} siteUrl={siteUrl} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
