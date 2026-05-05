import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

interface MilestoneProof {
  milestoneId:  string;
  contractId:   string;
  title:        string;
  amountUSD:    string;
  completedAt:  string;
  nftTokenId:   string | null;
  proofs: {
    aiDecision:    string | null;
    fundsReleased: string | null;
    nftMinted:     string | null;
  };
}

interface ReputationData {
  walletAddress: string;
  agentId:       string;
  name:          string | null;
  memberSince:   string;
  discoverable:  boolean;
  skills:        string[];
  stats: {
    milestonesCompleted: number;
    milestonesRejected:  number;
    totalRlusdReleased:  string;
    successRate:         number | null;
  };
  milestones: MilestoneProof[];
}

const BASE_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

async function getReputation(address: string): Promise<ReputationData | null> {
  const res = await fetch(
    `${BASE_URL}/api/agent/reputation/${encodeURIComponent(address)}`,
    { next: { revalidate: 60 } }
  );
  if (!res.ok) return null;
  return res.json() as Promise<ReputationData>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ address: string }>;
}): Promise<Metadata> {
  const { address } = await params;
  const data = await getReputation(address);
  if (!data) return { title: "Agent not found — cascrow" };

  const label = data.name ?? address.slice(0, 10) + "…";
  const rate  = data.stats.successRate !== null
    ? ` · ${Math.round(data.stats.successRate * 100)}% success rate`
    : "";

  return {
    title: `${label} — cascrow Agent Profile`,
    description: `${data.stats.milestonesCompleted} milestones completed${rate}. Verified on-chain via XRPL.`,
  };
}

function SuccessBar({ rate }: { rate: number }) {
  const pct = Math.round(rate * 100);
  return (
    <div className="flex items-center gap-3">
      <div
        className="flex-1 rounded-full h-2 overflow-hidden"
        style={{ background: "rgba(255,255,255,0.08)" }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{
            width:      `${pct}%`,
            background: pct >= 80 ? "#C4704B" : pct >= 50 ? "#D4B896" : "#A89B8C",
          }}
        />
      </div>
      <span className="text-sm font-semibold tabular-nums" style={{ color: "#C4704B", minWidth: "3rem" }}>
        {pct}%
      </span>
    </div>
  );
}

export default async function AgentProfilePage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;
  const data = await getReputation(address);
  if (!data) notFound();

  const isXrplMainnet = process.env.XRPL_NETWORK !== "testnet";
  const xrplBase      = isXrplMainnet
    ? "https://xrpscan.com"
    : "https://testnet.xrpscan.com";

  const shortAddr = `${address.slice(0, 8)}…${address.slice(-6)}`;
  const label     = data.name ?? shortAddr;

  return (
    <main
      className="min-h-screen"
      style={{
        background: "linear-gradient(135deg, #171311 0%, #1f1715 100%)",
        color: "#EDE6DD",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div className="max-w-2xl mx-auto px-4 py-16">

        {/* Header */}
        <div className="flex flex-col items-center text-center gap-4 mb-12">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold"
            style={{
              background: "rgba(196,112,75,0.2)",
              border: "2px solid rgba(196,112,75,0.4)",
              color: "#C4704B",
            }}
          >
            {label.charAt(0).toUpperCase()}
          </div>

          <div>
            <h1 className="text-3xl font-bold" style={{ color: "#EDE6DD" }}>{label}</h1>
            <p className="text-sm mt-1 font-mono" style={{ color: "#A89B8C" }}>{shortAddr}</p>
          </div>

          <div
            className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold"
            style={{
              background: "rgba(196,112,75,0.15)",
              border: "1px solid rgba(196,112,75,0.4)",
              color: "#C4704B",
            }}
          >
            ✦ Cascrow Verified Agent
          </div>

          {data.skills.length > 0 && (
            <div className="flex gap-2 flex-wrap justify-center">
              {data.skills.map((s) => (
                <span
                  key={s}
                  className="text-xs px-3 py-1 rounded-full"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "#A89B8C",
                  }}
                >
                  {s}
                </span>
              ))}
            </div>
          )}

          <p className="text-xs" style={{ color: "#A89B8C" }}>
            Member since {new Date(data.memberSince).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div
            className="rounded-xl p-5 text-center"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <div className="text-3xl font-bold" style={{ color: "#C4704B" }}>
              {data.stats.milestonesCompleted}
            </div>
            <div className="text-xs mt-1" style={{ color: "#A89B8C" }}>Milestones Completed</div>
          </div>
          <div
            className="rounded-xl p-5 text-center"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <div className="text-3xl font-bold" style={{ color: "#C4704B" }}>
              ${Number(data.stats.totalRlusdReleased).toLocaleString()}
            </div>
            <div className="text-xs mt-1" style={{ color: "#A89B8C" }}>Total RLUSD Released</div>
          </div>
        </div>

        {/* Success rate bar */}
        {data.stats.successRate !== null && (
          <div
            className="rounded-xl p-5 mb-10"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium" style={{ color: "#EDE6DD" }}>Success Rate</span>
              <span className="text-xs" style={{ color: "#A89B8C" }}>
                {data.stats.milestonesCompleted} completed · {data.stats.milestonesRejected} rejected
              </span>
            </div>
            <SuccessBar rate={data.stats.successRate} />
          </div>
        )}

        {/* Milestone proofs */}
        {data.milestones.length > 0 && (
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold" style={{ color: "#EDE6DD" }}>
              Completed Milestones
            </h2>
            {data.milestones.map((m) => {
              const hasOnChain = m.proofs.aiDecision || m.proofs.fundsReleased || m.proofs.nftMinted;
              return (
                <div
                  key={m.milestoneId}
                  className="rounded-xl p-5"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="font-semibold text-sm" style={{ color: "#EDE6DD" }}>
                      {m.title}
                    </span>
                    <span className="text-xs font-medium flex-shrink-0" style={{ color: "#C4704B" }}>
                      ${Number(m.amountUSD).toLocaleString()} RLUSD
                    </span>
                  </div>

                  <p className="text-xs mb-3" style={{ color: "#A89B8C" }}>
                    {new Date(m.completedAt).toLocaleDateString("en-US", {
                      day: "numeric", month: "short", year: "numeric",
                    })}
                  </p>

                  {hasOnChain && (
                    <div className="flex flex-col gap-1">
                      <p className="text-xs font-medium mb-1" style={{ color: "#A89B8C" }}>
                        On-chain proof (XRPL Mainnet):
                      </p>
                      {m.proofs.aiDecision && (
                        <a
                          href={`${xrplBase}/tx/${m.proofs.aiDecision}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs"
                          style={{ color: "#A89B8C", textDecoration: "underline" }}
                        >
                          AI Decision →
                        </a>
                      )}
                      {m.proofs.fundsReleased && (
                        <a
                          href={`${xrplBase}/tx/${m.proofs.fundsReleased}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs"
                          style={{ color: "#A89B8C", textDecoration: "underline" }}
                        >
                          Funds Released →
                        </a>
                      )}
                      {m.nftTokenId && (
                        <a
                          href={`${xrplBase}/nft/${m.nftTokenId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs"
                          style={{ color: "#A89B8C", textDecoration: "underline" }}
                        >
                          NFT Certificate →
                        </a>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {data.milestones.length === 0 && (
          <div
            className="rounded-xl p-8 text-center"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <p className="text-sm" style={{ color: "#A89B8C" }}>No completed milestones yet.</p>
          </div>
        )}

        <div className="mt-12 text-center">
          <Link href="/" className="text-xs" style={{ color: "#A89B8C", textDecoration: "underline" }}>
            Powered by cascrow
          </Link>
        </div>
      </div>
    </main>
  );
}
