/** @type {import('next').NextConfig} */
const BACKEND_URL = 'http://105.74.66.113:8000';

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
