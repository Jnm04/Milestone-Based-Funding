import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Image from "next/image";

const IS_TESTNET = process.env.XRPL_NETWORK === "testnet";
const XRPL_EXPLORER = IS_TESTNET ? "https://testnet.xrpscan.com" : "https://xrpscan.com";

export const dynamic = "force-dynamic";

const VERDICT_COLOR: Record<string, string> = {
  YES: "#4ade80",
  NO: "#f87171",
  INCONCLUSIVE: "#fbbf24",
};
const VERDICT_LABEL: Record<string, string> = {
  YES: "VERIFIED",
  NO: "NOT MET",
  INCONCLUSIVE: "INCONCLUSIVE",
};

export default async function AttestationCertPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const entry = await prisma.attestationEntry.findUnique({
    where: { id },
    include: {
      milestone: {
        include: { contract: { select: { investorId: true, auditorEmail: true } } },
      },
    },
  });

  if (!entry) notFound();

  const milestone = entry.milestone;
  const verdictColor = VERDICT_COLOR[entry.aiVerdict] ?? "#fbbf24";
  const verdictLabel = VERDICT_LABEL[entry.aiVerdict] ?? entry.aiVerdict;
  const shortHash = entry.fetchedHash.slice(0, 16) + "…" + entry.fetchedHash.slice(-8);

  return (
    <div className="min-h-screen bg-[#0E0B0A] text-[#EDE6DD] flex flex-col items-center py-12 px-4">
      <div className="w-full max-w-2xl">

        {/* Header */}
        <div className="text-center mb-8">
          <p className="text-[#C4704B] text-xs tracking-[4px] uppercase mb-2">Corporate KPI Attestation Certificate</p>
          <h1 className="text-3xl font-bold text-[#EDE6DD]">cascrow</h1>
        </div>

        {/* Certificate card */}
        <div className="border border-[#C4704B]/30 rounded-lg p-8 bg-[#171311]">

          {/* Verdict badge */}
          <div className="flex justify-center mb-6">
            <span
              className="px-6 py-2 rounded text-sm font-bold tracking-widest border"
              style={{ color: verdictColor, borderColor: verdictColor, backgroundColor: `${verdictColor}18` }}
            >
              {verdictLabel}
            </span>
          </div>

          {/* Milestone title */}
          <div className="text-center mb-6">
            <p className="text-[#C4704B] text-xs tracking-widest uppercase mb-1">Attested Milestone</p>
            <h2 className="text-xl font-semibold">{milestone.title}</h2>
          </div>

          {/* Meta grid */}
          <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
            <div>
              <p className="text-[#8B7355] text-xs uppercase tracking-wider mb-1">Period</p>
              <p className="font-mono">{entry.period}</p>
            </div>
            <div>
              <p className="text-[#8B7355] text-xs uppercase tracking-wider mb-1">Verified At</p>
              <p className="font-mono">{entry.fetchedAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
            </div>
            <div>
              <p className="text-[#8B7355] text-xs uppercase tracking-wider mb-1">Data Source</p>
              <p className="font-mono">{milestone.dataSourceType?.replace("_", " ") ?? "FILE UPLOAD"}</p>
            </div>
            <div>
              <p className="text-[#8B7355] text-xs uppercase tracking-wider mb-1">Type</p>
              <p className="font-mono">{entry.type}</p>
            </div>
          </div>

          {/* AI Reasoning */}
          <div className="mb-6">
            <p className="text-[#C4704B] text-xs uppercase tracking-wider mb-2">AI Assessment</p>
            <p className="text-[#D4B896] italic text-sm leading-relaxed border-l-2 border-[#C4704B]/40 pl-4">
              {entry.aiReasoning}
            </p>
          </div>

          {/* Evidence hash */}
          <div className="mb-4">
            <p className="text-[#8B7355] text-xs uppercase tracking-wider mb-1">Evidence SHA-256</p>
            <p className="font-mono text-xs text-[#8B7355] break-all">{shortHash}</p>
          </div>

          {/* XRPL link */}
          {entry.xrplTxHash && (
            <div className="mb-4">
              <p className="text-[#8B7355] text-xs uppercase tracking-wider mb-1">On-Chain Record</p>
              <a
                href={`${XRPL_EXPLORER}/transactions/${entry.xrplTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs text-[#C4704B] hover:underline break-all"
              >
                {entry.xrplTxHash.slice(0, 24)}…
              </a>
            </div>
          )}

          {/* Certificate image */}
          {entry.certUrl && (
            <div className="mt-6">
              <Image
                src={entry.certUrl}
                alt="Attestation Certificate"
                width={900}
                height={560}
                className="w-full rounded border border-[#C4704B]/20"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-[#5A4A3A] mt-8">
          All data verified by cascrow AI and recorded on XRP Ledger ·{" "}
          <a href="https://cascrow.com" className="hover:text-[#C4704B]">cascrow.com</a>
        </p>
      </div>
    </div>
  );
}
