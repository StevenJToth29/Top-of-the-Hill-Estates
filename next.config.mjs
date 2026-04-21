/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['node-ical'],
    // Disable client-side router cache for dynamic routes so admin pages
    // (properties, rooms) always fetch fresh data on navigation.
    staleTimes: { dynamic: 0 },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  webpack(config) {
    // @vercel/flags-core dynamically imports this optional package at runtime;
    // stub it so webpack doesn't fail trying to bundle a non-existent module.
    config.resolve.alias['@vercel/flags-definitions'] = false
    return config
  },
}

export default nextConfig
