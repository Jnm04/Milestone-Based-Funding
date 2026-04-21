import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { AttestationDetail } from "./attestation-detail";
import Link from "next/link";

export default async function AttestationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;

  const contract = await prisma.contract.findUnique({
    where: { id },
    include: {
      milestones: {
        orderBy: { order: "asc" },
        include: {
          proofs: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              id: true,
              aiDecision: true,
              aiReasoning: true,
              aiConfidence: true,
              aiModelVotes: true,
              createdAt: true,
              fileName: true,
            },
          },
        },
      },
    },
  });

  if (!contract || contract.investorId !== session.user.id || contract.mode !== "ATTESTATION") {
    redirect("/enterprise/dashboard/attestations");
  }

  const goalSet = { id: contract.id, title: contract.milestone };
  const milestones = contract.milestones.map((m) => ({
    id: m.id,
    title: m.title,
    description: m.description,
    status: m.status,
    cancelAfter: m.cancelAfter.toISOString(),
    order: m.order,
    latestProof: m.proofs[0]
      ? {
          id: m.proofs[0].id,
          aiDecision: m.proofs[0].aiDecision,
          aiReasoning: m.proofs[0].aiReasoning,
          aiConfidence: m.proofs[0].aiConfidence,
          aiModelVotes: m.proofs[0].aiModelVotes,
          createdAt: m.proofs[0].createdAt.toISOString(),
          fileName: m.proofs[0].fileName,
        }
      : null,
  }));

  return (
    <div style={{ padding: "32px 36px", maxWidth: 900 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <Link
          href="/enterprise/dashboard/attestations"
          style={{ fontSize: 13, color: "var(--ent-muted)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 16 }}
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Goal Sets
        </Link>
        <h1 style={{ margin: "0 0 4px", fontSize: 24, fontWeight: 700, color: "var(--ent-text)", letterSpacing: "-0.02em" }}>
          {contract.milestone}
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: "var(--ent-muted)" }}>
          {milestones.length} milestone{milestones.length !== 1 ? "s" : ""} · Created{" "}
          {new Date(contract.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      <AttestationDetail goalSet={goalSet} milestones={milestones} />
    </div>
  );
}
