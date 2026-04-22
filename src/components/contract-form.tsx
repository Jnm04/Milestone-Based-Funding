"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { DraftResponse } from "@/app/api/contracts/draft/route";
import type { RiskFlag } from "@/app/api/contracts/risk-preview/route";
import type { ProbabilityResponse } from "@/app/api/contracts/milestone-probability/route";

interface MilestoneInput {
  title: string;
  amountUSD: string;
  deadlineDays: string;
}

const MILESTONE_TEMPLATES: { label: string; text: string }[] = [
  {
    label: "MVP Launch",
    text: "A functional minimum viable product is live and publicly accessible. Core features are implemented and at least 10 real users have signed up and completed the main user flow.",
  },
  {
    label: "Beta Launch",
    text: "The product enters public beta. A landing page is live, the onboarding flow is complete, and 50 users have registered. No critical bugs blocking core functionality.",
  },
  {
    label: "First Revenue",
    text: "The product generates its first paid revenue. At least 3 paying customers have been invoiced and payments received. Revenue is documented with receipts or transaction records.",
  },
  {
    label: "Market Research",
    text: "A market research report is completed covering target audience, competitor analysis, and market size estimation. Report is at minimum 5 pages with cited sources.",
  },
  {
    label: "Customer Interviews",
    text: "At least 15 customer discovery interviews have been conducted and documented. A written summary with key insights and product-market fit assessment is submitted.",
  },
  {
    label: "Signed Partnership",
    text: "A signed partnership agreement or Letter of Intent (LOI) has been executed with a named partner. The signed document is submitted as proof.",
  },
  {
    label: "App Store Launch",
    text: "The app is live and approved on the App Store and/or Google Play. A public download link is submitted. The app must be downloadable and functional.",
  },
  {
    label: "GitHub Milestone",
    text: "The defined GitHub milestone is closed with all associated issues resolved. Link to the closed milestone is submitted as proof.",
  },
];

interface AttestationMilestoneInput {
  title: string;
  deadlineDays: string;
  scheduleType: "ONE_OFF" | "MONTHLY" | "QUARTERLY" | "ANNUAL";
}

const SCHEDULE_LABELS: Record<string, string> = {
  ONE_OFF: "One-off",
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  ANNUAL: "Annual",
};

interface ContractFormProps {
  investorAddress: string;
  isEnterprise?: boolean;
}

export function ContractForm({ investorAddress, isEnterprise = false }: ContractFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"ESCROW" | "ATTESTATION">("ESCROW");
  const [projectTitle, setProjectTitle] = useState("");
  const [receiverWallet, setReceiverWallet] = useState("");
  const [milestones, setMilestones] = useState<MilestoneInput[]>([
    { title: "", amountUSD: "", deadlineDays: "30" },
  ]);

  // Attestation mode state
  const [auditorEmail, setAuditorEmail] = useState("");
  const [attestationMilestones, setAttestationMilestones] = useState<AttestationMilestoneInput[]>([
    { title: "", deadlineDays: "90", scheduleType: "ONE_OFF" },
  ]);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardDescription, setWizardDescription] = useState("");
  const [wizardLoading, setWizardLoading] = useState(false);

  // AI Drafting state
  const [aiDraftOpen, setAiDraftOpen] = useState(false);
  const [aiDescription, setAiDescription] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiGenerated, setAiGenerated] = useState(false);

  // AI Risk Preview state
  const [riskFlags, setRiskFlags] = useState<RiskFlag[] | null>(null);
  const [loadingRisk, setLoadingRisk] = useState(false);
  const [riskChecked, setRiskChecked] = useState(false);

  // Feature X: per-milestone completion probability
  const [milestoneProbs, setMilestoneProbs] = useState<
    Record<number, ProbabilityResponse | "loading" | null>
  >({});
  const debounceTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  function addMilestone() {
    setMilestones((prev) => [...prev, { title: "", amountUSD: "", deadlineDays: "30" }]);
  }

  function removeMilestone(index: number) {
    if (debounceTimers.current[index]) clearTimeout(debounceTimers.current[index]);
    setMilestoneProbs({});
    setMilestones((prev) => prev.filter((_, i) => i !== index));
    if (riskChecked) {
      setRiskFlags(null);
      setRiskChecked(false);
    }
  }

  async function fetchProbability(
    index: number,
    title: string,
    deadlineDays: number,
    amountUSD: number
  ) {
    try {
      const res = await fetch("/api/contracts/milestone-probability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, deadlineDays, amountUSD }),
      });
      if (!res.ok) {
        setMilestoneProbs((prev) => ({ ...prev, [index]: null }));
        return;
      }
      const data = (await res.json()) as ProbabilityResponse;
      setMilestoneProbs((prev) => ({ ...prev, [index]: data }));
    } catch {
      setMilestoneProbs((prev) => ({ ...prev, [index]: null }));
    }
  }

  function updateMilestone(index: number, field: keyof MilestoneInput, value: string) {
    setMilestones((prev) => prev.map((m, i) => (i === index ? { ...m, [field]: value } : m)));
    // Invalidate risk review when milestones change
    if (riskChecked) {
      setRiskFlags(null);
      setRiskChecked(false);
    }
    // Debounce probability check when title or deadline change
    if (field === "title" || field === "deadlineDays") {
      const current = milestones[index];
      const updated = { ...current, [field]: value };
      const title = updated.title.trim();
      const days = Number(updated.deadlineDays);
      if (debounceTimers.current[index]) clearTimeout(debounceTimers.current[index]);
      if (title.length >= 5 && days > 0) {
        debounceTimers.current[index] = setTimeout(() => {
          setMilestoneProbs((prev) => ({ ...prev, [index]: "loading" }));
          void fetchProbability(index, updated.title, days, Number(updated.amountUSD) || 0);
        }, 1500);
      } else {
        setMilestoneProbs((prev) => ({ ...prev, [index]: null }));
      }
    }
  }

  async function handleAiDraft() {
    if (aiDescription.trim().length < 20) {
      toast.error("Please describe your project in at least 20 characters.");
      return;
    }
    setAiLoading(true);
    try {
      const res = await fetch("/api/contracts/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: aiDescription }),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error ?? "Failed to generate plan");
      }
      const data = await res.json() as DraftResponse;
      setProjectTitle(data.projectTitle);
      setMilestones(
        data.milestones.map((m) => ({
          title: m.title,
          amountUSD: String(m.amountUSD),
          deadlineDays: String(m.deadlineDays),
        }))
      );
      setAiGenerated(true);
      setAiDraftOpen(false);
      setRiskFlags(null);
      setRiskChecked(false);
      toast.success("Milestone plan generated — review and edit before creating.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setAiLoading(false);
    }
  }

  // ── Attestation milestone helpers ─────────────────────────────────────────

  function addAttestationMilestone() {
    setAttestationMilestones((prev) => [...prev, { title: "", deadlineDays: "90", scheduleType: "ONE_OFF" }]);
  }

  function removeAttestationMilestone(index: number) {
    setAttestationMilestones((prev) => prev.filter((_, i) => i !== index));
  }

  function updateAttestationMilestone(
    index: number,
    field: keyof AttestationMilestoneInput,
    value: string
  ) {
    setAttestationMilestones((prev) =>
      prev.map((m, i) => (i === index ? { ...m, [field]: value } : m))
    );
  }

  async function handleGoalWizard() {
    if (wizardDescription.trim().length < 20) {
      toast.error("Please describe your goal in at least 20 characters.");
      return;
    }
    setWizardLoading(true);
    try {
      const res = await fetch("/api/attestation/wizard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: wizardDescription }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? "Failed to generate goal");
      }
      const data = (await res.json()) as {
        title: string;
        goalDescription: string;
        suggestedDeadline: string;
      };
      const deadlineDays = Math.max(
        1,
        Math.round(
          (new Date(data.suggestedDeadline).getTime() - Date.now()) / 86_400_000
        )
      );
      setAttestationMilestones((prev) => [
        ...prev.filter((m) => m.title.trim()),
        { title: data.title + (data.goalDescription ? `\n\n${data.goalDescription}` : ""), deadlineDays: String(deadlineDays), scheduleType: "ONE_OFF" },
      ]);
      setWizardOpen(false);
      setWizardDescription("");
      toast.success("Goal structured — review and edit before creating.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setWizardLoading(false);
    }
  }

  async function handleAttestationSubmit(e: React.FormEvent) {
    e.preventDefault();
    const invalid = attestationMilestones.some((m) => !m.title.trim() || !m.deadlineDays);
    if (invalid) {
      toast.error("Please fill in all milestone fields.");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        mode: "ATTESTATION",
        auditorEmail: auditorEmail.trim() || undefined,
        attestationMilestones: attestationMilestones.map((m) => ({
          title: m.title.trim(),
          cancelAfter: new Date(
            Date.now() + Number(m.deadlineDays) * 24 * 60 * 60 * 1000
          ).toISOString(),
          scheduleType: m.scheduleType,
        })),
      };
      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? "Failed to create attestation contract");
      }
      const { contractId } = (await res.json()) as { contractId: string };
      toast.success("Attestation contract created.");
      router.push(`/contract/${contractId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRiskCheck() {
    const filled = milestones.filter((m) => m.title.trim() && m.amountUSD && m.deadlineDays);
    if (filled.length === 0) {
      toast.error("Fill in at least one milestone before checking for issues.");
      return;
    }
    setLoadingRisk(true);
    try {
      const res = await fetch("/api/contracts/risk-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          milestones: filled.map((m) => ({
            title: m.title,
            amountUSD: Number(m.amountUSD),
            deadlineDays: Number(m.deadlineDays),
          })),
        }),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error ?? "Check failed");
      }
      const data = await res.json() as { flags: RiskFlag[] };
      setRiskFlags(data.flags);
      setRiskChecked(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoadingRisk(false);
    }
  }

  const totalAmount = milestones.reduce((sum, m) => sum + (Number(m.amountUSD) || 0), 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "ATTESTATION") return handleAttestationSubmit(e);

    const invalid = milestones.some((m) => !m.title || !m.amountUSD || !m.deadlineDays);
    if (invalid) {
      toast.error("Please fill in all milestone fields.");
      return;
    }

    setLoading(true);
    try {
      const milestonesPayload = milestones.map((m) => ({
        title: m.title,
        amountUSD: Number(m.amountUSD),
        cancelAfter: new Date(
          Date.now() + Number(m.deadlineDays) * 24 * 60 * 60 * 1000
        ).toISOString(),
      }));

      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          milestone: projectTitle || milestones[0].title,
          milestones: milestonesPayload,
          receiverWalletAddress: receiverWallet.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to create contract");
      }

      const { contractId, directlyLinked } = await res.json();
      toast.success(directlyLinked ? "Contract created and Receiver linked!" : "Contract created! Share the invite link with the Receiver.");
      router.push(`/contract/${contractId}?investor=${investorAddress}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

      {/* Mode toggle — only shown to enterprise users */}
      {isEnterprise && (
        <div style={{ display: "flex", gap: "8px", padding: "4px", background: "#f4f4f5", borderRadius: "10px" }}>
          {(["ESCROW", "ATTESTATION"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              style={{
                flex: 1,
                padding: "8px 16px",
                borderRadius: "7px",
                border: "none",
                fontWeight: 600,
                fontSize: "13px",
                cursor: "pointer",
                transition: "all 0.15s",
                background: mode === m ? "#18181b" : "transparent",
                color: mode === m ? "#fff" : "#52525b",
                boxShadow: mode === m ? "0 1px 4px rgba(0,0,0,0.12)" : "none",
              }}
            >
              {m === "ESCROW" ? "💰 Escrow" : "🏢 Attestation"}
            </button>
          ))}
        </div>
      )}

      {/* ── ATTESTATION MODE FORM ──────────────────────────────────────────── */}
      {mode === "ATTESTATION" && (
        <>
          <div
            style={{
              padding: "10px 14px",
              borderRadius: "8px",
              background: "rgba(196,112,75,0.06)",
              border: "1px solid rgba(196,112,75,0.2)",
              fontSize: "13px",
              color: "#92400e",
            }}
          >
            <strong>Enterprise Attestation Mode</strong> — No escrow or RLUSD required. The platform fetches your data source autonomously and writes the AI verdict to the XRP Ledger.
          </div>

          {/* Goal Wizard */}
          <div style={{ borderRadius: "12px", border: "1px solid #e4e4e7", overflow: "hidden" }}>
            <button
              type="button"
              onClick={() => setWizardOpen((v) => !v)}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: wizardOpen ? "#fafafa" : "#fff", border: "none", cursor: "pointer", textAlign: "left" }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", padding: "2px 8px", borderRadius: "999px", background: "rgba(196,112,75,0.1)", color: "#C4704B", border: "1px solid rgba(196,112,75,0.25)" }}>
                  AI
                </span>
                <span style={{ fontSize: "14px", fontWeight: 500, color: "#18181b" }}>Goal Wizard — structure your KPI from plain language</span>
              </span>
              <span style={{ fontSize: "18px", color: "#71717a", lineHeight: 1 }}>{wizardOpen ? "−" : "+"}</span>
            </button>
            {wizardOpen && (
              <div style={{ padding: "16px", borderTop: "1px solid #e4e4e7", display: "flex", flexDirection: "column", gap: "12px", background: "#fafafa" }}>
                <p style={{ fontSize: "13px", color: "#52525b", margin: 0 }}>
                  Describe your business goal — AI will structure it into a formal attestation milestone with a suggested data source.
                </p>
                <div style={{ position: "relative" }}>
                  <textarea
                    rows={4}
                    placeholder="e.g. We want to prove our Scope 2 carbon emissions decreased by 20% vs last year. We publish an annual sustainability report every December."
                    value={wizardDescription}
                    onChange={(e) => setWizardDescription(e.target.value.slice(0, 2000))}
                    style={{ width: "100%", padding: "10px 12px", paddingBottom: "24px", borderRadius: "8px", border: "1px solid #e4e4e7", fontSize: "14px", fontFamily: "inherit", resize: "vertical", background: "#fff", color: "#18181b", boxSizing: "border-box" }}
                  />
                  <span style={{ position: "absolute", bottom: "8px", right: "10px", fontSize: "11px", color: wizardDescription.length >= 1900 ? "#ef4444" : "#a1a1aa", pointerEvents: "none" }}>
                    {wizardDescription.length}/2000
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleGoalWizard}
                  disabled={wizardLoading || wizardDescription.trim().length < 20}
                  style={{ alignSelf: "flex-start", padding: "8px 18px", borderRadius: "8px", border: "none", background: wizardLoading || wizardDescription.trim().length < 20 ? "#d4d4d8" : "#C4704B", color: "#fff", fontSize: "14px", fontWeight: 600, cursor: wizardLoading || wizardDescription.trim().length < 20 ? "not-allowed" : "pointer" }}
                >
                  {wizardLoading ? "AI is structuring your goal…" : "Structure this Goal"}
                </button>
              </div>
            )}
          </div>

          {/* Attestation milestones */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <span style={{ fontSize: "14px", fontWeight: 600, color: "#18181b" }}>KPI Milestones</span>
            {attestationMilestones.map((ms, idx) => (
              <div key={idx} style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "16px", background: "#fafafa", border: "1px solid #e4e4e7", borderRadius: "12px", color: "#18181b" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ width: "24px", height: "24px", borderRadius: "50%", background: "#18181b", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 700, flexShrink: 0 }}>
                    {idx + 1}
                  </span>
                  {attestationMilestones.length > 1 && (
                    <button type="button" onClick={() => removeAttestationMilestone(idx)} style={{ fontSize: "12px", color: "#ef4444", background: "none", border: "none", cursor: "pointer" }}>
                      Remove
                    </button>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <Label htmlFor={`at-title-${idx}`}>Goal / KPI Description</Label>
                  <textarea
                    id={`at-title-${idx}`}
                    rows={3}
                    placeholder="e.g. Scope 1+2 carbon emissions ≤ 80% of 2024 baseline by December 2026"
                    value={ms.title}
                    onChange={(e) => updateAttestationMilestone(idx, "title", e.target.value)}
                    required
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #e4e4e7", fontSize: "14px", fontFamily: "inherit", resize: "vertical", background: "#fff", color: "#18181b", boxSizing: "border-box" }}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: "12px" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <Label htmlFor={`at-deadline-${idx}`}>Verification Deadline (days)</Label>
                    <Input
                      id={`at-deadline-${idx}`}
                      type="number"
                      min="1"
                      max="1825"
                      placeholder="90"
                      value={ms.deadlineDays}
                      onChange={(e) => updateAttestationMilestone(idx, "deadlineDays", e.target.value)}
                      required
                    />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <Label htmlFor={`at-schedule-${idx}`}>Schedule</Label>
                    <select
                      id={`at-schedule-${idx}`}
                      value={ms.scheduleType}
                      onChange={(e) => updateAttestationMilestone(idx, "scheduleType", e.target.value)}
                      style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #e4e4e7", fontSize: "14px", background: "#fff", color: "#18181b" }}
                    >
                      {Object.entries(SCHEDULE_LABELS).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                      ))}
                    </select>
                    <p style={{ fontSize: "11px", color: "#71717a" }}>Recurring runs auto-verify on schedule</p>
                  </div>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={addAttestationMilestone}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", padding: "10px 16px", borderRadius: "8px", border: "1.5px dashed #d4d4d8", background: "transparent", color: "#52525b", fontSize: "14px", fontWeight: 500, cursor: "pointer" }}
            >
              + Add KPI Milestone
            </button>
          </div>

          {/* Auditor email */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <Label htmlFor="auditorEmail">Auditor Email <span style={{ color: "#a1a1aa", fontWeight: 400 }}>(optional)</span></Label>
            <Input
              id="auditorEmail"
              type="email"
              placeholder="auditor@kpmg.com — receives results but cannot modify"
              value={auditorEmail}
              onChange={(e) => setAuditorEmail(e.target.value)}
            />
            <p style={{ fontSize: "12px", color: "#71717a" }}>The auditor will be CC&apos;d on all attestation results and have read-only access.</p>
          </div>

          {/* Attestation submit */}
          <div style={{ display: "flex", gap: "10px" }}>
            <Button type="submit" disabled={loading} size="lg" style={{ flex: 1 }}>
              {loading ? "Creating…" : "Create Attestation Contract"}
            </Button>
            <Button type="button" variant="outline" size="lg" onClick={() => router.back()}>
              Cancel
            </Button>
          </div>
        </>
      )}

      {/* ── ESCROW MODE FORM (unchanged, hidden in ATTESTATION mode) ─────── */}
      {mode === "ESCROW" && (
        <>
      {/* Project title */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <Label htmlFor="projectTitle">Project Title</Label>
        <Input
          id="projectTitle"
          placeholder="Overall project or contract name…"
          value={projectTitle}
          onChange={(e) => setProjectTitle(e.target.value)}
        />
        <p style={{ fontSize: "12px", color: "#71717a" }}>
          Optional — defaults to the first milestone title if left blank.
        </p>
      </div>

      {/* Receiver */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <Label htmlFor="receiverWallet">Receiver Wallet Address <span style={{ color: "#a1a1aa", fontWeight: 400 }}>(optional)</span></Label>
        <Input
          id="receiverWallet"
          placeholder="0x… — leave empty to share an invite link instead"
          value={receiverWallet}
          onChange={(e) => setReceiverWallet(e.target.value)}
        />
        <p style={{ fontSize: "12px", color: "#71717a" }}>
          {receiverWallet.trim()
            ? "The Receiver will be linked directly — no invite link needed."
            : "You will get an invite link to share with the Receiver after creation."}
        </p>
      </div>

      {/* AI Drafting */}
      <div
        style={{
          borderRadius: "12px",
          border: "1px solid #e4e4e7",
          overflow: "hidden",
        }}
      >
        <button
          type="button"
          onClick={() => setAiDraftOpen((v) => !v)}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            background: aiDraftOpen ? "#fafafa" : "#fff",
            border: "none",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              style={{
                fontSize: "10px",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                padding: "2px 8px",
                borderRadius: "999px",
                background: "rgba(196,112,75,0.1)",
                color: "#C4704B",
                border: "1px solid rgba(196,112,75,0.25)",
              }}
            >
              AI
            </span>
            <span style={{ fontSize: "14px", fontWeight: 500, color: "#18181b" }}>
              Let AI draft this for you
            </span>
          </span>
          <span style={{ fontSize: "18px", color: "#71717a", lineHeight: 1 }}>
            {aiDraftOpen ? "−" : "+"}
          </span>
        </button>

        {aiDraftOpen && (
          <div
            style={{
              padding: "16px",
              borderTop: "1px solid #e4e4e7",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              background: "#fafafa",
            }}
          >
            <p style={{ fontSize: "13px", color: "#52525b", margin: 0 }}>
              Describe your project in plain English — AI will generate a verifiable milestone plan.
            </p>
            <div style={{ position: "relative" }}>
              <textarea
                rows={4}
                placeholder="e.g. We are building a SaaS tool for freelancers to automate invoicing. The grant will fund our MVP launch, beta testing with 50 users, and first paid customer."
                value={aiDescription}
                onChange={(e) => setAiDescription(e.target.value.slice(0, 2000))}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  paddingBottom: "24px",
                  borderRadius: "8px",
                  border: "1px solid #e4e4e7",
                  fontSize: "14px",
                  fontFamily: "inherit",
                  resize: "vertical",
                  background: "#fff",
                  color: "#18181b",
                  boxSizing: "border-box",
                }}
              />
              <span
                style={{
                  position: "absolute",
                  bottom: "8px",
                  right: "10px",
                  fontSize: "11px",
                  color: aiDescription.length >= 1900 ? "#ef4444" : "#a1a1aa",
                  pointerEvents: "none",
                }}
              >
                {aiDescription.length}/2000
              </span>
            </div>
            <button
              type="button"
              onClick={handleAiDraft}
              disabled={aiLoading || aiDescription.trim().length < 20}
              style={{
                alignSelf: "flex-start",
                padding: "8px 18px",
                borderRadius: "8px",
                border: "none",
                background: aiLoading || aiDescription.trim().length < 20 ? "#d4d4d8" : "#C4704B",
                color: "#fff",
                fontSize: "14px",
                fontWeight: 600,
                cursor: aiLoading || aiDescription.trim().length < 20 ? "not-allowed" : "pointer",
                transition: "background 0.15s",
              }}
            >
              {aiLoading ? "AI is drafting your milestones…" : "Generate Milestone Plan"}
            </button>
          </div>
        )}
      </div>

      {/* AI-generated banner */}
      {aiGenerated && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: "8px",
            background: "rgba(196,112,75,0.08)",
            border: "1px solid rgba(196,112,75,0.3)",
            fontSize: "13px",
            color: "#92400e",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span style={{ fontWeight: 700 }}>AI-generated</span> — review and edit all fields before creating the contract.
          <button
            type="button"
            onClick={() => setAiGenerated(false)}
            style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#92400e", fontSize: "16px", lineHeight: 1 }}
          >
            ×
          </button>
        </div>
      )}

      {/* Milestones */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", color: "#18181b" }}>
          <span style={{ fontSize: "14px", fontWeight: 600, color: "#18181b" }}>Milestones</span>
          {totalAmount > 0 && (
            <span style={{ fontSize: "13px", color: "#71717a" }}>
              Total:{" "}
              <strong style={{ color: "#18181b" }}>${totalAmount.toLocaleString()} RLUSD</strong>
            </span>
          )}
        </div>

        {milestones.map((ms, idx) => (
          <div
            key={idx}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              padding: "16px",
              background: "#fafafa",
              border: "1px solid #e4e4e7",
              borderRadius: "12px",
              color: "#18181b",
            }}
          >
            {/* Milestone header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span
                style={{
                  width: "24px",
                  height: "24px",
                  borderRadius: "50%",
                  background: "#18181b",
                  color: "#fff",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "12px",
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {idx + 1}
              </span>
              {milestones.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeMilestone(idx)}
                  style={{
                    fontSize: "12px",
                    color: "#ef4444",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "0",
                  }}
                >
                  Remove
                </button>
              )}
            </div>

            {/* Title */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <Label htmlFor={`ms-title-${idx}`}>Milestone Description</Label>
              {/* Template chips */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {MILESTONE_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.label}
                    type="button"
                    onClick={() => updateMilestone(idx, "title", tpl.text)}
                    style={{
                      fontSize: "11px",
                      fontWeight: 500,
                      padding: "3px 9px",
                      borderRadius: "999px",
                      border: "1px solid #e4e4e7",
                      background: ms.title === tpl.text ? "#18181b" : "#f4f4f5",
                      color: ms.title === tpl.text ? "#fff" : "#52525b",
                      cursor: "pointer",
                      transition: "background 0.1s, color 0.1s",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {tpl.label}
                  </button>
                ))}
              </div>
              <textarea
                id={`ms-title-${idx}`}
                rows={3}
                placeholder="Describe what the receiver must deliver to receive payment — or pick a template above…"
                value={ms.title}
                onChange={(e) => updateMilestone(idx, "title", e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1px solid #e4e4e7",
                  fontSize: "14px",
                  fontFamily: "inherit",
                  resize: "vertical",
                  background: "#fff",
                  color: "#18181b",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* Amount + Deadline */}
            <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: "12px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <Label htmlFor={`ms-amount-${idx}`}>Amount (USD)</Label>
                <Input
                  id={`ms-amount-${idx}`}
                  type="number"
                  min="1"
                  step="0.01"
                  placeholder="500.00"
                  value={ms.amountUSD}
                  onChange={(e) => updateMilestone(idx, "amountUSD", e.target.value)}
                  required
                />
                <p style={{ fontSize: "11px", color: "#71717a" }}>Locked as RLUSD (1:1)</p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <Label htmlFor={`ms-deadline-${idx}`}>Deadline (days)</Label>
                <Input
                  id={`ms-deadline-${idx}`}
                  type="number"
                  min="1"
                  max="365"
                  placeholder="30"
                  value={ms.deadlineDays}
                  onChange={(e) => updateMilestone(idx, "deadlineDays", e.target.value)}
                  required
                />
                <p style={{ fontSize: "11px", color: "#71717a" }}>After this: auto-refund</p>
                {/* Feature X: Milestone completion probability */}
                {milestoneProbs[idx] === "loading" && (
                  <p style={{ fontSize: "11px", color: "#A89B8C", margin: 0 }}>
                    Assessing feasibility…
                  </p>
                )}
                {milestoneProbs[idx] && milestoneProbs[idx] !== "loading" && (() => {
                  const prob = milestoneProbs[idx] as ProbabilityResponse;
                  const isRealistic = prob.tier === "REALISTIC";
                  const isHigh = prob.tier === "HIGH_RISK";
                  const color = isRealistic ? "#4ade80" : isHigh ? "#f87171" : "#D4A03C";
                  const bg = isRealistic
                    ? "rgba(74,222,128,0.1)"
                    : isHigh
                    ? "rgba(248,113,113,0.1)"
                    : "rgba(212,160,60,0.1)";
                  const border = isRealistic
                    ? "rgba(74,222,128,0.3)"
                    : isHigh
                    ? "rgba(248,113,113,0.3)"
                    : "rgba(212,160,60,0.3)";
                  const label = isRealistic ? "Realistic" : isHigh ? "High Risk" : "Ambitious";
                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: "3px", marginTop: "2px" }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          alignSelf: "flex-start",
                          padding: "2px 8px",
                          borderRadius: "999px",
                          background: bg,
                          border: `1px solid ${border}`,
                          color,
                          fontSize: "11px",
                          fontWeight: 700,
                        }}
                      >
                        {label} · {prob.probability}%
                      </span>
                      <p style={{ fontSize: "11px", color: "#71717a", margin: 0, lineHeight: 1.5 }}>
                        {prob.reasoning}
                      </p>
                      {prob.suggestion && (
                        <p style={{ fontSize: "11px", color: "#A89B8C", margin: 0, fontStyle: "italic" }}>
                          {prob.suggestion}
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        ))}

        {/* Add milestone button */}
        <button
          type="button"
          onClick={addMilestone}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            padding: "10px 16px",
            borderRadius: "8px",
            border: "1.5px dashed #d4d4d8",
            background: "transparent",
            color: "#52525b",
            fontSize: "14px",
            fontWeight: 500,
            cursor: "pointer",
            transition: "border-color 0.15s",
          }}
          onMouseOver={(e) => (e.currentTarget.style.borderColor = "#a1a1aa")}
          onMouseOut={(e) => (e.currentTarget.style.borderColor = "#d4d4d8")}
        >
          + Add Milestone
        </button>
      </div>

      {/* AI Risk Review Panel */}
      {riskChecked && riskFlags !== null && (
        <div
          style={{
            borderRadius: "12px",
            background: "rgba(255,255,255,0.03)",
            border: riskFlags.length === 0
              ? "1px solid rgba(74,222,128,0.25)"
              : "1px solid rgba(212,160,60,0.35)",
            borderTop: riskFlags.length === 0
              ? "1px solid rgba(74,222,128,0.5)"
              : "1px solid rgba(212,160,60,0.7)",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "12px 16px",
              borderBottom: riskFlags.length > 0 ? "1px solid rgba(255,255,255,0.06)" : "none",
            }}
          >
            <span
              style={{
                fontSize: "10px",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                padding: "2px 8px",
                borderRadius: "999px",
                background: riskFlags.length === 0
                  ? "rgba(74,222,128,0.1)"
                  : "rgba(212,160,60,0.1)",
                color: riskFlags.length === 0 ? "#86efac" : "#D4A03C",
                border: `1px solid ${riskFlags.length === 0 ? "rgba(74,222,128,0.3)" : "rgba(212,160,60,0.3)"}`,
                flexShrink: 0,
              }}
            >
              AI Risk Review
            </span>
            <span style={{ fontSize: "13px", color: "#EDE6DD", flex: 1 }}>
              {riskFlags.length === 0
                ? "No structural issues found — looks good."
                : `${riskFlags.filter((f) => f.severity === "WARNING").length} warning${riskFlags.filter((f) => f.severity === "WARNING").length !== 1 ? "s" : ""}${riskFlags.filter((f) => f.severity === "INFO").length > 0 ? `, ${riskFlags.filter((f) => f.severity === "INFO").length} note${riskFlags.filter((f) => f.severity === "INFO").length !== 1 ? "s" : ""}` : ""}`}
            </span>
            <button
              type="button"
              onClick={() => { setRiskFlags(null); setRiskChecked(false); }}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#A89B8C", fontSize: "18px", lineHeight: 1, padding: "0 2px" }}
            >
              ×
            </button>
          </div>

          {/* Flags */}
          {riskFlags.length > 0 && (
            <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: "8px" }}>
              {riskFlags.map((flag, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "10px",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    background: flag.severity === "WARNING"
                      ? "rgba(212,160,60,0.08)"
                      : "rgba(255,255,255,0.04)",
                    border: `1px solid ${flag.severity === "WARNING" ? "rgba(212,160,60,0.25)" : "rgba(255,255,255,0.08)"}`,
                  }}
                >
                  <span style={{ flexShrink: 0, fontSize: "13px", marginTop: "1px", color: flag.severity === "WARNING" ? "#D4A03C" : "#A89B8C" }}>
                    {flag.severity === "WARNING" ? "⚠" : "ℹ"}
                  </span>
                  <span style={{ fontSize: "13px", color: "#EDE6DD", lineHeight: 1.6 }}>{flag.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <div style={{ display: "flex", gap: "10px" }}>
          <Button type="submit" disabled={loading} size="lg" style={{ flex: 1 }}>
            {loading ? "Creating…" : riskFlags !== null && riskFlags.length > 0 ? "Create Contract anyway" : "Create Contract"}
          </Button>
          {!loading && (
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
          )}
        </div>
        {!riskChecked && !loading && (
          <button
            type="button"
            onClick={handleRiskCheck}
            disabled={loadingRisk}
            style={{
              background: "none",
              border: "none",
              cursor: loadingRisk ? "not-allowed" : "pointer",
              color: loadingRisk ? "#6b5e54" : "#A89B8C",
              fontSize: "13px",
              padding: "4px 0",
              textAlign: "center",
              textDecoration: "underline",
              textDecorationColor: "rgba(168,155,140,0.3)",
            }}
          >
            {loadingRisk ? "Checking for issues…" : "Check plan for issues with AI"}
          </button>
        )}
      </div>
        </>
      )}
    </form>
  );
}
