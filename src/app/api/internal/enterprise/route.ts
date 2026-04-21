import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isInternalAuthorized } from "@/lib/internal-auth";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

/** GET /api/internal/enterprise — list waitlist + activated enterprise users */
export async function GET(req: NextRequest) {
  if (!isInternalAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [waitlist, users] = await Promise.all([
    prisma.enterpriseWaitlist.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.user.findMany({
      where: { isEnterprise: true },
      select: { id: true, name: true, email: true, companyName: true, enterpriseActivatedAt: true, createdAt: true },
      orderBy: { enterpriseActivatedAt: "desc" },
    }),
  ]);

  return NextResponse.json({ waitlist, users });
}

/** POST /api/internal/enterprise/activate — activate enterprise for a user by email */
export async function POST(req: NextRequest) {
  if (!isInternalAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { email, waitlistId } = await req.json();
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

  let user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    return NextResponse.json({ error: "No account found for this email. Ask them to register first." }, { status: 404 });
  }

  user = await prisma.user.update({
    where: { email },
    data: { isEnterprise: true, enterpriseActivatedAt: new Date() },
  });

  // Send activation email
  if (process.env.RESEND_API_KEY) {
    const BASE = process.env.NEXTAUTH_URL ?? "https://cascrow.com";
    await resend.emails.send({
      from: process.env.EMAIL_FROM ?? "cascrow <noreply@cascrow.com>",
      to: email,
      subject: "Your cascrow Enterprise access is ready",
      html: `
        <!DOCTYPE html>
        <html>
        <body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
          <div style="max-width:560px;margin:48px auto;background:white;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden">
            <div style="background:#1d4ed8;padding:32px 40px">
              <div style="color:white;font-size:20px;font-weight:700;letter-spacing:-0.02em">cascrow Enterprise</div>
            </div>
            <div style="padding:40px">
              <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;letter-spacing:-0.02em">
                Your access is active
              </h1>
              <p style="margin:0 0 28px;color:#64748b;font-size:15px;line-height:1.6">
                Welcome to cascrow Enterprise. Your account has been activated for AI-powered KPI attestation and on-chain compliance reporting.
              </p>
              <a
                href="${BASE}/enterprise/dashboard"
                style="display:inline-block;background:#1d4ed8;color:white;padding:13px 28px;border-radius:8px;font-weight:600;font-size:15px;text-decoration:none;letter-spacing:-0.01em"
              >
                Open your dashboard →
              </a>
              <div style="margin-top:36px;padding-top:28px;border-top:1px solid #e2e8f0">
                <p style="margin:0;color:#94a3b8;font-size:13px;line-height:1.6">
                  Questions? Reply to this email or reach us at <a href="mailto:enterprise@cascrow.com" style="color:#1d4ed8">enterprise@cascrow.com</a>.
                </p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
    }).catch(() => {});
  }

  // Remove from waitlist if linked
  if (waitlistId) {
    await prisma.enterpriseWaitlist.delete({ where: { id: waitlistId } }).catch(() => {});
  }

  return NextResponse.json({ ok: true, userId: user.id });
}
