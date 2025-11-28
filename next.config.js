/** @type {import('next').NextConfig} */
// Build cache cleared: 2025-11-14T07:50:00Z
// Updated for Next.js 15 compatibility

// Force NODE_ENV to production during build if not set properly
if (!process.env.NODE_ENV || !['development', 'production', 'test'].includes(process.env.NODE_ENV)) {
  process.env.NODE_ENV = 'production';
}

const nextConfig = {
  // Force new build ID every time to invalidate Docker cache
  generateBuildId: async () => {
    return `cache-bust-${Date.now()}`
  },
  reactStrictMode: true,
  images: {
    // Updated from domains to remotePatterns for Next.js 16
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.clerk.dev',
      },
      {
        protocol: 'https',
        hostname: 'img.clerk.com',
      },
    ],
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Use standalone output for Docker deployment
  output: 'standalone',

  // Moved from experimental in Next.js 16
  outputFileTracingExcludes: {
    '*': [
      'node_modules/@swc/**',
      'node_modules/@mapbox/**',
      'node_modules/aws-sdk/**',
      'node_modules/nock/**',
      'node_modules/mock-aws-s3/**'
    ],
  },

  // Configure environment variables for build time only
  env: {
    // Only use mock during build, respect runtime environment variable
    NEXT_BUILD_SKIP_DB: process.env.NEXT_BUILD_SKIP_DB || 'true',
    // Set a dummy database URL for build if no real one is provided
    DATABASE_URL: process.env.DATABASE_URL || 'postgresql://placeholder:placeholder@localhost:5432/placeholder',
    // Make NEXT_PUBLIC_* variables available at build time from runtime environment
    // This allows Dokploy to set them as environment variables (not build args)
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },

  poweredByHeader: false,
  skipTrailingSlashRedirect: true,
  productionBrowserSourceMaps: false,

  // Server packages that should not be bundled
  serverExternalPackages: ['bcrypt'],

  // Simplified webpack configuration (for when using --webpack flag)
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Don't resolve Node.js modules on the client to prevent errors
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        path: false,
        os: false,
        stream: false,
        http: false,
        https: false,
        zlib: false,
        child_process: false,
        dns: false,
        async_hooks: false,
        bcrypt: false,
        'mock-aws-s3': false,
        'aws-sdk': false,
        nock: false
      };
    }

    return config;
  },
};

module.exports = nextConfig;
