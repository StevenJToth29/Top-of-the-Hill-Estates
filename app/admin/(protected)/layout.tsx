import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import AdminSidebar from '@/components/admin/AdminSidebar'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createServerSupabaseClient()
  // getUser() validates the JWT with Supabase servers — getSession() does not
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/admin/login')
  }

  const serviceClient = createServiceRoleClient()
  const { data: settings } = await serviceClient.from('site_settings').select('logo_url').single()
  const logoUrl = settings?.logo_url ?? undefined

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar logoUrl={logoUrl} />
      <main className="flex-1 p-8">{children}</main>
    </div>
  )
}
