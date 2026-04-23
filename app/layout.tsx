import type { Metadata } from 'next'
import { Manrope, Plus_Jakarta_Sans } from 'next/font/google'
import { unstable_cache } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import Script from 'next/script'
import { PostHogProvider } from '@/components/PostHogProvider'
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

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://topofthehillrooms.com'
const SITE_NAME = 'Top of the Hill Rooms'
const SITE_DESCRIPTION =
  'Short-term and long-term room rentals in Mesa/Tempe, Arizona. Book directly — no platform fees.'

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getFaviconSettings()

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: SITE_NAME,
      template: `%s | ${SITE_NAME}`,
    },
    description: SITE_DESCRIPTION,
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      title: SITE_NAME,
      description: SITE_DESCRIPTION,
      url: SITE_URL,
      images: [{ url: '/logo.png', width: 1200, height: 630, alt: SITE_NAME }],
    },
    twitter: {
      card: 'summary_large_image',
      title: SITE_NAME,
      description: SITE_DESCRIPTION,
      images: ['/logo.png'],
    },
    icons: {
      icon: settings?.favicon_url ?? '/favicon.ico',
      apple: settings?.favicon_apple_url ?? '/favicon.ico',
      other: settings?.favicon_large_url
        ? [{ rel: 'icon', url: settings.favicon_large_url, sizes: '192x192', type: 'image/png' }]
        : [],
    },
  }
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'LodgingBusiness',
  name: 'Top of the Hill Rooms',
  description: 'Short-term and long-term furnished room rentals in Mesa and Tempe, Arizona.',
  url: 'https://topofthehillrooms.com',
  telephone: '',
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Mesa',
    addressRegion: 'AZ',
    addressCountry: 'US',
  },
  geo: {
    '@type': 'GeoCoordinates',
    latitude: 33.4152,
    longitude: -111.8315,
  },
  priceRange: '$$',
  amenityFeature: [
    { '@type': 'LocationFeatureSpecification', name: 'Furnished rooms', value: true },
    { '@type': 'LocationFeatureSpecification', name: 'Short-term rentals', value: true },
    { '@type': 'LocationFeatureSpecification', name: 'Long-term rentals', value: true },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${manrope.variable} ${plusJakartaSans.variable}`}>
      <body className="font-body bg-background text-on-surface antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <PostHogProvider>
          {children}
          <Analytics />
          <SpeedInsights />
        </PostHogProvider>
        {process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID}');
          `}
            </Script>
          </>
        )}
      </body>
    </html>
  )
}
