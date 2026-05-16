/** @type {import('next').NextConfig} */
const nextConfig = {
  // Hackathon: do not fail Vercel production builds on ESLint / TS diagnostics
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Hide floating Next.js Dev Tools badge in dev (still shows on errors)
  devIndicators: false,
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "**.run.app" },
    ],
  },
};

export default nextConfig;
