import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { ethers } from "ethers";
import { z } from "zod";
import { getEVMProvider, getPlatformSigner } from "@/services/evm/client";
import { toRLUSDUnits } from "@/lib/evm-abi";

const RLUSD_CONTRACT = process.env.NEXT_PUBLIC_RLUSD_CONTRACT_ADDRESS!;
const TRANSFER_ABI = ["function transfer(address to, uint256 amount) external returns (bool)"];
// How much testnet RLUSD to send each new agent wallet (default 500)
const TESTNET_RLUSD = process.env.AGENT_TESTNET_RLUSD ?? "500";

const schema = z.object({
  email: z.string().email("Invalid email").max(254),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
  name: z.string().max(200).optional(),
  keyName: z.string().max(80).optional().default("default"),
  // Optional: agent provides its own wallet to opt out of auto-creation
  walletAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/, "Invalid EVM wallet address").optional(),
});

// POST /api/agent/register
// Programmatic agent registration — no email verification, no Turnstile.
// Returns an API key immediately so agents can start calling Cascrow without a human in the loop.
// If no walletAddress is provided, a fresh EVM wallet is created and funded with testnet RLUSD.
// Rate-limited strictly: 3 registrations per IP per hour.
export async function POST(request: NextRequest) {
  const ip = getClientIp(request) ?? "unknown";
  if (!(await checkRateLimit(`agent-register:${ip}`, 3, 60 * 60 * 1000))) {
    return NextResponse.json(
      { error: "Too many registrations from this IP. Try again in 1 hour." },
      { status: 429, headers: { "Retry-After": "3600" } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { email, password, name, keyName, walletAddress: providedWallet } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  // Auto-create EVM wallet if agent didn't bring their own.
  // Disabled until AGENT_AUTO_WALLET_ENABLED=true is set in env.
  let generatedWallet: { address: string; privateKey: string } | null = null;
  const resolvedWalletAddress = providedWallet ?? null;

  if (!providedWallet && process.env.AGENT_AUTO_WALLET_ENABLED === "true") {
    const wallet = ethers.Wallet.createRandom(getEVMProvider());
    generatedWallet = { address: wallet.address, privateKey: wallet.privateKey };

    // Fund with testnet RLUSD from platform wallet — best-effort, non-fatal
    try {
      const signer = getPlatformSigner();
      const rlusd = new ethers.Contract(RLUSD_CONTRACT, TRANSFER_ABI, signer);
      const amount = toRLUSDUnits(TESTNET_RLUSD);
      const tx = await (rlusd.transfer as (to: string, amount: bigint) => Promise<ethers.TransactionResponse>)(
        wallet.address,
        amount
      );
      await tx.wait();
      console.log(`[agent-register] Funded ${wallet.address} with ${TESTNET_RLUSD} testnet RLUSD`);
    } catch (err) {
      console.warn("[agent-register] RLUSD auto-fund failed (non-fatal):", err instanceof Error ? err.message : err);
    }
  }

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: name ?? null,
      role: "INVESTOR",
      emailVerified: true,
      kycTier: 0,
      walletAddress: (generatedWallet?.address ?? resolvedWalletAddress ?? "").toLowerCase() || null,
    },
  });

  const rawKey = "csk_" + crypto.randomBytes(32).toString("hex");
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
  const keyPrefix = rawKey.slice(0, 12);

  await prisma.apiKey.create({
    data: {
      userId: user.id,
      name: keyName ?? "default",
      keyHash,
      keyPrefix,
    },
  });

  const response: Record<string, unknown> = {
    userId: user.id,
    email: user.email,
    apiKey: rawKey,
    message: "Agent registered. Save your API key — it will not be shown again.",
  };

  if (generatedWallet) {
    response.wallet = {
      address: generatedWallet.address,
      privateKey: generatedWallet.privateKey,
      testnetRlusd: TESTNET_RLUSD,
      note: "Save your private key — it will not be shown again.",
    };
  }

  return NextResponse.json(response, { status: 201 });
}
