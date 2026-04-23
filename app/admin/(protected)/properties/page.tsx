export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { PlusIcon } from '@heroicons/react/24/outline'
import { createServiceRoleClient } from '@/lib/supabase'
import type { Property, Room } from '@/types'
import DeletePropertyButton from '@/components/admin/DeletePropertyButton'
import PropertiesSearchFilter from '@/components/admin/PropertiesSearchFilter'
import PropertyUnitsModal from '@/components/admin/PropertyUnitsModal'

export default async function AdminPropertiesPage({
  searchParams,
}: {
  searchParams: { q?: string; filter?: string; sort?: string }
}) {
  const supabase = createServiceRoleClient()

  const [{ data: properties, error: propError }, { data: rooms }] = await Promise.all([
    supabase.from('properties').select('*').order('name'),
    supabase.from('rooms').select('id, property_id, name, nightly_rate, is_active').order('name'),
  ])

  if (propError) {
    throw new Error(`Failed to load properties: ${propError.message}`)
  }

  const allProperties = (properties ?? []).map((p) => ({
    ...p,
    images: p.images ?? [],
    amenities: p.amenities ?? [],
    bedrooms: p.bedrooms ?? 0,
    bathrooms: p.bathrooms ?? 0,
  })) as Property[]

  const typedRooms = (rooms ?? []) as Pick<Room, 'id' | 'property_id' | 'name' | 'nightly_rate' | 'is_active'>[]

  const roomsByProperty = typedRooms.reduce<
    Record<string, Pick<Room, 'id' | 'property_id' | 'name' | 'nightly_rate' | 'is_active'>[]>
  >((acc, r) => {
    if (!acc[r.property_id]) acc[r.property_id] = []
    acc[r.property_id].push(r)
    return acc
  }, {})

  const q = (searchParams.q ?? '').toLowerCase().trim()
  const filter = searchParams.filter ?? 'all'
  const sort = searchParams.sort ?? 'name_asc'

  const typedProperties = allProperties
    .filter((p) => {
      if (q && !`${p.name} ${p.city} ${p.state}`.toLowerCase().includes(q)) return false
      const unitCount = (roomsByProperty[p.id] ?? []).length
      if (filter === 'has_units' && unitCount === 0) return false
      if (filter === 'no_units' && unitCount > 0) return false
      return true
    })
    .sort((a, b) => {
      if (sort === 'name_desc') return b.name.localeCompare(a.name)
      if (sort === 'units_desc') return (roomsByProperty[b.id]?.length ?? 0) - (roomsByProperty[a.id]?.length ?? 0)
      if (sort === 'units_asc') return (roomsByProperty[a.id]?.length ?? 0) - (roomsByProperty[b.id]?.length ?? 0)
      return a.name.localeCompare(b.name) // name_asc default
    })

  const isFiltered = q || filter !== 'all' || sort !== 'name_asc'

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-on-surface">Properties</h1>
          <p className="text-on-surface-variant mt-1">
            {isFiltered
              ? `${typedProperties.length} of ${allProperties.length} propert${allProperties.length === 1 ? 'y' : 'ies'}`
              : `${allProperties.length} propert${allProperties.length === 1 ? 'y' : 'ies'}`}
          </p>
        </div>
        <Link
          href="/admin/properties/new"
          className="flex items-center gap-2 bg-gradient-to-r from-primary to-secondary text-background font-semibold rounded-2xl px-5 py-2.5 hover:opacity-90 transition-opacity"
        >
          <PlusIcon className="w-4 h-4" />
          Add Property
        </Link>
      </div>

      <PropertiesSearchFilter />

      {typedProperties.length === 0 ? (
        <div className="bg-surface-highest/40 backdrop-blur-xl rounded-2xl p-12 text-center">
          {isFiltered ? (
            <p className="text-on-surface-variant">No properties match your search.</p>
          ) : (
            <>
              <p className="text-on-surface-variant">No properties yet.</p>
              <Link href="/admin/properties/new" className="mt-4 inline-block text-secondary hover:underline text-sm">
                Add your first property
              </Link>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {typedProperties.map((property) => {
            const propRooms = roomsByProperty[property.id] ?? []
            const activeRooms = propRooms.filter((r) => r.is_active).length
            const coverImage = property.images[0]?.url

            return (
              <div
                key={property.id}
                className="group rounded-2xl border border-outline-variant/20 bg-surface-highest/40 backdrop-blur-sm overflow-hidden hover:shadow-xl hover:shadow-black/5 hover:border-outline-variant/50 transition-all duration-300"
              >
                {/* Cover image — clicking opens edit */}
                <Link
                  href={`/admin/properties/${property.id}/edit`}
                  className="relative h-44 overflow-hidden block"
                >
                  {coverImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={coverImage}
                      alt={property.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary/20 via-secondary/10 to-transparent flex items-center justify-center">
                      <span className="text-6xl opacity-10 select-none">🏠</span>
                    </div>
                  )}

                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />

                  {/* Name + location over gradient */}
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <h2 className="font-display text-xl font-bold text-white leading-tight drop-shadow-sm">
                      {property.name}
                    </h2>
                    <p className="text-white/65 text-xs mt-0.5 tracking-wide">
                      {property.city}, {property.state}
                    </p>
                  </div>
                </Link>

                {/* Info section */}
                <div className="p-4">
                  {/* Compact stats row */}
                  <div className="flex items-center gap-2.5 text-xs text-on-surface-variant flex-wrap mb-3">
                    <span>
                      <span className="font-semibold text-on-surface">{propRooms.length}</span>{' '}
                      {propRooms.length === 1 ? 'unit' : 'units'}
                    </span>
                    {propRooms.length > 0 && (
                      <>
                        <span className="text-outline-variant/40">·</span>
                        <span className="text-green-500 font-semibold">{activeRooms} active</span>
                      </>
                    )}
                    {(property.bedrooms > 0 || property.bathrooms > 0) && (
                      <>
                        <span className="text-outline-variant/40">·</span>
                        <span>{property.bedrooms}bd / {property.bathrooms}ba</span>
                      </>
                    )}
                    {property.images.length > 1 && (
                      <>
                        <span className="text-outline-variant/40">·</span>
                        <span>{property.images.length} photos</span>
                      </>
                    )}
                  </div>

                  {/* Amenity chips */}
                  {property.amenities.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {property.amenities.slice(0, 4).map((a) => (
                        <span
                          key={a}
                          className="text-xs px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant/70 border border-outline-variant/20"
                        >
                          {a}
                        </span>
                      ))}
                      {property.amenities.length > 4 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-secondary/10 text-secondary border border-secondary/20">
                          +{property.amenities.length - 4}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Rooms + actions footer */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-3 border-t border-outline-variant/15">
                    {propRooms.slice(0, 4).map((r) => (
                      <Link
                        key={r.id}
                        href={`/admin/rooms/${r.id}/edit`}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-background/60 border border-outline-variant/20 hover:border-secondary/40 hover:bg-secondary/5 transition-colors"
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${r.is_active ? 'bg-green-400' : 'bg-on-surface-variant/30'}`}
                        />
                        <span className="text-xs font-medium text-on-surface">{r.name}</span>
                        <span className="text-xs text-on-surface-variant/50">${r.nightly_rate}</span>
                      </Link>
                    ))}
                    <PropertyUnitsModal
                      propertyName={property.name}
                      units={propRooms}
                      visibleCount={4}
                    />
                    <Link
                      href="/admin/rooms/new"
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-dashed border-secondary/30 text-xs font-medium text-secondary hover:bg-secondary/5 transition-colors"
                    >
                      + Add Unit
                    </Link>
                    <div className="ml-auto">
                      <DeletePropertyButton
                        propertyId={property.id}
                        propertyName={property.name}
                        hasRooms={propRooms.length > 0}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
