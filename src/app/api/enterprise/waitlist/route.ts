import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { Resend } from "resend";
import { z } from "zod";

const resend = new Resend(process.env.RESEND_API_KEY);

const schema = z.object({
  name:    z.string().min(2).max(100),
  email:   z.string().email(),
  company: z.string().min(2).max(200),
  useCase: z.enum(["CSRD", "KPI", "COMPLIANCE", "OTHER"]),
  message: z.string().max(2000).optional(),
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  if (!(await checkRateLimit(`enterprise-waitlist:${ip}`, 3, 60 * 60 * 1000))) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { name, email, company, useCase, message } = parsed.data;

  await prisma.enterpriseWaitlist.create({ data: { name, email, company, useCase, message } });

  // Notify team
  if (process.env.RESEND_API_KEY) {
    const useCaseLabel: Record<string, string> = {
      CSRD: "CSRD / ESG Reporting",
      KPI: "KPI & Revenue Attestation",
      COMPLIANCE: "Group-wide Compliance Tracking",
      OTHER: "Other",
    };
    await resend.emails.send({
      from: process.env.EMAIL_FROM ?? "cascrow <noreply@cascrow.com>",
      to: "enterprise@cascrow.com",
      subject: `Enterprise access request — ${company}`,
      html: `
        <p><strong>New enterprise access request</strong></p>
        <table style="border-collapse:collapse;font-family:sans-serif;font-size:14px">
          <tr><td style="padding:4px 12px 4px 0;color:#64748b">Name</td><td>${name}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#64748b">Email</td><td><a href="mailto:${email}">${email}</a></td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#64748b">Company</td><td>${company}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#64748b">Use case</td><td>${useCaseLabel[useCase]}</td></tr>
          ${message ? `<tr><td style="padding:4px 12px 4px 0;color:#64748b;vertical-align:top">Message</td><td>${message}</td></tr>` : ""}
        </table>
      `,
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
