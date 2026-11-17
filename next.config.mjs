/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    // The on-disk Turbopack dev cache got corrupted on this Windows setup (stale
    // package paths after switching from pnpm to npm, and after interrupted dev
    // runs), causing endless page reloads and false 404s. Compile fresh each run.
    turbopackFileSystemCacheForDev: false,
    serverActions: {
      // Claim documents and CSV imports are uploaded through server actions.
      // Vercel caps request bodies at 4.5 MB.
      bodySizeLimit: '4mb',
    },
  },
}

export default nextConfig
