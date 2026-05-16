/** @type {import('next').NextConfig} */
const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

const nextConfig = {
  reactStrictMode: true,
  experimental: {
    proxyClientMaxBodySize: "12mb",
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "**.run.app" },
    ],
  },
  async rewrites() {
    if (!backendUrl) return [];
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
