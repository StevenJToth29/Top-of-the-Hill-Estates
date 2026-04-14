import Link from 'next/link'
import Image from 'next/image'
import { UserGroupIcon, HomeIcon, BeakerIcon } from '@heroicons/react/24/outline'
import type { Room, Property } from '@/types'

interface Props {
  room: Room & { property: Property }
}

export default function RoomCard({ room }: Props) {
  const { property } = room
  const coverImage = room.images?.[0] ?? null

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col">
      {/* Image */}
      <div className="relative h-52 w-full bg-gray-100">
        {coverImage ? (
          <Image
            src={coverImage}
            alt={room.name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
            <HomeIcon className="h-12 w-12 text-gray-300" />
          </div>
        )}
        {/* Property badge */}
        <div className="absolute top-3 left-3">
          <span className="bg-white/90 backdrop-blur-sm text-slate-700 text-xs font-semibold px-2.5 py-1 rounded-full border border-gray-200">
            {property.name}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-5 gap-3">
        <div>
          <h3 className="font-display font-bold text-slate-900 text-lg leading-snug">
            {room.name}
          </h3>
          {room.short_description && (
            <p className="text-slate-500 text-sm mt-1 line-clamp-2">{room.short_description}</p>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-slate-500 text-sm">
          <span className="flex items-center gap-1">
            <UserGroupIcon className="h-4 w-4 text-primary" />
            {room.guest_capacity} {room.guest_capacity === 1 ? 'guest' : 'guests'}
          </span>
          <span className="flex items-center gap-1">
            <HomeIcon className="h-4 w-4 text-primary" />
            {room.bedrooms} {room.bedrooms === 1 ? 'bed' : 'beds'}
          </span>
          <span className="flex items-center gap-1">
            <BeakerIcon className="h-4 w-4 text-primary" />
            {room.bathrooms} {room.bathrooms === 1 ? 'bath' : 'baths'}
          </span>
        </div>

        {/* Pricing + CTA */}
        <div className="mt-auto flex items-end justify-between pt-2 border-t border-gray-100">
          <div>
            <p className="text-slate-900 font-bold text-lg">
              ${room.nightly_rate.toFixed(0)}
              <span className="text-slate-400 font-normal text-sm"> / night</span>
            </p>
            {room.monthly_rate > 0 && (
              <p className="text-slate-400 text-xs">
                ${room.monthly_rate.toFixed(0)} / month
              </p>
            )}
          </div>
          <Link
            href={`/rooms/${room.slug}`}
            className="bg-primary text-white font-semibold rounded-lg px-4 py-2 text-sm hover:bg-secondary transition-colors"
          >
            View Room
          </Link>
        </div>
      </div>
    </div>
  )
}
