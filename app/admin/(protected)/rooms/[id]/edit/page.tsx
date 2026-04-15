export const dynamic = 'force-dynamic'

import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { createServiceRoleClient, createServerSupabaseClient } from '@/lib/supabase'
import RoomForm from '@/components/admin/RoomForm'
import type { Room, Property, ICalSource } from '@/types'

interface EditRoomPageProps {
  params: { id: string }
}

export default async function EditRoomPage({ params }: EditRoomPageProps) {
  const serverClient = await createServerSupabaseClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) redirect('/admin/login')

  const supabase = createServiceRoleClient()

  const [{ data: room }, { data: properties }, { data: icalSources }] = await Promise.all([
    supabase.from('rooms').select('*, property:properties(*)').eq('id', params.id).single(),
    supabase.from('properties').select('*').order('name'),
    supabase.from('ical_sources').select('*').eq('room_id', params.id),
  ])

  if (!room) notFound()

  return (
    <div className="min-h-screen bg-background px-4 py-10 sm:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/rooms"
            className="flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            Back to Rooms
          </Link>
        </div>

        <div>
          <h1 className="font-display text-3xl font-bold text-on-surface">Edit Room</h1>
          <p className="text-on-surface-variant mt-1">{room.name}</p>
        </div>

        <RoomForm
          room={room as Room}
          properties={(properties ?? []) as Property[]}
          icalSources={(icalSources ?? []) as ICalSource[]}
          roomId={params.id}
        />
      </div>
    </div>
  )
}
