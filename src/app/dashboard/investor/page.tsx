"use client";

import { useEffect, useRef, useState } from "react";
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
  cancelAfter: string;
  inviteLink: string | null;
  startup: { walletAddress: string | null } | null;
  milestones: { status: string; cancelAfter: string }[];
  healthNote: string | null;
  healthNoteUpdatedAt: string | null;
  createdAt: string;
  mode: string;
}

type DealHealth = "GREEN" | "YELLOW" | "RED";

function dealHealth(contract: Contract): DealHealth {
  const terminal = ["COMPLETED", "EXPIRED", "DECLINED", "DRAFT"];
  if (terminal.includes(contract.status)) return "GREEN";
  if (contract.status === "RENEGOTIATING") return "RED";

  const active = contract.milestones.find(
    (m) => !["COMPLETED", "PENDING"].includes(m.status)
  );
  const deadline = active?.cancelAfter ?? contract.cancelAfter;
  if (new Date(deadline) < new Date()) return "RED";

  const daysLeft = (new Date(deadline).getTime() - Date.now()) / 86_400_000;
  if (daysLeft <= 7 && ["AWAITING_ESCROW", "FUNDED"].includes(contract.status)) return "YELLOW";
  return "GREEN";
}

const HEALTH_CONFIG: Record<DealHealth, { color: string; label: string; bg: string; border: string }> = {
  GREEN:  { color: "#34d399", label: "On Track",  bg: "rgba(52,211,153,0.12)",  border: "rgba(52,211,153,0.3)"  },
  YELLOW: { color: "#f59e0b", label: "Watch",     bg: "rgba(245,158,11,0.12)",  border: "rgba(245,158,11,0.3)"  },
  RED:    { color: "#f87171", label: "At Risk",   bg: "rgba(248,113,113,0.12)", border: "rgba(248,113,113,0.3)" },
};

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
const NOTE_TTL_MS = 24 * 60 * 60 * 1000;

function HealthDot({ contract }: { contract: Contract }) {
  const health = dealHealth(contract);
  const cfg = HEALTH_CONFIG[health];

  // Don't show dot for terminal / draft statuses — return empty span to hold the grid column
  if (["COMPLETED", "EXPIRED", "DECLINED", "DRAFT"].includes(contract.status)) return <span />;

  const [note, setNote] = useState<string | null>(null);
  const [noteLoading, setNoteLoading] = useState(false);
  const [hovered, setHovered] = useState(false);

  // Use cached note from contract data if fresh
  const cachedFresh =
    contract.healthNote &&
    contract.healthNoteUpdatedAt &&
    Date.now() - new Date(contract.healthNoteUpdatedAt).getTime() < NOTE_TTL_MS;

  function handleMouseEnter() {
    setHovered(true);
    if (cachedFresh && !note) {
      setNote(contract.healthNote);
      return;
    }
    if (!note && !noteLoading && !cachedFresh) {
      setNoteLoading(true);
      fetch(`/api/contracts/${contract.id}/health`)
        .then((r) => r.json())
        .then((d: { note?: string | null }) => { if (d.note) setNote(d.note); })
        .catch(() => {})
        .finally(() => setNoteLoading(false));
    }
  }

  return (
    <div
      className="relative flex items-center gap-1.5 select-none"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className="w-2 h-2 rounded-full shrink-0"
        style={{ background: cfg.color, boxShadow: `0 0 5px ${cfg.color}55` }}
      />
      <span className="text-xs font-medium hidden sm:inline" style={{ color: cfg.color }}>
        {cfg.label}
      </span>

      {/* Tooltip */}
      {hovered && (
        <div
          className="absolute z-50 bottom-full left-0 mb-2 p-3 rounded-xl text-xs max-w-xs pointer-events-none"
          style={{
            background: "#1F1A18",
            border: `1px solid ${cfg.border}`,
            color: "#EDE6DD",
            width: "220px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          }}
        >
          <div className="flex items-center gap-1.5 mb-1.5">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: cfg.color }} />
            <span className="font-semibold" style={{ color: cfg.color }}>{cfg.label}</span>
          </div>
          {noteLoading ? (
            <span style={{ color: "#A89B8C" }}>Loading insight…</span>
          ) : note ? (
            <span style={{ color: "#C8BEAF" }}>{note}</span>
          ) : (
            <span style={{ color: "#A89B8C" }}>Hover again for AI insight.</span>
          )}
        </div>
      )}
    </div>
  );
}

function IconEyeOff() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}

// ── Transparency Report Modal ────────────────────────────────────────────────

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2];
const QUARTERS = ["Q1", "Q2", "Q3", "Q4"] as const;

function IconFileText() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  );
}

function IconX() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}

function IconExternalLink() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
      <polyline points="15 3 21 3 21 9"/>
      <line x1="10" y1="14" x2="21" y2="3"/>
    </svg>
  );
}

function TransparencyReportModal({ onClose }: { onClose: () => void }) {
  const currentQ = `Q${Math.ceil((new Date().getMonth() + 1) / 3)}` as typeof QUARTERS[number];
  const [quarter, setQuarter] = useState<typeof QUARTERS[number]>(
    QUARTERS.includes(currentQ) ? currentQ : "Q1"
  );
  const [year, setYear]       = useState(CURRENT_YEAR);
  const [loading, setLoading] = useState(false);
  const [reportUrl, setReportUrl] = useState<string | null>(null);
  const [cached, setCached]       = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on backdrop click
  function handleBackdrop(e: React.MouseEvent) {
    if (e.target === overlayRef.current) onClose();
  }

  async function generate() {
    setLoading(true);
    setReportUrl(null);
    try {
      const res = await fetch("/api/dashboard/investor/transparency-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quarter, year }),
      });
      const data = await res.json() as { period?: string; cached?: boolean; error?: string };
      if (!res.ok || !data.period) {
        toast.error(data.error ?? "Failed to generate report.");
        return;
      }
      setReportUrl(`/api/dashboard/investor/transparency-report?period=${encodeURIComponent(data.period)}`);
      setCached(data.cached ?? false);
      toast.success(data.cached ? "Report loaded from cache." : "Report generated successfully.");
    } catch {
      toast.error("Could not reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      ref={overlayRef}
      onClick={handleBackdrop}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(3px)" }}
    >
      <div
        className="relative w-full max-w-md rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: "#1F1A18",
          border: "1px solid rgba(196,112,75,0.25)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
        }}
      >
        {/* Header */}
        <div
          className="px-6 py-5 flex items-center justify-between"
          style={{ borderBottom: "1px solid rgba(196,112,75,0.12)" }}
        >
          <div className="flex flex-col gap-0.5">
            <h2
              className="text-base font-semibold"
              style={{ color: "#EDE6DD", fontFamily: "var(--font-libre-franklin)", fontWeight: 400 }}
            >
              Stakeholder Transparency Report
            </h2>
            <p className="text-xs" style={{ color: "#A89B8C" }}>
              Board-ready quarterly report for investors, DAOs & donors
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: "#6B5E52" }}
            onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#A89B8C"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)"; }}
            onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#6B5E52"; (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
          >
            <IconX />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-6 flex flex-col gap-5">
          {/* Period selectors */}
          <div className="flex flex-col gap-2">
            <label
              className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: "#A89B8C", letterSpacing: "0.12em" }}
            >
              Report Period
            </label>
            <div className="flex gap-3">
              {/* Quarter */}
              <div className="flex gap-1.5">
                {QUARTERS.map((q) => (
                  <button
                    key={q}
                    onClick={() => setQuarter(q)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={{
                      background: quarter === q ? "rgba(196,112,75,0.2)" : "rgba(255,255,255,0.04)",
                      border: quarter === q ? "1px solid rgba(196,112,75,0.5)" : "1px solid rgba(255,255,255,0.07)",
                      color: quarter === q ? "#C4704B" : "#A89B8C",
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>
              {/* Year */}
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  color: "#EDE6DD",
                }}
              >
                {YEARS.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          {/* What's included note */}
          <div
            className="rounded-xl p-4"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(196,112,75,0.1)" }}
          >
            <p className="text-xs" style={{ color: "#A89B8C", lineHeight: 1.6 }}>
              Includes <strong style={{ color: "#C8BEAF" }}>all contracts active in this period</strong> — milestone outcomes, RLUSD deployed &amp; released, AI confidence scores, on-chain references, and an AI-generated executive narrative.
            </p>
          </div>

          {/* Report URL result */}
          {reportUrl && (
            <div
              className="rounded-xl p-4 flex flex-col gap-3"
              style={{ background: "rgba(22,163,74,0.06)", border: "1px solid rgba(22,163,74,0.2)" }}
            >
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: "#34d399" }} />
                <p className="text-xs font-semibold" style={{ color: "#34d399" }}>
                  {cached ? "Loaded from cache" : "Report ready"}
                </p>
              </div>
              <div className="flex gap-2">
                <a
                  href={reportUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    background: "rgba(196,112,75,0.16)",
                    border: "1px solid rgba(196,112,75,0.35)",
                    color: "#C4704B",
                  }}
                >
                  <IconExternalLink />
                  Open Report
                </a>
                <button
                  onClick={async () => {
                    await navigator.clipboard.writeText(reportUrl).catch(() => {});
                    toast.success("Report link copied.");
                  }}
                  className="px-4 py-2 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "#A89B8C",
                  }}
                >
                  Copy link
                </button>
              </div>
              {!cached && (
                <p className="text-xs" style={{ color: "#6B7280" }}>
                  Cached for this quarter — re-generating will return this report.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-6 py-4 flex items-center justify-between gap-3"
          style={{ borderTop: "1px solid rgba(196,112,75,0.1)" }}
        >
          <button
            onClick={onClose}
            className="cs-btn-ghost cs-btn-sm"
          >
            Cancel
          </button>
          <button
            onClick={generate}
            disabled={loading}
            className="cs-btn-primary cs-btn-sm flex items-center gap-2"
            style={{ opacity: loading ? 0.7 : 1 }}
          >
            {loading ? (
              <>
                <div className="w-3.5 h-3.5 rounded-full border-2 animate-spin" style={{ borderColor: "rgba(255,255,255,0.3)", borderTopColor: "#fff" }} />
                Generating…
              </>
            ) : (
              <>
                <IconFileText />
                Generate {quarter} {year} Report
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────

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
  const [showReportModal, setShowReportModal] = useState(false);
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
      {showReportModal && <TransparencyReportModal onClose={() => setShowReportModal(false)} />}

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
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => setShowReportModal(true)}
              className="cs-btn-ghost cs-btn-sm flex items-center gap-1.5"
              title="Generate quarterly stakeholder transparency report"
            >
              <IconFileText />
              <span className="hidden sm:inline">Generate Report</span>
            </button>
            {walletAddress && (
              <>
                <BuyRlusdModal walletAddress={walletAddress} />
                <Link
                  href={`/contract/new?investor=${walletAddress}`}
                  className="cs-btn-primary cs-btn-sm"
                >
                  <IconPlus />
                  New Contract
                </Link>
              </>
            )}
          </div>
        </div>

        <div className="px-6 md:px-10 py-8 flex flex-col gap-8">

          {/* First-run onboarding checklist — shown when wallet connected but no contracts yet */}
          {walletAddress && !loadingContracts && totalContracts === 0 && (
            <div
              className="flex flex-col gap-5 p-6 rounded-2xl"
              style={{ background: "rgba(196,112,75,0.05)", border: "1px solid rgba(196,112,75,0.25)", borderTop: "3px solid #C4704B" }}
            >
              <div className="flex items-start gap-4">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: "rgba(196,112,75,0.15)" }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C4704B" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                </div>
                <div>
                  <p className="text-base font-semibold" style={{ color: "#EDE6DD" }}>Welcome to cascrow — here&apos;s how to get started</p>
                  <p className="text-xs mt-1" style={{ color: "#A89B8C" }}>
                    Create your first escrow contract in minutes. Funds are locked on-chain and released automatically when AI verifies the milestone.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                {/* Step 1 — done */}
                <div
                  className="flex items-center gap-4 p-4 rounded-xl"
                  style={{ background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.2)" }}
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: "rgba(52,211,153,0.15)" }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold" style={{ color: "#34d399" }}>Wallet connected</p>
                    <p className="text-xs" style={{ color: "#A89B8C" }}>Your MetaMask address is linked to your account.</p>
                  </div>
                </div>

                {/* Step 2 — action required */}
                <div
                  className="flex items-center gap-4 p-4 rounded-xl"
                  style={{ background: "rgba(196,112,75,0.06)", border: "1px solid rgba(196,112,75,0.25)" }}
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-sm font-bold"
                    style={{ background: "rgba(196,112,75,0.15)", color: "#C4704B" }}
                  >
                    2
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold" style={{ color: "#EDE6DD" }}>Create your first contract</p>
                    <p className="text-xs mt-0.5" style={{ color: "#A89B8C" }}>
                      Define a milestone, set the RLUSD amount, and choose a deadline. Takes under 2 minutes.
                    </p>
                  </div>
                  <Link
                    href={`/contract/new?investor=${walletAddress}`}
                    className="cs-btn-primary cs-btn-sm shrink-0"
                  >
                    Create →
                  </Link>
                </div>

                {/* Step 3 — locked */}
                <div
                  className="flex items-center gap-4 p-4 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", opacity: 0.6 }}
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-sm font-bold"
                    style={{ background: "rgba(255,255,255,0.06)", color: "#6B5E52" }}
                  >
                    3
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold" style={{ color: "#A89B8C" }}>Invite your startup & fund escrow</p>
                    <p className="text-xs mt-0.5" style={{ color: "#6B5E52" }}>
                      Share the invite link. Once they accept, lock RLUSD on-chain via MetaMask.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs" style={{ color: "#6B5E52", borderTop: "1px solid rgba(196,112,75,0.1)", paddingTop: 16 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                Funds stay locked until AI verifies proof (3/5 model majority vote) — or you manually approve. No third-party custody.
              </div>
            </div>
          )}

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
                  className="rounded-xl"
                  style={{ border: "1px solid rgba(196,112,75,0.1)", overflow: "visible" }}
                >
                  {/* Table header row */}
                  <div
                    className="hidden md:grid grid-cols-[1fr_auto_auto_auto_90px_auto_auto] gap-4 px-5 py-3 text-xs uppercase tracking-wide rounded-t-xl"
                    style={{ background: "rgba(255,255,255,0.02)", color: "#A89B8C", borderBottom: "1px solid rgba(196,112,75,0.08)" }}
                  >
                    <span>Contract</span>
                    <span>Receiver</span>
                    <span>Amount</span>
                    <span>Status</span>
                    <span>Health</span>
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
                        className={`group px-5 py-4 transition-all${idx === arr.length - 1 ? " rounded-b-xl" : ""}`}
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
                              <HealthDot contract={c} />
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
                        <div className="hidden md:grid grid-cols-[1fr_auto_auto_auto_90px_auto_auto] gap-4 items-center">
                          <div className="flex flex-col gap-1.5 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium truncate" style={{ color: "#EDE6DD" }}>{c.milestone}</p>
                              {c.mode === "ATTESTATION" && (
                                <span className="text-xs px-2 py-0.5 rounded-full font-semibold shrink-0" style={{ background: "rgba(196,112,75,0.15)", border: "1px solid rgba(196,112,75,0.3)", color: "#C4704B" }}>
                                  Attestation
                                </span>
                              )}
                            </div>
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
                          <HealthDot contract={c} />
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
