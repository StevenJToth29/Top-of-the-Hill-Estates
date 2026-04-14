export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { createServiceRoleClient } from '@/lib/supabase'
import RoomForm from '@/components/admin/RoomForm'
import type { Property } from '@/types'

export default async function NewRoomPage() {
  const supabase = createServiceRoleClient()
  const { data: properties } = await supabase.from('properties').select('*').order('name')

  async function createRoom(formData: FormData) {
    'use server'
    const supabase = createServiceRoleClient()
    const { data, error } = await supabase
      .from('rooms')
      .insert({
        property_id: formData.get('property_id') as string,
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
      })
      .select('id')
      .single()

    if (error) throw new Error(error.message)
    redirect(`/admin/rooms/${data.id}/edit`)
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
          <h1 className="font-display text-3xl font-bold text-on-surface">Add New Room</h1>
          <p className="text-on-surface-variant mt-1">Fill in the details below to create a new room listing.</p>
        </div>

        <RoomForm
          properties={(properties ?? []) as Property[]}
          onSave={createRoom}
        />
      </div>
    </div>
  )
}
