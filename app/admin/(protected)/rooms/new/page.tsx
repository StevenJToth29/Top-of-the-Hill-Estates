export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServiceRoleClient, createServerSupabaseClient } from '@/lib/supabase'
import RoomForm from '@/components/admin/RoomForm'
import type { Property } from '@/types'

export default async function NewRoomPage() {
  const serverClient = await createServerSupabaseClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) redirect('/admin/login')

  const supabase = createServiceRoleClient()
  const { data: properties } = await supabase.from('properties').select('*').order('name')

  const typedProperties = (properties ?? []) as Property[]

  if (typedProperties.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="bg-surface-highest/40 backdrop-blur-xl rounded-2xl p-10 text-center space-y-4 max-w-md">
          <p className="text-on-surface font-medium font-display text-lg">No properties found</p>
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
      </div>
    )
  }

  return (
    <div className="-m-8 bg-background">
      <RoomForm properties={typedProperties} />
    </div>
  )
}
