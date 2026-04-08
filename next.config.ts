import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse and xrpl use Node.js APIs — keep them server-side only.
  // Turbopack (default in Next.js 16) respects this without a webpack shim.
  serverExternalPackages: ["pdf-parse", "xrpl", "pg"],
  // react-force-graph and its deps ship as ESM — Next.js must transpile them.
  transpilePackages: ["react-force-graph", "force-graph", "d3-force", "d3-zoom", "d3-drag", "d3-scale", "d3-interpolate", "d3-color", "d3-selection"],
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
