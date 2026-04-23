import Script from 'next/script'
import Navbar from '@/components/public/Navbar'
import Footer from '@/components/public/Footer'
import { getSiteSettings } from '@/lib/site-settings'

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSiteSettings()

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
      <Script
        src="https://widgets.leadconnectorhq.com/loader.js"
        data-resources-url="https://widgets.leadconnectorhq.com/chat-widget/loader.js"
        data-widget-id="69c47f3613ad148094a417bf"
        strategy="lazyOnload"
      />
    </div>
  )
}
