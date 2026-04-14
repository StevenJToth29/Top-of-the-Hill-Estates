import Link from 'next/link'
import Image from 'next/image'
import {
  UserGroupIcon,
  HomeIcon,
  BeakerIcon,
} from '@heroicons/react/24/outline'
import type { Room, Property } from '@/types'

interface Props {
  room: Room & { property: Property }
}

export default function RoomCard({ room }: Props) {
  const { property } = room
  const coverImage = room.images?.[0] ?? null

  return (
    <div className="bg-surface-highest/40 backdrop-blur-xl rounded-2xl overflow-hidden shadow-[0_8px_40px_rgba(175,201,234,0.06)] flex flex-col">
      <div className="relative h-52 w-full bg-surface-container">
        {coverImage ? (
          <Image
            src={coverImage}
            alt={room.name}
            fill
            className="object-cover rounded-xl ring-1 ring-white/10"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        ) : (
          <div className="absolute inset-0 rounded-xl ring-1 ring-white/10 flex items-center justify-center">
            <HomeIcon className="h-12 w-12 text-on-surface-variant/30" />
          </div>
        )}
      </div>

      <div className="flex flex-col flex-1 p-5 gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-secondary font-medium mb-1">
            {property.name}
          </p>
          <h3 className="font-display font-bold text-on-surface text-xl leading-snug">
            {room.name}
          </h3>
        </div>

        {room.short_description && (
          <p className="text-on-surface-variant text-sm line-clamp-2">{room.short_description}</p>
        )}

        <div className="flex items-center gap-4 text-on-surface-variant text-sm">
          <span className="flex items-center gap-1">
            <UserGroupIcon className="h-4 w-4 text-secondary" />
            {room.guest_capacity} {room.guest_capacity === 1 ? 'guest' : 'guests'}
          </span>
          <span className="flex items-center gap-1">
            <HomeIcon className="h-4 w-4 text-secondary" />
            {room.bedrooms} {room.bedrooms === 1 ? 'bed' : 'beds'}
          </span>
          <span className="flex items-center gap-1">
            <BeakerIcon className="h-4 w-4 text-secondary" />
            {room.bathrooms} {room.bathrooms === 1 ? 'bath' : 'baths'}
          </span>
        </div>

        <div className="mt-auto flex items-end justify-between pt-2">
          <div>
            <p className="text-primary font-bold text-lg">
              ${room.nightly_rate.toFixed(0)}
              <span className="text-on-surface-variant font-normal text-sm"> / night</span>
            </p>
            {room.monthly_rate > 0 && (
              <p className="text-on-surface-variant text-sm">
                ${room.monthly_rate.toFixed(0)} / month
              </p>
            )}
          </div>
          <Link
            href={`/checkout?room=${room.slug}`}
            className="bg-gradient-to-r from-primary to-secondary text-background font-semibold rounded-2xl px-5 py-2 text-sm shadow-[0_0_10px_rgba(175,201,234,0.30)] hover:opacity-90 transition-opacity"
          >
            Book Now
          </Link>
        </div>
      </div>
    </div>
  )
}
