import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = "Cascrow <noreply@cascrow.com>";

export async function POST(request: NextRequest) {
  const ip = getClientIp(request) ?? "unknown";
  if (!(await checkRateLimit(`waitlist:${ip}`, 5, 60 * 60 * 1000))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let email: string | undefined;
  try {
    const body = await request.json();
    email = typeof body.email === "string" ? body.email.trim().toLowerCase() : undefined;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  try {
    await prisma.waitlistEntry.create({ data: { email } });
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "P2002") {
      return NextResponse.json({ alreadyRegistered: true });
    }
    console.error("Waitlist error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }

  const emailResult = await resend.emails.send({
    from: FROM,
    to: email,
    subject: "You're on the Cascrow waitlist",
    html: `
      <div style="background:#161210;color:#ede6dd;font-family:'Inter',sans-serif;max-width:520px;margin:0 auto;padding:48px 40px;border-radius:16px;">
        <p style="font-family:monospace;font-size:11px;text-transform:uppercase;letter-spacing:0.2em;color:#c4704b;margin:0 0 32px;">cascrow — early access</p>
        <h1 style="font-size:24px;font-weight:700;margin:0 0 16px;color:#ede6dd;">You're on the list.</h1>
        <p style="font-size:15px;line-height:1.6;color:#9e8f82;margin:0 0 24px;">
          We'll reach out as soon as early access opens. You'll be among the first to use Cascrow — agentic escrow and AI verification for the agent economy.
        </p>
        <div style="background:#1e1a17;border:1px solid #2a2420;border-radius:12px;padding:20px 24px;margin:0 0 32px;">
          <p style="font-family:monospace;font-size:11px;text-transform:uppercase;letter-spacing:0.18em;color:#9e8f82;margin:0 0 8px;">What you get</p>
          <ul style="margin:0;padding:0 0 0 16px;color:#ede6dd;font-size:14px;line-height:1.8;">
            <li>Early access before public launch</li>
            <li>Priority onboarding &amp; support</li>
            <li>Founding-user pricing</li>
          </ul>
        </div>
        <p style="font-size:13px;color:#6b5f56;margin:0;">cascrow.com · AI-verified escrow on XRPL</p>
      </div>
    `,
  });
  console.log("Waitlist email result:", JSON.stringify(emailResult));

  return NextResponse.json({ success: true });
}

export async function GET() {
  const count = await prisma.waitlistEntry.count();
  return NextResponse.json({ count });
}
