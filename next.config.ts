import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // pdf-parse and xrpl use Node.js APIs — keep them server-side only.
  // Turbopack (default in Next.js 16) respects this without a webpack shim.
  serverExternalPackages: ["pdf-parse", "xrpl", "pg"],
  typescript: {
    ignoreBuildErrors: true,
  },
  async headers() {
    const csp = [
      "default-src 'self'",
      // Next.js requires unsafe-inline for its hydration scripts; unsafe-eval for some dynamic imports
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' challenges.cloudflare.com",
      "style-src 'self' 'unsafe-inline'",
      // Vercel Blob for uploaded PDFs + cert images; data:/blob: for local previews
      "img-src 'self' data: blob: https://*.vercel-storage.com",
      // XRPL EVM RPC (HTTPS + WebSocket for ethers.js), native XRPL JSON-RPC, Turnstile, Sentry, PostHog
      "connect-src 'self' challenges.cloudflare.com https://rpc.testnet.xrplevm.org wss://rpc.testnet.xrplevm.org https://s1.ripple.com https://s2.ripple.com https://*.ingest.sentry.io https://*.ingest.de.sentry.io https://eu.i.posthog.com https://eu-assets.i.posthog.com",
      // Turnstile widget loads in an iframe
      "frame-src challenges.cloudflare.com",
      "font-src 'self' data:",
      // Web Workers (Three.js / postprocessing may spawn workers)
      "worker-src 'self' blob:",
      // Prevent <base href> injection
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      // Belt-and-suspenders alongside X-Frame-Options: DENY
      "frame-ancestors 'none'",
    ].join("; ");

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://eu-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/array/:path*",
        destination: "https://eu-assets.i.posthog.com/array/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://eu.i.posthog.com/:path*",
      },
    ];
  },
  // Required to support PostHog trailing slash API requests
  skipTrailingSlashRedirect: true,
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

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Only upload source maps when SENTRY_AUTH_TOKEN is set (i.e. in CI/production builds)
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  // Disable source map upload in local dev
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
});
