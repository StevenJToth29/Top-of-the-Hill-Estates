export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createServiceRoleClient, createServerSupabaseClient } from '@/lib/supabase'
import { TaskAutomationsPage } from '@/components/admin/TaskAutomationsPage'
import type { TaskAutomation, Person, Room, Property } from '@/types'

export default async function AdminTaskAutomationsPage() {
  const serverClient = await createServerSupabaseClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) redirect('/admin/login')

  const supabase = createServiceRoleClient()
  const [automationsRes, peopleRes, roomsRes, propertiesRes] = await Promise.all([
    supabase
      .from('task_automations')
      .select('*, room:rooms(name), property:properties(name), assignee:people(id,name)')
      .order('scope_type').order('created_at'),
    supabase.from('people').select('*').order('name'),
    supabase.from('rooms').select('*, property:properties(id,name)').order('name'),
    supabase.from('properties').select('id, name').order('name'),
  ])

  return (
    <div>
      <h1 className="font-display text-3xl text-primary mb-8">Task Automations</h1>
      <TaskAutomationsPage
        initialAutomations={(automationsRes.data ?? []) as TaskAutomation[]}
        people={(peopleRes.data ?? []) as Person[]}
        rooms={(roomsRes.data ?? []) as Room[]}
        properties={(propertiesRes.data ?? []) as Property[]}
      />
    </div>
  )
}
