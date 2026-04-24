import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/email";
import { screenName } from "@/services/sanctions/sanctions.service";
import { validateName } from "@/lib/validate-name";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { registerSchema } from "@/lib/zod-schemas";
import { verifyTurnstile } from "@/lib/turnstile";
import { getPostHogClient } from "@/lib/posthog-server";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    // 10 registrations per IP per hour — blocks signup floods without affecting real users
    const ip = getClientIp(request) ?? "unknown";
    if (!(await checkRateLimit(`register:${ip}`, 10, 60 * 60 * 1000))) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": "3600" } }
      );
    }

    const body = await request.json();

    // Turnstile bot protection
    if (!(await verifyTurnstile(body.turnstileToken))) {
      return NextResponse.json({ error: "Bot check failed. Please try again." }, { status: 400 });
    }

    // Zod: structural + type validation (catches missing fields, wrong types, length violations)
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Invalid input";
      return NextResponse.json({ error: message }, { status: 400 });
    }
    const { email, password, name, role, dateOfBirth } = parsed.data;

    // Domain-specific name validation (business rules beyond what Zod covers)
    if (typeof name === "string" && name.trim().length > 0) {
      const nameCheck = validateName(name);
      if (!nameCheck.valid) {
        return NextResponse.json({ error: nameCheck.reason }, { status: 400 });
      }
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      // If account exists but is unverified, resend the verification email
      if (!existing.emailVerified) {
        const emailVerificationToken = crypto.randomBytes(32).toString("hex");
        const emailVerificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await prisma.user.update({
          where: { id: existing.id },
          data: { emailVerificationToken, emailVerificationTokenExpiry },
        });
        try {
          await sendVerificationEmail({ to: email, token: emailVerificationToken });
        } catch (err) {
          console.error("[register] Failed to resend verification email:", err);
        }
        return NextResponse.json({ ok: true, resent: true });
      }
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const emailVerificationToken = crypto.randomBytes(32).toString("hex");
    const emailVerificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    // Validate optional dateOfBirth — must be a valid past date
    let parsedDOB: Date | null = null;
    if (dateOfBirth) {
      const d = new Date(dateOfBirth);
      if (!isNaN(d.getTime()) && d < new Date()) {
        parsedDOB = d;
      }
    }

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: name || null,
        role,
        emailVerificationToken,
        emailVerificationTokenExpiry,
        dateOfBirth: parsedDOB,
      },
    });

    // Send verification email
    try {
      await sendVerificationEmail({ to: email, token: emailVerificationToken });
    } catch (err) {
      console.error("[register] Failed to send verification email:", err);
    }

    // Auto-grant enterprise access if admin pre-activated this email before account existed
    const waitlistEntry = await prisma.enterpriseWaitlist.findFirst({
      where: { email, preActivated: true },
    });
    if (waitlistEntry) {
      await prisma.user.update({
        where: { id: user.id },
        data: { isEnterprise: true, enterpriseActivatedAt: new Date() },
      });
      await prisma.enterpriseWaitlist.delete({ where: { id: waitlistEntry.id } }).catch(() => {});
    }

    // Sanctions screening — fire-and-forget, never blocks registration.
    // Marks the user record with CLEAR or HIT for compliance review.
    void (async () => {
      try {
        const screenTarget = name || email.split("@")[0];
        const result = await screenName(screenTarget, parsedDOB);
        await prisma.user.update({
          where: { id: user.id },
          data: {
            sanctionsCheckedAt: new Date(),
            sanctionsStatus: result.hit ? "HIT" : "CLEAR",
            // Auto-upgrade to Tier 1 when sanctions check passes
            ...(result.hit ? {} : { kycTier: 1 }),
          },
        });
        if (result.hit) {
          console.warn(
            `[sanctions] Potential match for new user ${user.id} (${email}): ${result.matches.slice(0, 3).join(", ")}`
          );
        }
      } catch (err) {
        console.warn("[sanctions] Screening failed on registration (non-fatal):", err);
      }
    })();

    getPostHogClient().capture({
      distinctId: user.id,
      event: "user_registered",
      properties: { role, has_name: !!name, has_dob: !!parsedDOB },
    });

    return NextResponse.json({ id: user.id, email: user.email, role: user.role });
  } catch (err) {
    console.error("[register]", err);
    return NextResponse.json({ error: "Registration failed. Please try again." }, { status: 500 });
  }
}
