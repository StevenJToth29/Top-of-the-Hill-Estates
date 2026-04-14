import Image from 'next/image'
import Link from 'next/link'
import { UsersIcon, HomeModernIcon } from '@heroicons/react/24/outline'
import type { Property, Room } from '@/types'

export type RoomWithProperty = Room & { property: Property }

function groupByProperty(
  rooms: RoomWithProperty[],
): Map<string, { property: Property; rooms: RoomWithProperty[] }> {
  const map = new Map<string, { property: Property; rooms: RoomWithProperty[] }>()
  for (const room of rooms) {
    let group = map.get(room.property_id)
    if (!group) {
      group = { property: room.property, rooms: [] }
      map.set(room.property_id, group)
    }
    group.rooms.push(room)
  }
  return map
}

export default function RoomsGrid({ rooms }: { rooms: RoomWithProperty[] }) {
  const entries = Array.from(groupByProperty(rooms).values())

  return (
    <div className="space-y-16">
      {entries.map(({ property, rooms: groupRooms }) => (
        <section key={property.id}>
          <div className="bg-surface-low rounded-2xl px-6 py-5 mb-8">
            <h2 className="font-display font-bold text-2xl text-primary">
              {property.name}
            </h2>
            <p className="font-body text-sm text-on-surface-variant mt-1">
              {property.address}, {property.city}, {property.state}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {groupRooms.map((room) => (
              <InlineRoomCard key={room.id} room={room} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function InlineRoomCard({ room }: { room: RoomWithProperty }) {
  const primaryImage = room.images?.[0] ?? null

  return (
    <article className="bg-surface-highest/40 backdrop-blur-xl rounded-2xl overflow-hidden hover:shadow-[0_8px_40px_rgba(175,201,234,0.12)] transition-shadow flex flex-col">
      <div className="relative aspect-video">
        {primaryImage ? (
          <Image
            src={primaryImage}
            alt={room.name}
            fill
            className="object-cover rounded-xl ring-1 ring-white/10"
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className="absolute inset-0 bg-surface rounded-xl ring-1 ring-white/10 flex items-center justify-center">
            <HomeModernIcon className="w-12 h-12 text-on-surface-variant/30" />
          </div>
        )}
      </div>

      <div className="p-5 flex flex-col gap-3 flex-1">
        <span className="text-secondary uppercase text-xs tracking-widest font-body">
          {room.property?.name}
        </span>

        <h3 className="font-display font-bold text-lg text-on-surface leading-snug">
          {room.name}
        </h3>

        <div className="flex items-center gap-3 text-on-surface-variant font-body text-sm">
          <span className="flex items-center gap-1">
            <UsersIcon className="w-4 h-4 flex-shrink-0" />
            {room.guest_capacity} {room.guest_capacity === 1 ? 'guest' : 'guests'}
          </span>
          <span className="text-on-surface-variant/40">·</span>
          <span>{room.bedrooms}BR</span>
          <span className="text-on-surface-variant/40">·</span>
          <span>{room.bathrooms}BA</span>
        </div>

        <div className="flex items-baseline gap-3 mt-auto pt-2">
          {room.nightly_rate > 0 && (
            <span className="font-body font-bold text-primary">
              ${room.nightly_rate.toLocaleString()}
              <span className="text-xs font-normal text-on-surface-variant ml-0.5">
                /night
              </span>
            </span>
          )}
          {room.monthly_rate > 0 && (
            <span className="font-body text-sm text-on-surface-variant">
              ${room.monthly_rate.toLocaleString()}
              <span className="text-xs ml-0.5">/mo</span>
            </span>
          )}
        </div>

        <Link
          href={`/rooms/${room.slug}`}
          className="mt-2 block text-center bg-gradient-to-r from-primary to-secondary text-background font-semibold font-body rounded-2xl px-6 py-2.5 shadow-[0_0_10px_rgba(175,201,234,0.30)] hover:opacity-90 transition-opacity w-full"
        >
          Book Now
        </Link>
      </div>
    </article>
  )
}
