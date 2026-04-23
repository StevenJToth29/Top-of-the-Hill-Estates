export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase'
import LongTermInquiryForm from '@/components/public/LongTermInquiryForm'

interface Props {
  searchParams: { room?: string; move_in?: string; occupants?: string }
}

export default async function ApplyPage({ searchParams }: Props) {
  const slug = searchParams.room
  if (!slug) redirect('/')

  const supabase = await createServerSupabaseClient()
  const { data: rawRoom } = await supabase
    .from('rooms')
    .select('name, slug, guest_capacity, property:properties(name)')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (!rawRoom) redirect('/')

  const room = rawRoom as unknown as {
    name: string
    slug: string
    guest_capacity: number
    property: { name: string } | null
  }

  const maxOccupants = Math.max(room.guest_capacity ?? 1, 1)
  const propertyName = room.property?.name ?? ''
  const moveIn = searchParams.move_in ?? ''
  const parsedOccupants = parseInt(searchParams.occupants ?? '', 10)
  const occupants = Number.isFinite(parsedOccupants) && parsedOccupants >= 1
    ? Math.min(parsedOccupants, maxOccupants)
    : 1

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
        <div className="space-y-1">
          <Link
            href={`/rooms/${room.slug}`}
            className="inline-flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-on-surface transition-colors mb-2"
          >
            ← Back to {room.name}
          </Link>
          {propertyName && (
            <p className="text-xs uppercase tracking-widest text-secondary font-body">
              {propertyName}
            </p>
          )}
          <h1 className="font-display text-3xl font-bold text-primary">{room.name}</h1>
          <p className="text-on-surface-variant text-sm">Long-term rental inquiry</p>
          {moveIn && (
            <p className="text-on-surface-variant text-sm">
              Desired move-in:{' '}
              <span className="font-semibold text-on-surface">
                {new Date(moveIn + 'T00:00:00').toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            </p>
          )}
        </div>

        <div className="bg-surface-highest/40 backdrop-blur-xl shadow-[0_8px_40px_rgba(45,212,191,0.06)] rounded-2xl p-6">
          <LongTermInquiryForm
            roomSlug={room.slug}
            roomName={room.name}
            propertyName={propertyName}
            initialMoveIn={moveIn}
            initialOccupants={occupants}
            maxOccupants={maxOccupants}
          />
        </div>
      </div>
    </main>
  )
}
