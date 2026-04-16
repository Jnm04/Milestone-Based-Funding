"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { BuyRlusdModal } from "@/components/buy-rlusd-modal";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { NodeBackground } from "@/components/node-background";
import { CopyButton } from "@/components/copy-button";

const STATUS_LABELS: Record<string, string> = {
  DRAFT:            "Draft",
  AWAITING_ESCROW:  "Awaiting Escrow",
  FUNDED:           "Funded",
  PROOF_SUBMITTED:  "Proof Submitted",
  PENDING_REVIEW:   "Pending Review",
  VERIFIED:         "Verified",
  REJECTED:         "Rejected",
  DECLINED:         "Declined",
  EXPIRED:          "Expired",
  COMPLETED:        "Completed",
};

const STATUS_CLASS: Record<string, string> = {
  DRAFT:           "cs-badge cs-badge-draft",
  AWAITING_ESCROW: "cs-badge cs-badge-awaiting",
  FUNDED:          "cs-badge cs-badge-funded",
  PROOF_SUBMITTED: "cs-badge cs-badge-proof",
  PENDING_REVIEW:  "cs-badge cs-badge-review",
  VERIFIED:        "cs-badge cs-badge-verified",
  REJECTED:        "cs-badge cs-badge-rejected",
  DECLINED:        "cs-badge cs-badge-rejected",
  EXPIRED:         "cs-badge cs-badge-draft",
  COMPLETED:       "cs-badge cs-badge-completed",
};

interface Contract {
  id: string;
  milestone: string;
  amountUSD: string;
  status: string;
  inviteLink: string | null;
  startup: { walletAddress: string | null } | null;
  milestones: { status: string }[];
  createdAt: string;
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div
      className="flex flex-col gap-2 p-5 rounded-xl"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(196,112,75,0.12)" }}
    >
      <p className="text-xs uppercase tracking-wide" style={{ color: "#A89B8C" }}>{label}</p>
      <p className="text-3xl font-semibold" style={{ color: "#EDE6DD", fontFamily: "var(--font-libre-franklin)", fontWeight: 300 }}>
        {value}
      </p>
      {sub && <p className="text-xs" style={{ color: "#A89B8C" }}>{sub}</p>}
    </div>
  );
}

function IconPlus() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

const LS_KEY = "cascrow_hidden_contracts";

function IconEyeOff() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}

export default function InvestorDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loadingContracts, setLoadingContracts] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [showHidden, setShowHidden] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalContracts, setTotalContracts] = useState(0);
  const PAGE_SIZE = 20;

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LS_KEY);
      if (stored) setHiddenIds(new Set(JSON.parse(stored)));
    } catch {}
  }, []);

  function hideContract(id: string) {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      localStorage.setItem(LS_KEY, JSON.stringify([...next]));
      return next;
    });
  }

  function unhideContract(id: string) {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      localStorage.setItem(LS_KEY, JSON.stringify([...next]));
      return next;
    });
  }

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated" && session.user.role !== "INVESTOR") router.push("/dashboard/startup");
  }, [status, session, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    setLoadingContracts(true);
    fetch(`/api/contracts?page=${page}&limit=${PAGE_SIZE}`)
      .then((r) => r.json())
      .then((data) => {
        setContracts(data.contracts ?? []);
        setTotalPages(data.pages ?? 1);
        setTotalContracts(data.total ?? 0);
      })
      .catch(() => toast.error("Could not load contracts."))
      .finally(() => setLoadingContracts(false));
  }, [status, page]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#171311" }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: "rgba(196,112,75,0.3)", borderTopColor: "#C4704B" }} />
          <p className="text-sm" style={{ color: "#A89B8C" }}>Loading…</p>
        </div>
      </div>
    );
  }
  if (!session) return null;

  const walletAddress = session.user.walletAddress;

  // Compute stats
  const active    = contracts.filter((c) => !["COMPLETED", "EXPIRED", "DECLINED"].includes(c.status)).length;
  const completed = contracts.filter((c) => c.status === "COMPLETED").length;
  const pending   = contracts.filter((c) => c.status === "PENDING_REVIEW").length;
  const totalLocked = contracts
    .filter((c) => ["FUNDED", "PROOF_SUBMITTED", "PENDING_REVIEW", "VERIFIED"].includes(c.status))
    .reduce((s, c) => s + Number(c.amountUSD), 0);

  return (
    <div className="flex min-h-screen" style={{ background: "#171311" }}>
      <NodeBackground />
      <DashboardSidebar role="investor" />

      {/* Main */}
      <main className="flex-1 flex flex-col min-h-screen overflow-x-hidden pb-20 md:pb-0">
        {/* Header */}
        <div
          className="px-6 md:px-10 py-8 border-b flex flex-col sm:flex-row sm:items-center gap-4"
          style={{ borderColor: "rgba(196,112,75,0.1)" }}
        >
          <div className="flex-1">
            <h1
              className="text-3xl"
              style={{ fontFamily: "var(--font-libre-franklin)", fontWeight: 300, color: "#EDE6DD" }}
            >
              Dashboard
            </h1>
            <p className="text-sm mt-1" style={{ color: "#A89B8C" }}>Overview of your contracts and milestones</p>
          </div>
          {walletAddress && (
            <div className="flex items-center gap-3">
              <BuyRlusdModal walletAddress={walletAddress} />
              <Link
                href={`/contract/new?investor=${walletAddress}`}
                className="cs-btn-primary cs-btn-sm"
              >
                <IconPlus />
                New Contract
              </Link>
            </div>
          )}
        </div>

        <div className="px-6 md:px-10 py-8 flex flex-col gap-8">
          {/* Wallet missing */}
          {!walletAddress ? (
            <div
              className="flex flex-col gap-4 p-6 rounded-xl"
              style={{ background: "rgba(196,112,75,0.06)", border: "1px solid rgba(196,112,75,0.2)" }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: "rgba(196,112,75,0.12)" }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C4704B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: "#EDE6DD" }}>Connect your EVM Wallet</p>
                  <p className="text-xs mt-1" style={{ color: "#A89B8C" }}>Add your MetaMask address (0x…) in your profile to create contracts.</p>
                </div>
              </div>
              <Link href="/profile" className="cs-btn-ghost cs-btn-sm self-start">
                Go to Profile →
              </Link>
            </div>
          ) : (
            <>
              {/* Wallet card */}
              <div
                className="flex items-center gap-3 p-4 rounded-xl"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(196,112,75,0.12)" }}
              >
                <div className="w-2 h-2 rounded-full animate-pulse-dot" style={{ background: "#34d399" }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs" style={{ color: "#A89B8C" }}>EVM Wallet (MetaMask)</p>
                  <code className="text-sm break-all" style={{ color: "#EDE6DD", fontFamily: "monospace" }}>{walletAddress}</code>
                </div>
                <span className="cs-badge cs-badge-completed">Connected</span>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Total Locked"          value={totalLocked > 0 ? `$${totalLocked.toLocaleString()}` : "—"} sub="RLUSD in active escrow" />
                <StatCard label="Active Contracts"      value={active} />
                <StatCard label="Milestones Completed"  value={completed} />
                <StatCard label="Pending Reviews"       value={pending} />
              </div>

              {/* Pending review alert */}
              {pending > 0 && (
                <div
                  className="flex items-start gap-4 p-5 rounded-xl"
                  style={{ background: "rgba(196,112,75,0.08)", border: "1px solid rgba(196,112,75,0.4)" }}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-sm"
                    style={{ background: "rgba(196,112,75,0.18)" }}
                  >
                    ⚠
                  </div>
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-semibold" style={{ color: "#E8935A" }}>
                      {pending} contract{pending > 1 ? "s" : ""} require your manual review
                    </p>
                    <p className="text-xs" style={{ color: "#A89B8C" }}>
                      The AI was not confident enough for an automatic decision. Open each contract and approve or reject manually.
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {contracts
                        .filter((c) => c.status === "PENDING_REVIEW")
                        .map((c) => (
                          <Link
                            key={c.id}
                            href={`/contract/${c.id}?investor=${walletAddress}`}
                            className="text-xs px-3 py-1 rounded-lg font-medium transition-colors"
                            style={{
                              background: "rgba(196,112,75,0.15)",
                              border: "1px solid rgba(196,112,75,0.3)",
                              color: "#C4704B",
                            }}
                          >
                            {c.milestone.slice(0, 40)}{c.milestone.length > 40 ? "…" : ""} →
                          </Link>
                        ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Contracts list */}
          {walletAddress && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold" style={{ color: "#EDE6DD" }}>Your Contracts</h2>
                <div className="flex items-center gap-3">
                  {hiddenIds.size > 0 && (
                    <button
                      onClick={() => setShowHidden((v) => !v)}
                      className="text-xs"
                      style={{ color: "#A89B8C" }}
                    >
                      {showHidden ? "Hide archived" : `Show archived (${hiddenIds.size})`}
                    </button>
                  )}
                  <span className="text-sm" style={{ color: "#A89B8C" }}>{totalContracts} total</span>
                </div>
              </div>

              {loadingContracts && (
                <div className="flex items-center gap-3 py-8 justify-center">
                  <div className="w-5 h-5 rounded-full border-2 animate-spin" style={{ borderColor: "rgba(196,112,75,0.3)", borderTopColor: "#C4704B" }} />
                  <p className="text-sm" style={{ color: "#A89B8C" }}>Loading…</p>
                </div>
              )}

              {!loadingContracts && contracts.length === 0 && totalContracts === 0 && (
                <div
                  className="p-10 rounded-xl text-center flex flex-col items-center gap-3"
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(196,112,75,0.1)" }}
                >
                  <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "rgba(196,112,75,0.08)" }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C4704B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                    </svg>
                  </div>
                  <p className="text-sm font-medium" style={{ color: "#EDE6DD" }}>No contracts yet</p>
                  <p className="text-xs" style={{ color: "#A89B8C" }}>Create your first contract to get started.</p>
                  <Link href={`/contract/new?investor=${walletAddress}`} className="cs-btn-ghost cs-btn-sm mt-2">
                    + Create New Contract
                  </Link>
                </div>
              )}

              {/* Pagination controls */}
              {!loadingContracts && totalPages > 1 && (
                <div className="flex items-center justify-between mt-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="cs-btn-ghost cs-btn-sm"
                    style={{ opacity: page <= 1 ? 0.4 : 1 }}
                  >
                    ← Prev
                  </button>
                  <span className="text-xs" style={{ color: "#A89B8C" }}>
                    Page {page} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="cs-btn-ghost cs-btn-sm"
                    style={{ opacity: page >= totalPages ? 0.4 : 1 }}
                  >
                    Next →
                  </button>
                </div>
              )}

              {/* Table header */}
              {!loadingContracts && contracts.length > 0 && (
                <div
                  className="rounded-xl overflow-hidden"
                  style={{ border: "1px solid rgba(196,112,75,0.1)" }}
                >
                  {/* Table header row */}
                  <div
                    className="hidden md:grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-4 px-5 py-3 text-xs uppercase tracking-wide"
                    style={{ background: "rgba(255,255,255,0.02)", color: "#A89B8C", borderBottom: "1px solid rgba(196,112,75,0.08)" }}
                  >
                    <span>Contract</span>
                    <span>Receiver</span>
                    <span>Amount</span>
                    <span>Status</span>
                    <span>Actions</span>
                    <span></span>
                  </div>

                  {contracts.filter((c) => showHidden || !hiddenIds.has(c.id)).map((c, idx, arr) => {
                    const isHidden    = hiddenIds.has(c.id);
                    const totalMs     = c.milestones.length;
                    const completedMs = c.milestones.filter((m) => m.status === "COMPLETED").length;
                    const pct         = totalMs > 0 ? Math.round((completedMs / totalMs) * 100) : 0;
                    return (
                      <div
                        key={c.id}
                        className="group px-5 py-4 transition-all"
                        style={{
                          background: isHidden ? "rgba(255,255,255,0.01)" : "transparent",
                          borderBottom: idx < arr.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                          opacity: isHidden ? 0.4 : 1,
                        }}
                        onMouseOver={(e) => { if (!isHidden) (e.currentTarget as HTMLDivElement).style.background = "rgba(196,112,75,0.04)"; }}
                        onMouseOut={(e) => { (e.currentTarget as HTMLDivElement).style.background = isHidden ? "rgba(255,255,255,0.01)" : "transparent"; }}
                      >
                        {/* Mobile layout */}
                        <div className="flex flex-col gap-2 md:hidden">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium line-clamp-2 flex-1" style={{ color: "#EDE6DD" }}>{c.milestone}</p>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className={STATUS_CLASS[c.status] ?? "cs-badge cs-badge-draft"}>
                                {STATUS_LABELS[c.status] ?? c.status}
                              </span>
                              <button
                                onClick={() => isHidden ? unhideContract(c.id) : hideContract(c.id)}
                                title={isHidden ? "Unhide" : "Hide from list"}
                                style={{ color: "#6B5E52", lineHeight: 1 }}
                              >
                                <IconEyeOff />
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 text-xs" style={{ color: "#A89B8C" }}>
                            <span><strong style={{ color: "#EDE6DD" }}>${Number(c.amountUSD).toLocaleString()}</strong> RLUSD</span>
                            {totalMs > 1 && <span>{completedMs}/{totalMs} milestones</span>}
                          </div>
                          {totalMs > 1 && (
                            <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: "linear-gradient(90deg,#C4704B,#D4B896)" }} />
                            </div>
                          )}
                          {!isHidden && (
                            <div className="flex items-center gap-3">
                              <Link
                                href={`/contract/${c.id}?investor=${walletAddress}`}
                                className="text-xs font-medium self-start"
                                style={{ color: "#C4704B" }}
                              >
                                View →
                              </Link>
                              {c.status === "DRAFT" && c.inviteLink && (
                                <div className="flex items-center gap-1" title="Copy invite link">
                                  <CopyButton text={`${window.location.origin}/dashboard/startup?invite=${c.inviteLink}`} />
                                  <span className="text-xs" style={{ color: "#A89B8C" }}>Copy invite</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Desktop layout */}
                        <div className="hidden md:grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-4 items-center">
                          <div className="flex flex-col gap-1.5 min-w-0">
                            <p className="text-sm font-medium truncate" style={{ color: "#EDE6DD" }}>{c.milestone}</p>
                            {totalMs > 1 && (
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "linear-gradient(90deg,#C4704B,#D4B896)" }} />
                                </div>
                                <span className="text-xs shrink-0" style={{ color: "#A89B8C" }}>{pct}%</span>
                              </div>
                            )}
                          </div>
                          <span className="text-xs font-mono" style={{ color: "#A89B8C" }}>
                            {c.startup?.walletAddress
                              ? `${c.startup.walletAddress.slice(0, 8)}…`
                              : <em>not accepted</em>}
                          </span>
                          <span className="text-sm font-semibold" style={{ color: "#EDE6DD" }}>
                            ${Number(c.amountUSD).toLocaleString()}
                            <span className="text-xs font-normal ml-1" style={{ color: "#A89B8C" }}>RLUSD</span>
                          </span>
                          <span className={STATUS_CLASS[c.status] ?? "cs-badge cs-badge-draft"}>
                            {STATUS_LABELS[c.status] ?? c.status}
                          </span>
                          {!isHidden ? (
                            <div className="flex items-center gap-2">
                              <Link
                                href={`/contract/${c.id}?investor=${walletAddress}`}
                                className="text-sm font-medium transition-colors hover:underline"
                                style={{ color: "#C4704B" }}
                              >
                                View
                              </Link>
                              {c.status === "DRAFT" && c.inviteLink && (
                                <CopyButton text={`${window.location.origin}/dashboard/startup?invite=${c.inviteLink}`} />
                              )}
                            </div>
                          ) : (
                            <span />
                          )}
                          <button
                            onClick={() => isHidden ? unhideContract(c.id) : hideContract(c.id)}
                            title={isHidden ? "Unhide" : "Hide from list"}
                            style={{ color: "#6B5E52", lineHeight: 1, transition: "color 0.15s" }}
                            onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#A89B8C"; }}
                            onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#6B5E52"; }}
                          >
                            <IconEyeOff />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
