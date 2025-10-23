import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'i.ytimg.com',
        port: '',
        pathname: '**', // Allows any path on this hostname
      },
    ],
  },
  async rewrites() {
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!convexUrl) {
      return [];
    }

    return [
      {
        source: "/api/auth/:path*",
        destination: `${convexUrl}/api/auth/:path*`,
      },
      {
        source: "/.well-known/:path*",
        destination: `${convexUrl}/.well-known/:path*`,
      },
    ];
  },
};

export default nextConfig;

