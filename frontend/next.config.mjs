import { assertNextEnvironment } from './environment-guard.mjs';

// A dev server with production settings (or the reverse) must never boot.
assertNextEnvironment();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
  async rewrites() {
    // In production Traefik routes /api directly to FastAPI, without a second proxy.
    if (process.env.NODE_ENV === 'production') return [];
    const backendUrl = process.env.BACKEND_URL || 'http://127.0.0.1:8000';
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
