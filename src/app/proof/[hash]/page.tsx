import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import QRCodeSection from "./qr-code-section";

export const revalidate = 3600;

interface Props {
  params: Promise<{ hash: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { hash } = await params;
  const milestone = await prisma.milestone.findUnique({
    where: { publicProofHash: hash },
    select: { title: true },
  });
  if (!milestone) return { title: "Verified Milestone — Cascrow" };
  return {
    title: `${milestone.title} — Verified by Cascrow`,
    description: "This milestone was independently verified by Cascrow's 5-model AI panel and recorded on the XRP Ledger.",
    openGraph: {
      title: `${milestone.title} — Verified by Cascrow`,
      description: "AI-verified milestone with on-chain proof.",
    },
  };
}

export default async function PublicProofPage({ params }: Props) {
  const { hash } = await params;

  const milestone = await prisma.milestone.findUnique({
    where: { publicProofHash: hash },
    include: {
      contract: { select: { mode: true, investorId: true } },
      proofs: {
        where: { aiDecision: "YES" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          aiDecision: true,
          aiReasoning: true,
          aiConfidence: true,
          aiModelVotes: true,
          createdAt: true,
        },
      },
    },
  });

  if (!milestone || !milestone.publicProofHash) return notFound();

  const latestProof = milestone.proofs[0];
  if (!latestProof) return notFound();

  const verifiedAt = latestProof.createdAt;
  const confidence = latestProof.aiConfidence ?? 0;
  const pageUrl = `${process.env.NEXTAUTH_URL ?? "https://cascrow.xyz"}/verify/${hash}`;
  const xrplUrl = milestone.nftTxHash
    ? `https://livenet.xrpl.org/transactions/${milestone.nftTxHash}`
    : null;

  const linkedInText = encodeURIComponent(
    `✅ Milestone verified: "${milestone.title}" — independently confirmed by Cascrow's 5-model AI panel with ${confidence}% confidence and recorded on the XRP Ledger. ${pageUrl}`
  );
  const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(pageUrl)}&summary=${linkedInText}`;

  type ModelVote = { model: string; decision: string; confidence: number };
  const modelVotes = Array.isArray(latestProof.aiModelVotes)
    ? (latestProof.aiModelVotes as ModelVote[])
    : [];

  return (
    <div className="min-h-screen flex flex-col items-center justify-start py-12 px-4" style={{ background: "#1A1512" }}>
      {/* Verified badge */}
      <div className="flex flex-col items-center gap-3 mb-8">
        <div className="flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-sm" style={{ background: "rgba(196,112,75,0.15)", color: "#C4704B", border: "1px solid rgba(196,112,75,0.3)" }}>
          <span>✓</span>
          <span>Verified by Cascrow</span>
        </div>
        <h1 className="text-2xl font-bold text-center" style={{ color: "#EDE6DD" }}>{milestone.title}</h1>
        {milestone.description && (
          <p className="text-center text-sm max-w-lg" style={{ color: "#A89B8C" }}>{milestone.description}</p>
        )}
      </div>

      {/* Main card */}
      <div className="w-full max-w-xl rounded-2xl p-6 flex flex-col gap-5" style={{ background: "#231E1A", border: "1px solid rgba(196,112,75,0.2)" }}>
        {/* AI Verdict */}
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-widest font-semibold" style={{ color: "#C4704B" }}>AI Verdict</span>
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold" style={{ color: "#4ADE80" }}>APPROVED</span>
            <span className="text-sm px-2 py-0.5 rounded-full" style={{ background: "rgba(74,222,128,0.1)", color: "#4ADE80" }}>
              {confidence}% confidence
            </span>
          </div>
          {latestProof.aiReasoning && (
            <p className="text-sm mt-1" style={{ color: "#D4B896" }}>{latestProof.aiReasoning}</p>
          )}
        </div>

        {/* Model votes */}
        {modelVotes.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-xs uppercase tracking-widest font-semibold" style={{ color: "#C4704B" }}>5-Model Panel Votes</span>
            <div className="grid grid-cols-1 gap-1">
              {modelVotes.map((v) => (
                <div key={v.model} className="flex items-center justify-between text-xs px-3 py-1.5 rounded" style={{ background: "rgba(0,0,0,0.2)" }}>
                  <span style={{ color: "#A89B8C" }}>{v.model}</span>
                  <span style={{ color: v.decision === "YES" ? "#4ADE80" : "#F87171", fontWeight: 600 }}>
                    {v.decision} · {v.confidence}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Metadata */}
        <div className="flex flex-col gap-2 text-xs" style={{ color: "#A89B8C" }}>
          <div className="flex justify-between">
            <span>Verified at</span>
            <span style={{ color: "#EDE6DD" }}>{verifiedAt.toUTCString()}</span>
          </div>
          <div className="flex justify-between">
            <span>Amount</span>
            <span style={{ color: "#EDE6DD" }}>${Number(milestone.amountUSD).toLocaleString()}</span>
          </div>
          {xrplUrl && (
            <div className="flex justify-between">
              <span>On-chain proof</span>
              <a href={xrplUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#C4704B" }} className="hover:underline">
                XRP Ledger ↗
              </a>
            </div>
          )}
          <div className="flex justify-between">
            <span>Verification hash</span>
            <span className="font-mono text-xs truncate max-w-48" style={{ color: "#EDE6DD" }}>{hash.slice(0, 16)}…</span>
          </div>
        </div>

        {/* Share buttons */}
        <div className="flex gap-3 pt-2 border-t" style={{ borderColor: "rgba(196,112,75,0.15)" }}>
          <a
            href={linkedInUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 text-center py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-80"
            style={{ background: "#0A66C2", color: "#fff" }}
          >
            Share on LinkedIn
          </a>
          <QRCodeSection url={pageUrl} />
        </div>
      </div>

      {/* Powered by Cascrow */}
      <p className="mt-8 text-xs" style={{ color: "#6B5E54" }}>
        Powered by{" "}
        <a href="https://cascrow.xyz" style={{ color: "#C4704B" }} className="hover:underline">Cascrow</a>
        {" "}— AI-powered milestone escrow on the XRP Ledger
      </p>
    </div>
  );
}
