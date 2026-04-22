'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PencilSquareIcon, ArrowPathIcon, ChevronDownIcon, DocumentDuplicateIcon } from '@heroicons/react/24/outline'
import RoomStatusToggle from './RoomStatusToggle'
import ICalSyncPanel from '@/components/admin/ICalSyncPanel'
import DuplicateRoomModal from '@/components/admin/DuplicateRoomModal'
import type { Room, Property, ICalSource } from '@/types'

type RoomWithIcal = Room & { property: Property; ical_sources: ICalSource[] }

interface Props {
  room: RoomWithIcal
  siteUrl: string
}

export default function RoomCardWithIcal({ room, siteUrl }: Props) {
  const [icalOpen, setIcalOpen] = useState(false)
  const [duplicateOpen, setDuplicateOpen] = useState(false)

  return (
    <div className="bg-surface-highest/40 backdrop-blur-xl rounded-2xl border border-outline-variant/30 overflow-hidden hover:shadow-md transition-shadow">
      <div className="flex items-center gap-4 px-5 py-4">
        {/* Thumbnail */}
        <div className="w-20 h-16 rounded-xl overflow-hidden shrink-0 bg-surface-container">
          {room.images?.[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={room.images[0]} alt={room.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-2xl text-on-surface-variant/30">
              🛏
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="font-semibold text-on-surface truncate">{room.name}</p>
            <span
              className={`text-xs rounded-full px-2 py-0.5 font-medium shrink-0 ${
                room.is_active
                  ? 'bg-secondary/10 text-secondary'
                  : 'bg-error-container/30 text-error'
              }`}
            >
              {room.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
          {room.short_description && (
            <p className="text-xs text-on-surface-variant/70 line-clamp-1 mb-1">
              {room.short_description}
            </p>
          )}
          <p className="text-sm text-on-surface-variant/60">
            <span className="font-semibold text-secondary">${room.nightly_rate}</span>
            <span>/night</span>
            {room.monthly_rate && (
              <>
                <span className="mx-1.5">·</span>
                <span>${room.monthly_rate}/mo</span>
              </>
            )}
            {(room.bedrooms || room.bathrooms) && (
              <>
                <span className="mx-1.5">·</span>
                <span>{room.bedrooms}bd / {room.bathrooms}ba</span>
              </>
            )}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <RoomStatusToggle roomId={room.id} isActive={room.is_active} />

          <Link
            href={`/admin/rooms/${room.id}/edit`}
            className="flex items-center gap-1.5 text-sm bg-surface-container rounded-xl px-3 py-1.5 text-on-surface-variant hover:bg-surface-high transition-colors"
          >
            <PencilSquareIcon className="w-4 h-4" />
            Edit
          </Link>

          <button
            type="button"
            onClick={() => setDuplicateOpen(true)}
            className="flex items-center gap-1.5 text-sm bg-surface-container rounded-xl px-3 py-1.5 text-on-surface-variant hover:bg-surface-high transition-colors"
          >
            <DocumentDuplicateIcon className="w-4 h-4" />
            Duplicate
          </button>

          <button
            type="button"
            onClick={() => setIcalOpen((o) => !o)}
            className={`flex items-center gap-1.5 text-sm rounded-xl px-3 py-1.5 transition-colors ${
              icalOpen
                ? 'bg-secondary/10 text-secondary'
                : 'bg-surface-container text-on-surface-variant hover:bg-surface-high'
            }`}
          >
            <ArrowPathIcon className="w-4 h-4" />
            iCal
            <ChevronDownIcon
              className={`w-3 h-3 transition-transform duration-200 ${icalOpen ? 'rotate-180' : ''}`}
            />
          </button>
        </div>
      </div>

      {icalOpen && (
        <div className="px-5 pb-5 pt-2 border-t border-outline-variant/40 bg-surface-container/20">
          <ICalSyncPanel room={room} siteUrl={siteUrl} />
        </div>
      )}

      <DuplicateRoomModal
        isOpen={duplicateOpen}
        onClose={() => setDuplicateOpen(false)}
        roomId={room.id}
        roomName={room.name}
      />
    </div>
  )
}
