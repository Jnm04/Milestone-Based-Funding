import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse and xrpl use Node.js APIs — keep them server-side only.
  // Turbopack (default in Next.js 16) respects this without a webpack shim.
  serverExternalPackages: ["pdf-parse", "xrpl", "pg"],
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
