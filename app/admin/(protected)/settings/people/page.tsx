export const dynamic = 'force-dynamic'

import { createServiceRoleClient } from '@/lib/supabase'
import PeopleClient from '@/components/admin/PeopleClient'
import type { Person } from '@/types'

export default async function SettingsPeoplePage() {
  const supabase = createServiceRoleClient()
  const { data: people } = await supabase.from('people').select('*').order('name')

  return <PeopleClient initialPeople={(people ?? []) as Person[]} />
}
