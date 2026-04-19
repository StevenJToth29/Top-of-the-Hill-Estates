import Image from 'next/image'
import Link from 'next/link'
import { UsersIcon, HomeModernIcon } from '@heroicons/react/24/outline'
import type { Property, Room } from '@/types'

export type RoomWithProperty = Room & { property: Property }

interface SearchContext {
  checkin?: string
  checkout?: string
  guests?: string
}

export default function RoomsGrid({ rooms, searchContext }: { rooms: RoomWithProperty[]; searchContext?: SearchContext }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {rooms.map((room) => (
        <InlineRoomCard key={room.id} room={room} searchContext={searchContext} />
      ))}
    </div>
  )
}

function InlineRoomCard({ room, searchContext }: { room: RoomWithProperty; searchContext?: SearchContext }) {
  const primaryImage = room.images?.[0] ?? null

  const bookHref = (() => {
    const params = new URLSearchParams()
    if (searchContext?.checkin) params.set('checkin', searchContext.checkin)
    if (searchContext?.checkout) params.set('checkout', searchContext.checkout)
    if (searchContext?.guests) params.set('guests', searchContext.guests)
    const qs = params.toString()
    return `/rooms/${room.slug}${qs ? `?${qs}` : ''}`
  })()

  return (
    <article className="bg-surface-highest/40 backdrop-blur-xl rounded-2xl overflow-hidden hover:shadow-[0_8px_40px_rgba(45,212,191,0.12)] transition-shadow flex flex-col">
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
          href={bookHref}
          className="mt-2 block text-center bg-gradient-to-r from-primary to-secondary text-background font-semibold font-body rounded-2xl px-6 py-2.5 shadow-[0_0_10px_rgba(45,212,191,0.30)] hover:opacity-90 transition-opacity w-full"
        >
          Book Now
        </Link>
      </div>
    </article>
  )
}
