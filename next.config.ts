import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse and xrpl use Node.js APIs — keep them server-side only.
  // Turbopack (default in Next.js 16) respects this without a webpack shim.
  serverExternalPackages: ["pdf-parse", "xrpl", "pg"],
  typescript: {
    ignoreBuildErrors: true,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "cascrow.xyz" }],
        destination: "https://cascrow.com/:path*",
        permanent: true, // 301 redirect — Google passes full SEO value to cascrow.com
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.cascrow.xyz" }],
        destination: "https://cascrow.com/:path*",
        permanent: true,
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.cascrow.com" }],
        destination: "https://cascrow.com/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
