export const dynamic = 'force-dynamic'

import { createServiceRoleClient } from '@/lib/supabase'
import Navbar from '@/components/public/Navbar'
import Footer from '@/components/public/Footer'

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const supabase = createServiceRoleClient()
  const { data: settings } = await supabase
    .from('site_settings')
    .select('logo_url, contact_phone, contact_email, contact_address')
    .single()

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar logoUrl={settings?.logo_url ?? undefined} />
      <main className="flex-1">{children}</main>
      <Footer
        logoUrl={settings?.logo_url ?? undefined}
        phone={settings?.contact_phone ?? undefined}
        email={settings?.contact_email ?? undefined}
        address={settings?.contact_address ?? undefined}
      />
    </div>
  )
}
