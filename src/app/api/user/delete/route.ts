import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/user/delete
 *
 * GDPR account deletion (soft anonymization).
 * Preserves contract records for the other party's audit trail but anonymizes all
 * personal data from the requesting user's record.
 *
 * Body: { confirmEmail: string }
 *
 * Actions:
 * - Nullify: name, phone, bio, website, companyName, department, jobTitle, walletAddress
 * - Anonymize: email → "deleted-{id}@cascrow.xyz"
 * - Clear: passwordHash, emailVerificationToken, passwordResetToken
 * - Cancel: any DRAFT or AWAITING_ESCROW contracts where no escrow is locked yet
 * - Does NOT touch: contracts with active escrow (other party's funds are involved)
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  let body: { confirmEmail?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON", code: "VALIDATION_ERROR" }, { status: 400 });
  }

  if (!body.confirmEmail) {
    return NextResponse.json(
      { error: "confirmEmail is required", code: "VALIDATION_ERROR" },
      { status: 400 }
    );
  }

  // User must confirm by typing their own email address
  if (body.confirmEmail.toLowerCase() !== session.user.email?.toLowerCase()) {
    return NextResponse.json(
      { error: "Email confirmation does not match your account", code: "EMAIL_MISMATCH" },
      { status: 400 }
    );
  }

  const userId = session.user.id;

  // Cancel DRAFT and AWAITING_ESCROW contracts (no funds locked yet)
  await prisma.contract.updateMany({
    where: {
      OR: [{ investorId: userId }, { startupId: userId }],
      status: { in: ["DRAFT", "AWAITING_ESCROW"] },
    },
    data: { status: "DECLINED" },
  });

  // Anonymize the user record — preserve the row so contract FKs don't break
  const anonymizedEmail = `deleted-${userId}@cascrow.xyz`;
  await prisma.$transaction([
    // Disconnect telegram chat if present
    prisma.telegramChat.deleteMany({ where: { userId } }),
    // Anonymize the user record — preserve the row so contract FKs don't break
    prisma.user.update({
      where: { id: userId },
      data: {
        email: anonymizedEmail,
        name: null,
        phone: null,
        bio: null,
        website: null,
        companyName: null,
        department: null,
        jobTitle: null,
        walletAddress: null,
        passwordHash: "",
        emailVerified: false,
        emailVerificationToken: null,
        emailVerificationTokenExpiry: null,
        passwordResetToken: null,
        passwordResetTokenExpiry: null,
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
