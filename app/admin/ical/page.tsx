import { createServiceRoleClient } from '@/lib/supabase'
import ICalSyncPanel from '@/components/admin/ICalSyncPanel'
import SyncAllButton from '@/components/admin/SyncAllButton'
import type { Room, Property, ICalSource } from '@/types'

type RoomWithRelations = Room & { property: Property; ical_sources: ICalSource[] }

export default async function ICalAdminPage() {
  const supabase = createServiceRoleClient()

  const { data: rooms } = await supabase
    .from('rooms')
    .select(`
      id, name, slug, ical_export_token,
      property:properties(name, id, address, city, state, description, created_at),
      ical_sources(*)
    `)
    .eq('is_active', true)
    .order('name')

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ''

  return (
    <div className="min-h-screen bg-background p-6 md:p-10">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="font-display text-3xl text-primary">iCal Sync</h1>
          <SyncAllButton />
        </div>

        <div className="space-y-4">
          {rooms && rooms.length > 0 ? (
            (rooms as unknown as RoomWithRelations[]).map((room) => (
              <div
                key={room.id}
                className="bg-surface-highest/40 backdrop-blur-xl rounded-2xl shadow-[0_8px_40px_rgba(175,201,234,0.06)] p-6"
              >
                <div className="mb-4">
                  <p className="font-bold text-on-surface text-lg leading-snug">{room.name}</p>
                  {room.property && (
                    <p className="text-sm text-on-surface-variant mt-0.5">{room.property.name}</p>
                  )}
                </div>
                <ICalSyncPanel room={room} siteUrl={siteUrl} />
              </div>
            ))
          ) : (
            <p className="text-on-surface-variant text-sm">No active rooms found.</p>
          )}
        </div>
      </div>
    </div>
  )
}
