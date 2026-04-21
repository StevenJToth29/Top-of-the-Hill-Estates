import type { MetadataRoute } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://topofthehillrooms.com'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/api/', '/checkout', '/booking/confirmation', '/booking/manage'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
