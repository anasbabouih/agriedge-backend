/** @type {import('next').NextConfig} */
const rawBackendUrl = process.env.BACKEND_INTERNAL_URL;

if (!rawBackendUrl && process.env.NODE_ENV === 'production') {
  console.warn(
    "\x1b[33m%s\x1b[0m",
    "WARNING: BACKEND_INTERNAL_URL environment variable is not defined! " +
    "Rewrites for /api/graphql and /media/* will default to http://localhost:8000. " +
    "Please add BACKEND_INTERNAL_URL in Vercel Project Settings."
  );
}

const BACKEND_URL = (rawBackendUrl || 'http://localhost:8000').replace(/\/+$/, '');

const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/export-leaves/',
        destination: `${BACKEND_URL}/api/export-leaves/`,
      },
      {
        source: '/api/graphql',
        destination: `${BACKEND_URL}/graphql/`,
      },
      {
        source: '/media/:path*',
        destination: `${BACKEND_URL}/media/:path*`,
      }
    ];
  },
};

export default nextConfig;
