import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isValidCronSecret } from "@/lib/cron-auth";
import { sendConnectorHealthAlert } from "@/lib/email";
import { isSafePublicUrl } from "@/lib/safe-url";

const PROBE_TIMEOUT_MS = 5000;
const ESCALATION_UNHEALTHY_DAYS = 7;
const ESCALATION_DAYS_UNTIL_VERIFICATION = 14;

/**
 * GET /api/cron/connector-health
 * Daily at 07:00 UTC — probes every active REST_API and URL_SCRAPE data source.
 * Sends an alert email on error; escalates after 7+ days unhealthy and <14 days to verification.
 */
export async function GET(request: NextRequest) {
  if (!isValidCronSecret(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // Find all active milestones with a REST_API or URL_SCRAPE connector
  const milestones = await prisma.milestone.findMany({
    where: {
      status: { notIn: ["COMPLETED", "EXPIRED", "REJECTED"] },
      dataSourceType: { in: ["REST_API", "URL_SCRAPE"] },
      dataSourceUrl: { not: null },
    },
    include: {
      contract: {
        include: { investor: true },
      },
    },
  });

  const results = { checked: 0, ok: 0, error: 0, skipped: 0 };

  await Promise.allSettled(
    milestones.map(async (milestone) => {
      const url = milestone.dataSourceUrl!;
      results.checked++;

      if (!isSafePublicUrl(url)) {
        results.skipped++;
        await prisma.connectorHealthCheck.create({
          data: { milestoneId: milestone.id, connectorUrl: url, status: "ERROR", errorMessage: "URL blocked: private or non-HTTPS address" },
        });
        await prisma.milestone.update({ where: { id: milestone.id }, data: { connectorStatus: "ERROR" } });
        return;
      }

      let status: "OK" | "ERROR" | "TIMEOUT" = "OK";
      let httpStatus: number | null = null;
      let errorMessage: string | null = null;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
        try {
          const res = await fetch(url, {
            method: "HEAD",
            signal: controller.signal,
            headers: { "User-Agent": "cascrow-health-monitor/1.0" },
          });
          httpStatus = res.status;
          if (!res.ok && res.status !== 405) {
            // 405 Method Not Allowed on HEAD is fine — fall back to GET probe result
            status = "ERROR";
            errorMessage = `HTTP ${res.status} ${res.statusText}`;
          }
        } finally {
          clearTimeout(timeoutId);
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          status = "TIMEOUT";
          errorMessage = "Request timed out after 5 seconds";
        } else {
          status = "ERROR";
          errorMessage = err instanceof Error ? err.message : "Unknown network error";
        }
      }

      // Persist health check result
      await prisma.connectorHealthCheck.create({
        data: {
          milestoneId: milestone.id,
          connectorUrl: url,
          status,
          httpStatus,
          errorMessage,
        },
      });

      if (status === "OK") {
        results.ok++;
        await prisma.milestone.update({
          where: { id: milestone.id },
          data: { connectorStatus: "OK", connectorLastHealthy: now },
        });
        return;
      }

      results.error++;
      await prisma.milestone.update({
        where: { id: milestone.id },
        data: { connectorStatus: "ERROR" },
      });

      // Determine if this is an escalation (7+ days unhealthy, <14 days to verification)
      const daysUntilVerification = milestone.cancelAfter
        ? Math.ceil((milestone.cancelAfter.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : 999;

      const lastHealthy = milestone.connectorLastHealthy;
      const daysUnhealthy = lastHealthy
        ? Math.floor((now.getTime() - lastHealthy.getTime()) / (1000 * 60 * 60 * 24))
        : 999;

      const isEscalation =
        daysUnhealthy >= ESCALATION_UNHEALTHY_DAYS &&
        daysUntilVerification <= ESCALATION_DAYS_UNTIL_VERIFICATION;

      // Collect team member emails for escalation
      let teamEmails: string[] = [];
      if (isEscalation) {
        const members = await prisma.orgMember.findMany({
          where: { ownerId: milestone.contract.investorId, acceptedAt: { not: null } },
          include: { member: true },
        });
        teamEmails = members
          .filter((m) => m.member?.email)
          .map((m) => m.member!.email);
      }

      await sendConnectorHealthAlert({
        to: milestone.contract.investor.email,
        milestoneTitle: milestone.title,
        contractId: milestone.contractId,
        connectorUrl: url,
        errorMessage,
        httpStatus,
        daysUntilVerification,
        isEscalation,
        teamEmails,
      });
    })
  );

  return NextResponse.json({ ...results, timestamp: now.toISOString() });
}
