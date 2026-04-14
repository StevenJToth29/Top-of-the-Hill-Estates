import { createServiceRoleClient } from '@/lib/supabase'
import Navbar from '@/components/public/Navbar'
import Footer from '@/components/public/Footer'

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const supabase = createServiceRoleClient()
  const { data: settings } = await supabase.from('site_settings').select('logo_url').single()
  const logoUrl = settings?.logo_url ?? undefined

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar logoUrl={logoUrl} />
      <main className="flex-1">{children}</main>
      <Footer logoUrl={logoUrl} />
    </div>
  )
}
