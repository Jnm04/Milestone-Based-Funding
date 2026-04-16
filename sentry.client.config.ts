import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Only send errors in production
  enabled: process.env.NODE_ENV === "production",
  // 10% of transactions captured for performance (free tier friendly)
  tracesSampleRate: 0.1,
  // Don't send PII (no user email/IP in Sentry)
  sendDefaultPii: false,
});
