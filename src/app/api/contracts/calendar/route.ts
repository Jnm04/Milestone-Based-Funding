import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/contracts/calendar?contractId=xxx
 * Returns an RFC 5545 .ics file with one VEVENT per milestone deadline.
 * The file can be imported into Google Calendar, Apple Calendar, Outlook, etc.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const contractId = request.nextUrl.searchParams.get("contractId");
    if (!contractId) {
      return NextResponse.json({ error: "contractId is required" }, { status: 400 });
    }

    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        milestones: { orderBy: { order: "asc" } },
        investor: { select: { id: true, name: true, companyName: true } },
        startup: { select: { id: true, name: true, companyName: true } },
      },
    });

    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    // Both investor and startup can download the calendar
    const isParty =
      contract.investorId === session.user.id ||
      contract.startup?.id === session.user.id;
    if (!isParty) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const baseUrl =
      process.env.NEXTAUTH_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

    const contractUrl = `${baseUrl}/contract/${contractId}`;
    const investorLabel =
      contract.investor.companyName ?? contract.investor.name ?? "Investor";
    const startupLabel =
      contract.startup?.companyName ?? contract.startup?.name ?? "Receiver";

    const now = formatIcsDate(new Date());

    const events = contract.milestones.map((ms) => {
      const deadline = ms.cancelAfter;
      // All-day event: DTSTART is the deadline date, DTEND is the next day
      const dtstart = formatIcsDateOnly(deadline);
      const dtend = formatIcsDateOnly(new Date(deadline.getTime() + 86_400_000));
      const uid = `${contractId}-ms-${ms.order}@cascrow.app`;
      const summary = escapeIcs(`Deadline: ${ms.title}`);
      const description = escapeIcs(
        `Milestone ${ms.order + 1}: ${ms.title}\\n` +
          `Amount: $${Number(ms.amountUSD).toLocaleString()} RLUSD\\n` +
          `Parties: ${investorLabel} ↔ ${startupLabel}\\n` +
          `Contract: ${contractUrl}`
      );
      const alarmDescription = escapeIcs(`Milestone deadline approaching: ${ms.title}`);

      return [
        "BEGIN:VEVENT",
        `UID:${uid}`,
        `DTSTAMP:${now}`,
        `DTSTART;VALUE=DATE:${dtstart}`,
        `DTEND;VALUE=DATE:${dtend}`,
        `SUMMARY:${summary}`,
        `DESCRIPTION:${description}`,
        `URL:${contractUrl}`,
        `STATUS:${ms.status === "COMPLETED" ? "COMPLETED" : "CONFIRMED"}`,
        // Reminder: 3 days before
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        `DESCRIPTION:${alarmDescription}`,
        "TRIGGER:-P3D",
        "END:VALARM",
        // Reminder: 1 day before
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        `DESCRIPTION:${alarmDescription}`,
        "TRIGGER:-P1D",
        "END:VALARM",
        "END:VEVENT",
      ].join("\r\n");
    });

    // If no milestones (legacy single-milestone contract), create one event from cancelAfter
    if (events.length === 0) {
      const deadline = contract.cancelAfter;
      const dtstart = formatIcsDateOnly(deadline);
      const dtend = formatIcsDateOnly(new Date(deadline.getTime() + 86_400_000));
      const uid = `${contractId}@cascrow.app`;
      const summary = escapeIcs(`Deadline: ${contract.milestone}`);
      const description = escapeIcs(
        `Milestone: ${contract.milestone}\\n` +
          `Amount: $${Number(contract.amountUSD).toLocaleString()} RLUSD\\n` +
          `Parties: ${investorLabel} ↔ ${startupLabel}\\n` +
          `Contract: ${contractUrl}`
      );
      events.push(
        [
          "BEGIN:VEVENT",
          `UID:${uid}`,
          `DTSTAMP:${now}`,
          `DTSTART;VALUE=DATE:${dtstart}`,
          `DTEND;VALUE=DATE:${dtend}`,
          `SUMMARY:${summary}`,
          `DESCRIPTION:${description}`,
          `URL:${contractUrl}`,
          "BEGIN:VALARM",
          "ACTION:DISPLAY",
          `DESCRIPTION:${escapeIcs(`Milestone deadline approaching: ${contract.milestone}`)}`,
          "TRIGGER:-P3D",
          "END:VALARM",
          "END:VEVENT",
        ].join("\r\n")
      );
    }

    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Cascrow//Milestone Deadlines//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      `X-WR-CALNAME:Cascrow — ${escapeIcs(contract.milestone.slice(0, 40))}`,
      "X-WR-TIMEZONE:UTC",
      ...events,
      "END:VCALENDAR",
    ].join("\r\n");

    const safeTitle = contract.milestone.replace(/[^a-zA-Z0-9]/g, "-").slice(0, 40);

    return new NextResponse(ics, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="cascrow-${safeTitle}.ics"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[calendar] Error:", err);
    return NextResponse.json({ error: "Failed to generate calendar" }, { status: 500 });
  }
}

// ─── ICS formatting helpers ───────────────────────────────────────────────────

/** Format a Date as ICS basic date-time: YYYYMMDDTHHmmssZ */
function formatIcsDate(d: Date): string {
  return d
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

/** Format a Date as ICS date-only value: YYYYMMDD */
function formatIcsDateOnly(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

/** Escape special characters for ICS text values. */
function escapeIcs(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "");
}
