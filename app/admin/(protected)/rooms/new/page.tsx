export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { createServiceRoleClient, createServerSupabaseClient } from '@/lib/supabase'
import RoomForm from '@/components/admin/RoomForm'
import type { Property } from '@/types'

export default async function NewRoomPage() {
  const serverClient = await createServerSupabaseClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) redirect('/admin/login')

  const supabase = createServiceRoleClient()
  const { data: properties } = await supabase.from('properties').select('*').order('name')

  async function createRoom(formData: FormData) {
    'use server'
    const authClient = await createServerSupabaseClient()
    const { data: { user: actionUser } } = await authClient.auth.getUser()
    if (!actionUser) redirect('/admin/login')

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
        show_nightly_rate: formData.get('show_nightly_rate') === 'true',
        show_monthly_rate: formData.get('show_monthly_rate') === 'true',
        minimum_nights_short_term: Number(formData.get('minimum_nights_short_term')),
        minimum_nights_long_term: Number(formData.get('minimum_nights_long_term')),
        is_active: formData.get('is_active') === 'true',
        amenities: JSON.parse((formData.get('amenities') as string) || '[]'),
        images: JSON.parse((formData.get('images') as string) || '[]'),
      })
      .select('id')
      .single()

    if (error) throw new Error(error.message)
    redirect(`/admin/rooms/${data.id}/edit`)
  }

  const typedProperties = (properties ?? []) as Property[]

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

        {typedProperties.length === 0 ? (
          <div className="bg-surface-highest/40 backdrop-blur-xl rounded-2xl p-10 text-center space-y-4">
            <p className="text-on-surface font-medium">No properties found.</p>
            <p className="text-sm text-on-surface-variant">
              You need at least one property before adding rooms.
            </p>
            <Link
              href="/admin/properties/new"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-primary to-secondary text-background font-semibold rounded-2xl px-6 py-2.5 hover:opacity-90 transition-opacity text-sm"
            >
              Create a Property
            </Link>
          </div>
        ) : (
          <RoomForm
            properties={typedProperties}
            onSave={createRoom}
          />
        )}
      </div>
    </div>
  )
}
