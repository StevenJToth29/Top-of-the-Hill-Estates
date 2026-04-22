export const dynamic = 'force-dynamic'

import { notFound, redirect } from 'next/navigation'
import { createServiceRoleClient, createServerSupabaseClient } from '@/lib/supabase'
import RoomForm from '@/components/admin/RoomForm'
import type { Room, Property, ICalSource, RoomFee } from '@/types'

interface EditRoomPageProps {
  params: { id: string }
}

export default async function EditRoomPage({ params }: EditRoomPageProps) {
  const serverClient = await createServerSupabaseClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) redirect('/admin/login')

  const supabase = createServiceRoleClient()

  const [{ data: room }, { data: properties }, { data: icalSources }, { data: roomFees }] = await Promise.all([
    supabase.from('rooms').select('*, property:properties(*)').eq('id', params.id).single(),
    supabase.from('properties').select('*').order('name'),
    supabase.from('ical_sources').select('*').eq('room_id', params.id),
    supabase.from('room_fees').select('*').eq('room_id', params.id).order('created_at'),
  ])

  if (!room) notFound()

  const roomWithFees = { ...room, fees: (roomFees ?? []) as RoomFee[] } as Room

  return (
    <div className="-m-8 bg-background">
      <RoomForm
        room={roomWithFees}
        properties={(properties ?? []) as Property[]}
        icalSources={(icalSources ?? []) as ICalSource[]}
        roomId={params.id}
      />
    </div>
  )
}
