import type { Property, Room } from '@/types'
import RoomCard from './RoomCard'

interface Props {
  properties: Array<Property & { rooms: Room[] }>
}

export default function PropertiesSection({ properties }: Props) {
  const hasRooms = properties.some((p) => p.rooms.length > 0)

  return (
    <section className="bg-background py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="text-xs uppercase tracking-widest text-secondary font-medium mb-3 text-center">
          Available Rooms
        </p>
        <h2 className="font-display font-bold text-primary text-4xl text-center mb-12 leading-tight">
          Find Your Perfect Room
        </h2>

        {!hasRooms && (
          <p className="text-on-surface-variant text-center">
            No rooms are currently available. Please check back soon.
          </p>
        )}

        {properties.map((property) => {
          if (property.rooms.length === 0) return null
          return (
            <div key={property.id} className="mb-14">
              <h3 className="font-display font-bold text-primary text-2xl mb-6">
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
      </div>
    </section>
  )
}
