"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { WalletConnect } from "@/components/wallet-connect";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Suspense } from "react";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { NodeBackground } from "@/components/node-background";

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
  investor: { walletAddress: string | null };
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

function StartupDashboardContent() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteCode = searchParams.get("invite");

  const [joining,      setJoining]      = useState(false);
  const [declining,    setDeclining]    = useState(false);
  const [savingWallet, setSavingWallet] = useState(false);
  const [contracts,    setContracts]    = useState<Contract[]>([]);
  const [loadingContracts, setLoadingContracts] = useState(false);
  const [hiddenIds,    setHiddenIds]    = useState<Set<string>>(new Set());
  const [showHidden,   setShowHidden]   = useState(false);
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
  const [preview, setPreview] = useState<{
    id: string;
    milestone: string;
    amountUSD: string;
    cancelAfter: string;
    investorWallet: string | null;
    milestones: Array<{ id: string; title: string; amountUSD: string; cancelAfter: string; order: number }>;
  } | null>(null);

  useEffect(() => {
    if (!inviteCode) return;
    fetch(`/api/contracts/preview?invite=${inviteCode}`)
      .then((r) => r.json())
      .then((data) => { if (!data.error) setPreview(data); })
      .catch(() => {});
  }, [inviteCode]);

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

  useEffect(() => {
    if (status === "unauthenticated") {
      const callbackUrl = inviteCode
        ? `/dashboard/startup?invite=${inviteCode}`
        : "/dashboard/startup";
      router.push(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
    }
    if (status === "authenticated" && session.user.role !== "STARTUP" && !inviteCode)
      router.push("/dashboard/investor");
  }, [status, session, router, inviteCode]);

  async function handleWalletConnected(address: string) {
    setSavingWallet(true);
    try {
      const res = await fetch("/api/user/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: address }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to save wallet");
      }
      await update({ walletAddress: address });
      toast.success("Wallet connected!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save wallet.");
    } finally {
      setSavingWallet(false);
    }
  }

  async function handleDeclineContract() {
    if (!inviteCode) return;
    setDeclining(true);
    try {
      await fetch("/api/contracts/decline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode }),
      });
      toast.success("Invitation declined.");
      window.location.href = "/dashboard/startup";
    } catch {
      toast.error("Failed to decline invitation.");
    } finally {
      setDeclining(false);
    }
  }

  async function handleJoinContract() {
    if (!session?.user.walletAddress || !inviteCode) return;
    setJoining(true);
    try {
      const res = await fetch("/api/contracts/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to join contract");
      }
      const { contractId } = await res.json();
      toast.success("You have joined the contract!");
      window.location.href = `/contract/${contractId}?startup=${session.user.walletAddress}`;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to join.");
    } finally {
      setJoining(false);
    }
  }

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

  /* ── Wrong role on invite ── */
  if (session.user.role !== "STARTUP" && inviteCode) {
    return (
      <main
        className="min-h-screen flex items-center justify-center px-4"
        style={{ background: "#171311" }}
      >
        <div
          className="w-full max-w-sm flex flex-col items-center gap-5 p-8 rounded-2xl text-center"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(196,112,75,0.15)" }}
        >
          <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "rgba(248,113,113,0.1)" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <p className="text-lg font-semibold" style={{ color: "#EDE6DD" }}>Wrong account</p>
          <p className="text-sm leading-relaxed" style={{ color: "#A89B8C" }}>
            You&apos;re logged in as a <strong style={{ color: "#EDE6DD" }}>Grant Giver</strong>.
            This invite link is for a <strong style={{ color: "#EDE6DD" }}>Receiver</strong> account.
          </p>
          <button
            onClick={() => signOut({ callbackUrl: `/dashboard/startup?invite=${inviteCode}` })}
            className="cs-btn-primary w-full"
          >
            Sign out & switch account
          </button>
          <Link href="/dashboard/investor" className="text-sm" style={{ color: "#A89B8C" }}>
            Back to my dashboard
          </Link>
        </div>
      </main>
    );
  }

  const walletAddress = session.user.walletAddress;
  const active    = contracts.filter((c) => !["COMPLETED", "EXPIRED", "DECLINED"].includes(c.status)).length;
  const completed = contracts.filter((c) => c.status === "COMPLETED").length;
  const pending   = contracts.filter((c) => ["FUNDED", "PROOF_SUBMITTED"].includes(c.status)).length;

  return (
    <div className="flex min-h-screen" style={{ background: "#171311" }}>
      <NodeBackground />
      <DashboardSidebar role="startup" />

      <main className="flex-1 flex flex-col min-h-screen overflow-x-hidden pb-20 md:pb-0">
        {/* Header */}
        <div
          className="px-6 md:px-10 py-8 border-b"
          style={{ borderColor: "rgba(196,112,75,0.1)" }}
        >
          <h1
            className="text-3xl"
            style={{ fontFamily: "var(--font-libre-franklin)", fontWeight: 300, color: "#EDE6DD" }}
          >
            Receiver Dashboard
          </h1>
          <p className="text-sm mt-1" style={{ color: "#A89B8C" }}>
            {inviteCode
              ? "Connect your wallet to accept the contract invitation."
              : walletAddress
              ? "Your active contracts and milestones."
              : "Connect your EVM wallet to get started."}
          </p>
        </div>

        <div className="px-6 md:px-10 py-8 flex flex-col gap-8">

          {/* ── Contract invitation ── */}
          {inviteCode && (
            <div
              className="flex flex-col gap-5 p-6 rounded-xl"
              style={{ background: "rgba(196,112,75,0.05)", border: "1px solid #C4704B", borderTop: "2px solid #C4704B" }}
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(196,112,75,0.15)" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C4704B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: "#EDE6DD" }}>Contract Invitation</p>
                  <p className="text-xs mt-0.5" style={{ color: "#A89B8C" }}>You have been invited to join a contract</p>
                </div>
              </div>

              {preview ? (
                <div className="flex flex-col gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide mb-1" style={{ color: "#A89B8C" }}>Milestone</p>
                    <p className="text-sm leading-relaxed" style={{ color: "#EDE6DD" }}>{preview.milestone}</p>
                  </div>
                  <div className="flex flex-wrap gap-6 text-sm">
                    <div>
                      <p className="text-xs uppercase tracking-wide mb-1" style={{ color: "#A89B8C" }}>Amount</p>
                      <p className="font-semibold" style={{ color: "#C4704B" }}>${Number(preview.amountUSD).toLocaleString()} RLUSD</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide mb-1" style={{ color: "#A89B8C" }}>Deadline</p>
                      <p style={{ color: "#EDE6DD" }}>{new Date(preview.cancelAfter).toLocaleDateString()}</p>
                    </div>
                    {preview.investorWallet && (
                      <div>
                        <p className="text-xs uppercase tracking-wide mb-1" style={{ color: "#A89B8C" }}>Grant Giver</p>
                        <code className="text-xs font-mono" style={{ color: "#EDE6DD" }}>{preview.investorWallet.slice(0, 12)}…</code>
                      </div>
                    )}
                  </div>

                  {preview.milestones?.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <p className="text-xs uppercase tracking-wide" style={{ color: "#A89B8C" }}>
                        Milestones ({preview.milestones.length})
                      </p>
                      <div className="flex flex-col gap-2">
                        {preview.milestones.map((ms, idx) => (
                          <div
                            key={ms.id}
                            className="flex items-start gap-3 p-3 rounded-lg"
                            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(196,112,75,0.1)" }}
                          >
                            <div
                              className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                              style={{ background: "rgba(196,112,75,0.15)", color: "#C4704B" }}
                            >
                              {idx + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold" style={{ color: "#EDE6DD" }}>{ms.title}</p>
                              <div className="flex gap-4 mt-0.5 text-xs" style={{ color: "#A89B8C" }}>
                                <span><strong style={{ color: "#EDE6DD" }}>${Number(ms.amountUSD).toLocaleString()}</strong> RLUSD</span>
                                <span>until {new Date(ms.cancelAfter).toLocaleDateString()}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: "rgba(196,112,75,0.3)", borderTopColor: "#C4704B" }} />
                  <p className="text-sm" style={{ color: "#A89B8C" }}>Loading contract…</p>
                </div>
              )}

              {walletAddress && (
                <div className="flex gap-3">
                  <button
                    onClick={handleJoinContract}
                    disabled={joining}
                    className="cs-btn-primary cs-btn-sm"
                  >
                    {joining ? "Joining…" : "Accept Invitation"}
                  </button>
                  <button
                    onClick={handleDeclineContract}
                    disabled={joining || declining}
                    className="cs-btn-ghost cs-btn-sm"
                    style={{ borderColor: "rgba(248,113,113,0.4)", color: "#f87171" }}
                  >
                    {declining ? "Declining…" : "Decline"}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Wallet connect ── */}
          {!walletAddress ? (
            <div
              className="flex flex-col gap-5 p-6 rounded-xl"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(196,112,75,0.15)" }}
            >
              <div>
                <p className="text-sm font-semibold mb-1" style={{ color: "#EDE6DD" }}>Connect your EVM wallet via MetaMask</p>
                <p className="text-xs" style={{ color: "#A89B8C" }}>You only need to do this once.</p>
              </div>
              <WalletConnect role="STARTUP" onConnected={handleWalletConnected} />
              {savingWallet && (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: "rgba(196,112,75,0.3)", borderTopColor: "#C4704B" }} />
                  <p className="text-xs" style={{ color: "#A89B8C" }}>Saving wallet…</p>
                </div>
              )}
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
                  <code className="text-sm" style={{ color: "#EDE6DD", fontFamily: "monospace" }}>{walletAddress}</code>
                </div>
                <span className="cs-badge cs-badge-completed">Connected</span>
              </div>

              {/* Stats */}
              {!inviteCode && (
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                  <StatCard label="Active Contracts"    value={active} />
                  <StatCard label="Milestones Pending"  value={pending} />
                  <StatCard label="Completed"           value={completed} />
                </div>
              )}
            </>
          )}

          {/* ── Contracts list ── */}
          {walletAddress && !inviteCode && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold" style={{ color: "#EDE6DD" }}>My Contracts</h2>
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
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                      <polyline points="22,6 12,13 2,6"/>
                    </svg>
                  </div>
                  <p className="text-sm font-medium" style={{ color: "#EDE6DD" }}>No contracts yet</p>
                  <p className="text-xs" style={{ color: "#A89B8C" }}>Wait for an invite link from your Grant Giver.</p>
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

              {!loadingContracts && contracts.length > 0 && (
                <div
                  className="rounded-xl overflow-hidden"
                  style={{ border: "1px solid rgba(196,112,75,0.1)" }}
                >
                  {contracts.filter((c) => showHidden || !hiddenIds.has(c.id)).map((c, idx, arr) => {
                    const isHidden    = hiddenIds.has(c.id);
                    const totalMs     = c.milestones.length;
                    const completedMs = c.milestones.filter((m) => m.status === "COMPLETED").length;
                    const pct         = totalMs > 0 ? Math.round((completedMs / totalMs) * 100) : 0;
                    return (
                      <div
                        key={c.id}
                        className="px-5 py-4 flex flex-col gap-2 transition-all"
                        style={{
                          borderBottom: idx < arr.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                          opacity: isHidden ? 0.4 : 1,
                        }}
                        onMouseOver={(e) => { if (!isHidden) (e.currentTarget as HTMLDivElement).style.background = "rgba(196,112,75,0.04)"; }}
                        onMouseOut={(e) => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-medium leading-snug line-clamp-2 flex-1" style={{ color: "#EDE6DD" }}>
                            {c.milestone}
                          </p>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={STATUS_CLASS[c.status] ?? "cs-badge cs-badge-draft"}>
                              {STATUS_LABELS[c.status] ?? c.status}
                            </span>
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
                        {totalMs > 1 && (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "linear-gradient(90deg,#C4704B,#D4B896)" }} />
                            </div>
                            <span className="text-xs" style={{ color: "#A89B8C" }}>{completedMs}/{totalMs}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-4 text-xs" style={{ color: "#A89B8C" }}>
                          <span>
                            <strong style={{ color: "#EDE6DD" }}>${Number(c.amountUSD).toLocaleString()}</strong> RLUSD
                          </span>
                          <span>
                            Grant Giver:{" "}
                            <code className="font-mono">{c.investor.walletAddress?.slice(0, 8)}…</code>
                          </span>
                          {!isHidden && (
                            <Link
                              href={`/contract/${c.id}?startup=${walletAddress}`}
                              className="ml-auto font-medium transition-colors hover:underline"
                              style={{ color: "#C4704B" }}
                            >
                              View →
                            </Link>
                          )}
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

export default function StartupDashboard() {
  return (
    <Suspense>
      <StartupDashboardContent />
    </Suspense>
  );
}
