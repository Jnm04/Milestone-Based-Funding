/**
 * Environment variable validation.
 * Imported once from the root layout — runs at server startup.
 * Throws for missing required vars, warns for missing optional vars.
 *
 * Only runs server-side (process.env is available).
 */

const REQUIRED: string[] = [
  "DATABASE_URL",
  "NEXTAUTH_SECRET",
  "NEXTAUTH_URL",
  "BLOB_READ_WRITE_TOKEN",
  "NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS",
  "NEXT_PUBLIC_RLUSD_CONTRACT_ADDRESS",
];

const WARN_IF_MISSING: string[] = [
  "ANTHROPIC_API_KEY",
  "OPENAI_API_KEY",
  "GEMINI_API_KEY",
  "MISTRAL_API_KEY",
  "CEREBRAS_API_KEY",
  "EVM_PLATFORM_PRIVATE_KEY",
  "XRPL_PLATFORM_SEED",
  "CRON_SECRET",
  "INTERNAL_API_SECRET",
];

// Only validate server-side (skip in browser bundles)
if (typeof window === "undefined") {
  const missing = REQUIRED.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `[env] Missing required environment variables: ${missing.join(", ")}\n` +
        "Add them to your .env.local or Vercel project settings before starting."
    );
  }

  const warned = WARN_IF_MISSING.filter((key) => !process.env[key]);
  if (warned.length > 0) {
    console.warn(
      `[env] Warning: The following optional env vars are not set — some features will be disabled: ${warned.join(", ")}`
    );
  }
}
