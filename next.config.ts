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
      // XRPL EVM RPC, native XRPL JSON-RPC, Turnstile verification, Sentry
      "connect-src 'self' challenges.cloudflare.com https://rpc.testnet.xrplevm.org https://s1.ripple.com https://s2.ripple.com https://*.ingest.sentry.io https://*.ingest.de.sentry.io",
      // Turnstile widget loads in an iframe
      "frame-src challenges.cloudflare.com",
      "font-src 'self' data:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ");

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
          { key: "Content-Security-Policy", value: csp },
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

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Only upload source maps when SENTRY_AUTH_TOKEN is set (i.e. in CI/production builds)
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  // Disable source map upload in local dev
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
});
