export const dynamic = 'force-dynamic'

import { createServiceRoleClient } from '@/lib/supabase'
import GlobalAutomationsClient from '@/components/admin/GlobalAutomationsClient'
import type { TaskAutomation, Person } from '@/types'

export default async function SettingsAutomationsPage() {
  const supabase = createServiceRoleClient()
  const [automationsRes, peopleRes] = await Promise.all([
    supabase
      .from('task_automations')
      .select('*, assignee:people(id,name)')
      .eq('scope_type', 'global')
      .order('created_at'),
    supabase.from('people').select('*').order('name'),
  ])

  return (
    <GlobalAutomationsClient
      initialAutomations={(automationsRes.data ?? []) as TaskAutomation[]}
      people={(peopleRes.data ?? []) as Person[]}
    />
  )
}
