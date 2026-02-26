/** @type {import('next').NextConfig} */
function normalizeUrl(value) {
  if (!value) {
    return '';
  }

  const trimmed = value.trim();
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

const BFF_URL = normalizeUrl(process.env.BFF_URL ?? process.env.NEXT_PUBLIC_BFF_URL);

const nextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  async rewrites() {
    if (!BFF_URL) {
      return [];
    }

    return {
      beforeFiles: [
        {
          source: '/api/:path*',
          destination: `${BFF_URL}/api/:path*`,
        },
        {
          source: '/socket.io/:path*',
          destination: `${BFF_URL}/socket.io/:path*`,
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
