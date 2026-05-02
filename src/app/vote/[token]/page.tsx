"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { PageLoader } from "@/components/page-loader";

interface VoteInfo {
  milestoneTitle: string;
  milestoneDescription: string | null;
  partyRole: string;
  deadline: string;
  alreadyVoted: boolean;
  expired: boolean;
  aiVerdict: string | null;
  aiReasoning: string | null;
  certUrl: string | null;
}

const VERDICT_LABEL: Record<string, string> = { YES: "VERIFIED", NO: "NOT MET", INCONCLUSIVE: "INCONCLUSIVE" };
const VERDICT_COLOR: Record<string, string> = { YES: "#16a34a", NO: "#dc2626", INCONCLUSIVE: "#d97706" };

export default function VotePage() {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<VoteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [reasoning, setReasoning] = useState("");
  const [done, setDone] = useState<{ vote: string; xrplTxHash: string | null } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/vote/${token}`)
      .then((r) => r.json())
      .then((d: VoteInfo) => { setInfo(d); setLoading(false); })
      .catch(() => { setError("Invalid or expired vote link."); setLoading(false); });
  }, [token]);

  async function castVote(vote: "YES" | "NO" | "ABSTAIN") {
    setVoting(true);
    setError("");
    try {
      const res = await fetch("/api/attestation/consensus/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, vote, reasoning: reasoning.trim() || undefined }),
      });
      const data = await res.json() as { success?: boolean; xrplTxHash?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Vote failed");
      setDone({ vote, xrplTxHash: data.xrplTxHash ?? null });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setVoting(false);
    }
  }

  if (loading) return <PageLoader />;

  if (done) return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#0E0B0A" }}>
      <div className="max-w-md w-full text-center p-10 rounded-2xl border border-[#C4704B]/30" style={{ background: "#171311" }}>
        <div className="w-14 h-14 rounded-full bg-green-900/30 flex items-center justify-center mx-auto mb-5">
          <svg width="24" height="24" fill="none" stroke="#4ade80" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-[#EDE6DD] mb-2">Vote Recorded</h2>
        <p className="text-[#8B7355] mb-1">Your vote: <strong className="text-[#EDE6DD]">{done.vote}</strong></p>
        {done.xrplTxHash && (
          <p className="font-mono text-xs text-[#C4704B] mt-3 break-all">
            On-chain: {done.xrplTxHash.slice(0, 24)}…
          </p>
        )}
        <p className="text-[#5A4A3A] text-xs mt-4">Your vote has been anchored to the XRP Ledger.</p>
      </div>
    </div>
  );

  if (error && !info) return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#0E0B0A" }}>
      <div className="text-center">
        <p className="text-[#f87171] font-semibold mb-2">Vote link invalid</p>
        <p className="text-[#8B7355] text-sm">{error}</p>
      </div>
    </div>
  );

  if (!info) return null;

  if (info.alreadyVoted || info.expired) return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#0E0B0A" }}>
      <div className="text-center">
        <p className="text-[#fbbf24] font-semibold mb-2">{info.alreadyVoted ? "Already voted" : "Vote link expired"}</p>
        <p className="text-[#8B7355] text-sm">{info.alreadyVoted ? "This vote link has already been used." : "The voting deadline has passed."}</p>
      </div>
    </div>
  );

  const deadlineStr = new Date(info.deadline).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <div className="min-h-screen py-12 px-4" style={{ background: "#0E0B0A", color: "#EDE6DD" }}>
      <div className="max-w-xl mx-auto">
        <div className="text-center mb-8">
          <p className="text-[#C4704B] text-xs tracking-[4px] uppercase mb-1">Consensus Attestation Vote</p>
          <h1 className="text-2xl font-bold">cascrow</h1>
        </div>

        <div className="border border-[#C4704B]/30 rounded-xl p-8" style={{ background: "#171311" }}>
          <div className="mb-2">
            <span className="text-xs px-2 py-1 rounded text-[#C4704B] border border-[#C4704B]/30">
              {info.partyRole}
            </span>
          </div>

          <h2 className="text-xl font-semibold mt-3 mb-1">{info.milestoneTitle}</h2>
          {info.milestoneDescription && (
            <p className="text-[#8B7355] text-sm mb-4">{info.milestoneDescription}</p>
          )}

          <div className="flex items-center gap-2 mb-6 text-sm text-[#8B7355]">
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            Vote by {deadlineStr}
          </div>

          {info.aiVerdict && (
            <div className="mb-6 p-4 rounded-lg border border-[#C4704B]/20">
              <p className="text-xs text-[#8B7355] uppercase tracking-wider mb-2">AI Verification Result</p>
              <p className="text-sm font-bold mb-2" style={{ color: VERDICT_COLOR[info.aiVerdict] ?? "#fbbf24" }}>
                {VERDICT_LABEL[info.aiVerdict] ?? info.aiVerdict}
              </p>
              {info.aiReasoning && (
                <p className="text-sm text-[#D4B896] italic border-l-2 border-[#C4704B]/30 pl-3">{info.aiReasoning}</p>
              )}
            </div>
          )}

          <div className="mb-5">
            <label className="block text-sm text-[#8B7355] mb-1.5">Reasoning (optional, max 500 chars)</label>
            <textarea
              rows={3}
              maxLength={500}
              value={reasoning}
              onChange={(e) => setReasoning(e.target.value)}
              placeholder="Briefly explain your verdict…"
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none resize-none"
              style={{ background: "#0E0B0A", border: "1px solid #3A2D28", color: "#EDE6DD" }}
            />
          </div>

          {error && <p className="text-[#f87171] text-sm mb-4">{error}</p>}

          <div className="grid grid-cols-3 gap-3">
            {(["YES", "NO", "ABSTAIN"] as const).map((v) => (
              <button
                key={v}
                onClick={() => castVote(v)}
                disabled={voting}
                className="py-3 rounded-lg font-semibold text-sm transition-colors"
                style={{
                  background: v === "YES" ? "#14532D" : v === "NO" ? "#7f1d1d" : "#292524",
                  color: v === "YES" ? "#4ade80" : v === "NO" ? "#f87171" : "#a8a29e",
                  opacity: voting ? 0.6 : 1,
                  border: "1px solid",
                  borderColor: v === "YES" ? "#16a34a50" : v === "NO" ? "#dc262650" : "#44403c50",
                }}
              >
                {voting ? "…" : v === "ABSTAIN" ? "Abstain" : v}
              </button>
            ))}
          </div>
        </div>

        <p className="text-center text-xs text-[#5A4A3A] mt-6">
          Your vote is final and will be recorded on the XRP Ledger · cascrow.com
        </p>
      </div>
    </div>
  );
}
