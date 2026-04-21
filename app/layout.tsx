import type { Metadata } from 'next'
import { Manrope, Plus_Jakarta_Sans } from 'next/font/google'
import { unstable_cache } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase'
import './globals.css'

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
  display: 'swap',
})

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
})

const getFaviconSettings = unstable_cache(
  async () => {
    const supabase = createServiceRoleClient()
    const { data } = await supabase
      .from('site_settings')
      .select('favicon_url, favicon_large_url, favicon_apple_url')
      .single()
    return data
  },
  ['site_settings_favicon'],
  { revalidate: 3600, tags: ['site_settings'] },
)

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getFaviconSettings()

  return {
    title: 'Top of the Hill Rooms',
    description:
      'Short-term and long-term room rentals in Mesa/Tempe, Arizona. Book directly with Top of the Hill Rooms.',
    icons: {
      icon: settings?.favicon_url ?? '/favicon.ico',
      apple: settings?.favicon_apple_url ?? '/favicon.ico',
      other: settings?.favicon_large_url
        ? [{ rel: 'icon', url: settings.favicon_large_url, sizes: '192x192', type: 'image/png' }]
        : [],
    },
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${manrope.variable} ${plusJakartaSans.variable}`}>
      <body className="font-body bg-background text-on-surface antialiased">
        {children}
      </body>
    </html>
  )
}
