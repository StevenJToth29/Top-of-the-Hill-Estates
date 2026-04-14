export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { PencilSquareIcon, PlusIcon } from '@heroicons/react/24/outline'
import { createServiceRoleClient } from '@/lib/supabase'
import type { Property } from '@/types'
import DeletePropertyButton from '@/components/admin/DeletePropertyButton'

export default async function AdminPropertiesPage() {
  const supabase = createServiceRoleClient()

  const [{ data: properties }, { data: rooms }] = await Promise.all([
    supabase.from('properties').select('*').order('name'),
    supabase.from('rooms').select('property_id'),
  ])

  const typedProperties = (properties ?? []) as Property[]

  const roomCountByProperty = (rooms ?? []).reduce<Record<string, number>>((acc, r) => {
    acc[r.property_id] = (acc[r.property_id] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="min-h-screen bg-background px-4 py-10 sm:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold text-on-surface">Properties</h1>
            <p className="text-on-surface-variant mt-1">{typedProperties.length} properties</p>
          </div>
          <Link
            href="/admin/properties/new"
            className="flex items-center gap-2 bg-gradient-to-r from-primary to-secondary text-background font-semibold rounded-2xl px-5 py-2.5 hover:opacity-90 transition-opacity"
          >
            <PlusIcon className="w-4 h-4" />
            Add Property
          </Link>
        </div>

        {/* List */}
        {typedProperties.length === 0 ? (
          <div className="bg-surface-highest/40 backdrop-blur-xl rounded-2xl p-12 text-center">
            <p className="text-on-surface-variant">No properties yet.</p>
            <Link
              href="/admin/properties/new"
              className="mt-4 inline-block text-secondary hover:underline text-sm"
            >
              Add your first property
            </Link>
          </div>
        ) : (
          <div className="bg-surface-highest/40 backdrop-blur-xl rounded-2xl overflow-hidden divide-y divide-outline-variant">
            {typedProperties.map((property) => {
              const roomCount = roomCountByProperty[property.id] ?? 0
              return (
                <div key={property.id} className="flex items-center gap-4 px-6 py-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-on-surface">{property.name}</p>
                    <p className="text-sm text-on-surface-variant/60 mt-0.5">
                      {property.address}, {property.city}, {property.state}
                    </p>
                    <p className="text-xs text-on-surface-variant/50 mt-0.5">
                      {property.bedrooms}bd / {property.bathrooms}ba &middot;{' '}
                      {roomCount} room{roomCount !== 1 ? 's' : ''} &middot;{' '}
                      {property.images.length} image{property.images.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <Link
                      href={`/admin/properties/${property.id}/edit`}
                      className="flex items-center gap-1.5 text-sm bg-surface-container rounded-xl px-3 py-1.5 text-on-surface-variant hover:bg-surface-high transition-colors"
                    >
                      <PencilSquareIcon className="w-4 h-4" />
                      Edit
                    </Link>
                    <DeletePropertyButton
                      propertyId={property.id}
                      hasRooms={roomCount > 0}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
