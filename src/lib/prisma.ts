import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import dns from "dns";

// IPv6 causes connection timeouts on this network — patch lookup to IPv4 only
const _origLookup = dns.lookup.bind(dns);
(dns as unknown as { lookup: typeof dns.lookup }).lookup = (
  hostname: string,
  optionsOrCb: Parameters<typeof dns.lookup>[1],
  cb?: Parameters<typeof dns.lookup>[2]
) => {
  if (typeof optionsOrCb === "function") {
    _origLookup(hostname, { family: 4 }, optionsOrCb);
  } else {
    const opts = typeof optionsOrCb === "object" ? optionsOrCb : {};
    _origLookup(hostname, { ...opts, family: 4 }, cb!);
  }
};

neonConfig.poolQueryViaFetch = true;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const adapter = new PrismaNeon(process.env.DATABASE_URL!);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
