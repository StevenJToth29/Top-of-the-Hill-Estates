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
  const { data: settings } = await serviceClient
    .from('site_settings')
    .select('*')
    .limit(1)
    .maybeSingle()
  const logoUrl = settings?.logo_url ?? undefined
  const logoSize = settings?.logo_size ?? 52

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AdminSidebar logoUrl={logoUrl} logoSize={logoSize} />
      <main className="flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  )
}
