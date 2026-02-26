/** @type {import('next').NextConfig} */
const LOCAL_BFF_URL = 'http://localhost:4000';

function normalizeUrl(value) {
  if (!value) {
    return '';
  }

  const trimmed = value.trim();
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

const BFF_URL = normalizeUrl(process.env.BFF_URL ?? process.env.NEXT_PUBLIC_BFF_URL ?? LOCAL_BFF_URL);

if (process.env.VERCEL === '1' && BFF_URL === LOCAL_BFF_URL) {
  throw new Error(
    'Falta configurar BFF_URL (o NEXT_PUBLIC_BFF_URL) en Vercel. No se puede usar localhost en deploy.',
  );
}

const nextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${BFF_URL}/api/:path*`,
      },
      {
        source: '/socket.io/:path*',
        destination: `${BFF_URL}/socket.io/:path*`,
      },
    ];
  },
};

export default nextConfig;
