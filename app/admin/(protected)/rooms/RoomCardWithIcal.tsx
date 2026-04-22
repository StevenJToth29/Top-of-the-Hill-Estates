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
    <div>
      <div className="flex items-center gap-4 px-6 py-4">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-on-surface truncate">{room.name}</p>
          <p className="text-sm text-on-surface-variant/60 mt-0.5">
            ${room.nightly_rate}/night · ${room.monthly_rate}/mo ·{' '}
            {room.bedrooms}bd / {room.bathrooms}ba
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span
            className={`text-xs rounded-full px-2.5 py-1 font-medium ${
              room.is_active
                ? 'bg-secondary/10 text-secondary'
                : 'bg-error-container/30 text-error'
            }`}
          >
            {room.is_active ? 'Active' : 'Inactive'}
          </span>

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
        <div className="px-6 pb-6 pt-2 border-t border-outline-variant/40 bg-surface-container/20">
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
