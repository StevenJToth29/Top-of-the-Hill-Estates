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

  async function updateRoom(formData: FormData) {
    'use server'
    const authClient = await createServerSupabaseClient()
    const { data: { user: actionUser } } = await authClient.auth.getUser()
    if (!actionUser) redirect('/admin/login')

    const supabase = createServiceRoleClient()
    const id = formData.get('id') as string
    const { error } = await supabase
      .from('rooms')
      .update({
        name: formData.get('name') as string,
        slug: formData.get('slug') as string,
        short_description: formData.get('short_description') as string,
        description: formData.get('description') as string,
        guest_capacity: Number(formData.get('guest_capacity')),
        bedrooms: Number(formData.get('bedrooms')),
        bathrooms: Number(formData.get('bathrooms')),
        nightly_rate: Number(formData.get('nightly_rate')),
        monthly_rate: Number(formData.get('monthly_rate')),
        minimum_nights_short_term: Number(formData.get('minimum_nights_short_term')),
        minimum_nights_long_term: Number(formData.get('minimum_nights_long_term')),
        house_rules: formData.get('house_rules') as string,
        is_active: formData.get('is_active') === 'true',
        amenities: JSON.parse((formData.get('amenities') as string) || '[]'),
        images: JSON.parse((formData.get('images') as string) || '[]'),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) throw new Error(error.message)
    redirect('/admin/rooms')
  }

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
          onSave={updateRoom}
        />
      </div>
    </div>
  )
}
