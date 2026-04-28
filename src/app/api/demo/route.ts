import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { nanoid } from "nanoid";
import bcrypt from "bcryptjs";

// Fixed demo identities — these never change so the contract URL stays stable
const DEMO_INVESTOR_EMAIL  = "demo-investor@cascrow.demo";
const DEMO_STARTUP_EMAIL   = "demo-startup@cascrow.demo";
// Deterministic fake EVM address — used only as a viewer-identity key, no real funds
const DEMO_INVESTOR_WALLET = "0xDem0Investor000000000000000000000000000";
const DEMO_STARTUP_WALLET  = "0xDem0Startup0000000000000000000000000000";
const DEMO_PASSWORD        = "DemoCascrow2026!";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!(await checkRateLimit(`demo:${ip}`, 3, 60 * 60 * 1000))) {
    return NextResponse.json({ error: "Too many demo requests — try again in an hour." }, { status: 429 });
  }

  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const [investor, startup] = await Promise.all([
    prisma.user.upsert({
      where: { email: DEMO_INVESTOR_EMAIL },
      update: {},
      create: {
        email: DEMO_INVESTOR_EMAIL,
        passwordHash: hash,
        walletAddress: DEMO_INVESTOR_WALLET,
        role: "INVESTOR",
        emailVerified: true,
        name: "Demo Investor",
      },
    }),
    prisma.user.upsert({
      where: { email: DEMO_STARTUP_EMAIL },
      update: {},
      create: {
        email: DEMO_STARTUP_EMAIL,
        passwordHash: hash,
        walletAddress: DEMO_STARTUP_WALLET,
        role: "STARTUP",
        emailVerified: true,
        name: "Demo Startup",
        companyName: "Acme AI Labs",
      },
    }),
  ]);

  const deadline = new Date();
  deadline.setDate(deadline.getDate() + 60);

  const contract = await prisma.contract.create({
    data: {
      investorId: investor.id,
      startupId:  startup.id,
      milestone:  "Build and ship a public MVP with ≥100 beta signups and 3 integration partners",
      amountUSD:  25000,
      cancelAfter: deadline,
      status: "AWAITING_ESCROW",
      isDemo: true,
      inviteLink: nanoid(32),
      milestones: {
        create: [
          {
            title:      "MVP shipped — public beta with ≥100 signups",
            amountUSD:  15000,
            cancelAfter: deadline,
            status:     "AWAITING_ESCROW",
            order:      0,
          },
          {
            title:      "3 integration partners signed (LOI or live)",
            amountUSD:  10000,
            cancelAfter: new Date(deadline.getTime() + 30 * 86_400_000),
            status:     "PENDING",
            order:      1,
          },
        ],
      },
    },
  });

  const url = `/contract/${contract.id}?investor=${DEMO_INVESTOR_WALLET}`;
  return NextResponse.json({ url });
}
