import type { Property, Room } from '@/types'
import RoomCard from './RoomCard'
import Link from 'next/link'

interface Props {
  properties: Array<Property & { rooms: Room[] }>
}

export default function PropertiesSection({ properties }: Props) {
  const hasRooms = properties.some((p) => p.rooms.length > 0)

  return (
    <section className="bg-surface-lowest py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="text-xs uppercase tracking-widest text-primary font-semibold mb-2">
              Available Rooms
            </p>
            <h2 className="font-display font-extrabold text-on-surface text-3xl leading-tight">
              Featured Locations
            </h2>
            <p className="text-on-surface-variant font-body text-sm mt-1">
              Discover furnished rooms across the Valley
            </p>
          </div>
          <Link
            href="/rooms"
            className="text-sm font-semibold text-primary hover:text-secondary transition-colors duration-150 hidden sm:block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
          >
            View all rooms →
          </Link>
        </div>

        {!hasRooms && (
          <p className="text-on-surface-variant font-body text-center py-12">
            No rooms are currently available. Please check back soon.
          </p>
        )}

        {properties.map((property) => {
          if (property.rooms.length === 0) return null
          return (
            <div key={property.id} className="mb-14">
              <h3 className="font-display font-bold text-on-surface text-xl mb-6 flex items-center gap-2">
                <span className="inline-block w-1.5 h-5 bg-primary rounded-full" />
                {property.name}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {property.rooms.map((room) => (
                  <RoomCard key={room.id} room={{ ...room, property }} />
                ))}
              </div>
            </div>
          )
        })}

        <div className="text-center mt-4 sm:hidden">
          <Link
            href="/rooms"
            className="text-sm font-semibold text-primary hover:text-secondary transition-colors duration-150"
          >
            View all rooms →
          </Link>
        </div>
      </div>
    </section>
  )
}
