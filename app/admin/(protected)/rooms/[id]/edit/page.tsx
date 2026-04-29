export const dynamic = 'force-dynamic'

import { notFound, redirect } from 'next/navigation'
import { createServiceRoleClient, createServerSupabaseClient } from '@/lib/supabase'
import RoomForm from '@/components/admin/RoomForm'
import { RoomTaskAutomations } from '@/components/admin/RoomTaskAutomations'
import type { Room, Property, ICalSource, RoomFee, TaskAutomation, Person } from '@/types'

interface EditRoomPageProps { params: { id: string } }

export default async function EditRoomPage({ params }: EditRoomPageProps) {
  const serverClient = await createServerSupabaseClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) redirect('/admin/login')

  const supabase = createServiceRoleClient()

  const { data: room } = await supabase
    .from('rooms').select('*, property:properties(*)').eq('id', params.id).single()

  if (!room) notFound()

  const propertyId = (room as unknown as { property_id: string }).property_id ?? ''

  const [
    { data: properties }, { data: icalSources }, { data: roomFees },
    { data: roomRules }, { data: propertyRulesData }, { data: globalRules }, { data: people },
    { data: allRooms },
  ] = await Promise.all([
    supabase.from('properties').select('*').order('name'),
    supabase.from('ical_sources').select('*').eq('room_id', params.id),
    supabase.from('room_fees').select('*').eq('room_id', params.id).order('created_at'),
    supabase.from('task_automations').select('*').eq('scope_type', 'room').eq('room_id', params.id).eq('is_active', true),
    supabase.from('task_automations').select('*').eq('scope_type', 'property').eq('property_id', propertyId).eq('is_active', true),
    supabase.from('task_automations').select('*').eq('scope_type', 'global').eq('is_active', true),
    supabase.from('people').select('*').order('name'),
    supabase.from('rooms').select('*, property:properties(id,name)').order('name'),
  ])

  const roomWithFees = { ...room, fees: (roomFees ?? []) as RoomFee[] } as Room
  const hasRoomRules = (roomRules ?? []).length > 0
  const inheritedRules = hasRoomRules ? [] : [
    ...((propertyRulesData ?? []) as TaskAutomation[]),
    ...((globalRules ?? []) as TaskAutomation[]),
  ]

  return (
    <div className="-m-8 bg-background">
      <RoomForm
        room={roomWithFees}
        properties={(properties ?? []) as Property[]}
        icalSources={(icalSources ?? []) as ICalSource[]}
        roomId={params.id}
        taskAutomationsTab={
          <RoomTaskAutomations
            roomId={params.id}
            propertyId={propertyId}
            initialRoomRules={(roomRules ?? []) as TaskAutomation[]}
            inheritedRules={inheritedRules}
            people={(people ?? []) as Person[]}
            rooms={(allRooms ?? []) as Room[]}
            properties={(properties ?? []) as Property[]}
          />
        }
      />
    </div>
  )
}
