import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse and xrpl use Node.js APIs — keep them server-side only.
  // Turbopack (default in Next.js 16) respects this without a webpack shim.
  serverExternalPackages: ["pdf-parse", "xrpl", "pg"],
  typescript: {
    ignoreBuildErrors: true,
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
