export const dynamic = 'force-dynamic'

import { createServiceRoleClient } from '@/lib/supabase'
import Navbar from '@/components/public/Navbar'
import Footer from '@/components/public/Footer'

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const supabase = createServiceRoleClient()
  const { data: settings, error: settingsError } = await supabase
    .from('site_settings')
    .select('*')
    .limit(1)
    .maybeSingle()

  if (settingsError) {
    console.error('[PublicLayout] Failed to load site settings:', settingsError.message)
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar logoUrl={settings?.logo_url ?? undefined} logoSize={settings?.logo_size ?? 52} />
      <main className="flex-1">{children}</main>
      <Footer
        logoUrl={settings?.logo_url ?? undefined}
        logoSize={settings?.logo_size ?? 52}
        phone={settings?.contact_phone ?? undefined}
        email={settings?.contact_email ?? undefined}
        address={settings?.contact_address ?? undefined}
      />
    </div>
  )
}
