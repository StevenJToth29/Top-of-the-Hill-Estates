export const dynamic = 'force-dynamic'

import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { createServiceRoleClient, createServerSupabaseClient } from '@/lib/supabase'
import PropertyForm from '@/components/admin/PropertyForm'
import type { Property } from '@/types'

interface EditPropertyPageProps {
  params: { id: string }
}

export default async function EditPropertyPage({ params }: EditPropertyPageProps) {
  const serverClient = await createServerSupabaseClient()
  const {
    data: { user },
  } = await serverClient.auth.getUser()
  if (!user) redirect('/admin/login')

  const supabase = createServiceRoleClient()
  const { data: property } = await supabase
    .from('properties')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!property) notFound()

  async function updateProperty(formData: FormData) {
    'use server'
    const authClient = await createServerSupabaseClient()
    const {
      data: { user: actionUser },
    } = await authClient.auth.getUser()
    if (!actionUser) redirect('/admin/login')

    const supabase = createServiceRoleClient()
    const { error } = await supabase
      .from('properties')
      .update({
        name: formData.get('name') as string,
        address: formData.get('address') as string,
        city: formData.get('city') as string,
        state: formData.get('state') as string,
        description: (formData.get('description') as string) ?? '',
        bedrooms: Number(formData.get('bedrooms') ?? 0),
        bathrooms: Number(formData.get('bathrooms') ?? 0),
        amenities: JSON.parse((formData.get('amenities') as string) || '[]'),
        images: JSON.parse((formData.get('images') as string) || '[]'),
      })
      .eq('id', formData.get('id') as string)

    if (error) throw new Error(error.message)
    redirect('/admin/properties')
  }

  return (
    <div className="min-h-screen bg-background px-4 py-10 sm:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/properties"
            className="flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            Back to Properties
          </Link>
        </div>

        <div>
          <h1 className="font-display text-3xl font-bold text-on-surface">Edit Property</h1>
          <p className="text-on-surface-variant mt-1">{property.name}</p>
        </div>

        <PropertyForm
          property={property as Property}
          propertyId={params.id}
          onSave={updateProperty}
        />
      </div>
    </div>
  )
}
