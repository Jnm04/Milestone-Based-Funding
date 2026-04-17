import { NextRequest, NextResponse, after } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { fetchGitHubProof, parseGitHubUrl } from "@/services/github/github.service";
import { sendProofSubmittedEmail } from "@/lib/email";
import { writeAuditLog } from "@/services/evm/audit.service";
import { fireWebhook } from "@/services/webhook/webhook.service";
import crypto from "crypto";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * POST /api/proof/github
 * Submit a GitHub repository URL as milestone proof.
 * The server fetches repo metadata, commits, and README from the GitHub API,
 * stores the result as extractedText, and triggers AI verification.
 *
 * Body: { repoUrl: string, milestoneId?: string, contractId?: string }
 */

async function triggerVerification(proofId: string) {
  try {
    const baseUrl =
      process.env.NEXTAUTH_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
    await fetch(`${baseUrl}/api/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.CRON_SECRET}`,
      },
      body: JSON.stringify({ proofId }),
    });
  } catch (err) {
    console.error("[github/auto-verify] failed:", err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!checkRateLimit(`proof-github:${session.user.id}`, 5, 60 * 60 * 1000)) {
      return NextResponse.json(
        { error: "Too many GitHub proof submissions. Try again in an hour." },
        { status: 429, headers: { "Retry-After": "3600" } }
      );
    }

    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

    const { repoUrl, milestoneId, contractId } = body as {
      repoUrl?: string;
      milestoneId?: string;
      contractId?: string;
    };

    if (!repoUrl) {
      return NextResponse.json({ error: "repoUrl is required" }, { status: 400 });
    }
    if (!milestoneId && !contractId) {
      return NextResponse.json(
        { error: "milestoneId or contractId is required" },
        { status: 400 }
      );
    }

    // Validate GitHub URL format before making any DB calls
    const parsed = parseGitHubUrl(repoUrl);
    if (!parsed) {
      return NextResponse.json(
        { error: "Invalid GitHub URL. Expected format: https://github.com/owner/repo" },
        { status: 400 }
      );
    }

    if (milestoneId) {
      // ── Milestone-based flow ──────────────────────────────────────────────
      const milestone = await prisma.milestone.findUnique({
        where: { id: milestoneId },
        include: { contract: { include: { investor: true, startup: true } } },
      });

      if (!milestone) {
        return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
      }
      if (milestone.contract.startupId !== session.user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (!["FUNDED", "PROOF_SUBMITTED", "PENDING_REVIEW"].includes(milestone.status)) {
        return NextResponse.json(
          { error: `Cannot submit proof for milestone in status: ${milestone.status}` },
          { status: 409 }
        );
      }

      // Fetch GitHub data
      const ghDoc = await fetchGitHubProof(repoUrl, milestone.contract.createdAt);
      if (!ghDoc) {
        return NextResponse.json(
          {
            error:
              "Could not access this GitHub repository. Make sure it is public and the URL is correct.",
          },
          { status: 422 }
        );
      }

      const fileHash = crypto.createHash("sha256").update(ghDoc.text).digest("hex");
      const normalizedUrl = ghDoc.repoUrl;

      const proof = await prisma.proof.create({
        data: {
          contractId: milestone.contractId,
          milestoneId,
          fileUrl: normalizedUrl,
          fileName: `github:${parsed.owner}/${parsed.repo}`,
          fileHash,
          extractedText: ghDoc.text,
          proofType: "github_url",
          proofUrl: normalizedUrl,
        },
      });

      await prisma.milestone.update({
        where: { id: milestoneId },
        data: { status: "PROOF_SUBMITTED" },
      });
      await prisma.contract.update({
        where: { id: milestone.contractId },
        data: { status: "PROOF_SUBMITTED" },
      });

      if (milestone.contract.investor.notifyProofSubmitted) {
        void sendProofSubmittedEmail({
          to: milestone.contract.investor.email,
          contractId: milestone.contractId,
          milestoneTitle: milestone.title,
          startupName:
            milestone.contract.startup?.companyName ?? milestone.contract.startup?.name,
          investorId: milestone.contract.investorId,
        });
      }

      await writeAuditLog({
        contractId: milestone.contractId,
        milestoneId,
        event: "PROOF_SUBMITTED",
        actor: session.user.id,
        metadata: { proofId: proof.id, proofType: "github_url", repoUrl: normalizedUrl, fileHash },
      });

      void fireWebhook({
        investorId: milestone.contract.investorId,
        startupId: milestone.contract.startupId ?? undefined,
        event: "proof.submitted",
        contractId: milestone.contractId,
        milestoneId,
        data: { proofId: proof.id, proofType: "github_url", repoUrl: normalizedUrl, milestoneTitle: milestone.title },
      });

      after(() => triggerVerification(proof.id));

      return NextResponse.json({
        proofId: proof.id,
        repoUrl: normalizedUrl,
        proofType: "github_url",
        textLength: ghDoc.text.length,
      });
    } else {
      // ── Contract-based flow (legacy) ─────────────────────────────────────
      const resolvedContractId = contractId!;
      const contract = await prisma.contract.findUnique({
        where: { id: resolvedContractId },
        include: { investor: true, startup: true },
      });
      if (!contract) return NextResponse.json({ error: "Contract not found" }, { status: 404 });
      if (contract.startupId !== session.user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (!["FUNDED", "PROOF_SUBMITTED", "PENDING_REVIEW"].includes(contract.status)) {
        return NextResponse.json(
          { error: `Cannot submit proof in status: ${contract.status}` },
          { status: 409 }
        );
      }

      const ghDoc = await fetchGitHubProof(repoUrl, contract.createdAt);
      if (!ghDoc) {
        return NextResponse.json(
          {
            error:
              "Could not access this GitHub repository. Make sure it is public and the URL is correct.",
          },
          { status: 422 }
        );
      }

      const fileHash = crypto.createHash("sha256").update(ghDoc.text).digest("hex");
      const normalizedUrl = ghDoc.repoUrl;

      const proof = await prisma.proof.create({
        data: {
          contractId: resolvedContractId,
          fileUrl: normalizedUrl,
          fileName: `github:${parsed.owner}/${parsed.repo}`,
          fileHash,
          extractedText: ghDoc.text,
          proofType: "github_url",
          proofUrl: normalizedUrl,
        },
      });

      await prisma.contract.update({
        where: { id: resolvedContractId },
        data: { status: "PROOF_SUBMITTED" },
      });

      if (contract.investor.notifyProofSubmitted) {
        void sendProofSubmittedEmail({
          to: contract.investor.email,
          contractId: resolvedContractId,
          milestoneTitle: contract.milestone,
          startupName: contract.startup?.companyName ?? contract.startup?.name,
          investorId: contract.investorId,
        });
      }

      await writeAuditLog({
        contractId: resolvedContractId,
        event: "PROOF_SUBMITTED",
        actor: session.user.id,
        metadata: { proofId: proof.id, proofType: "github_url", repoUrl: normalizedUrl, fileHash },
      });

      void fireWebhook({
        investorId: contract.investorId,
        startupId: contract.startupId ?? undefined,
        event: "proof.submitted",
        contractId: resolvedContractId,
        data: { proofId: proof.id, proofType: "github_url", repoUrl: normalizedUrl, milestoneTitle: contract.milestone },
      });

      after(() => triggerVerification(proof.id));

      return NextResponse.json({
        proofId: proof.id,
        repoUrl: normalizedUrl,
        proofType: "github_url",
        textLength: ghDoc.text.length,
      });
    }
  } catch (err) {
    console.error("[proof/github] Error:", err);
    return NextResponse.json({ error: "Failed to submit GitHub proof" }, { status: 500 });
  }
}
