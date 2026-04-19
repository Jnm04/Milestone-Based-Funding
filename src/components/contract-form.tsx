"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { DraftResponse } from "@/app/api/contracts/draft/route";

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

interface ContractFormProps {
  investorAddress: string;
}

export function ContractForm({ investorAddress }: ContractFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [projectTitle, setProjectTitle] = useState("");
  const [receiverWallet, setReceiverWallet] = useState("");
  const [milestones, setMilestones] = useState<MilestoneInput[]>([
    { title: "", amountUSD: "", deadlineDays: "30" },
  ]);

  // AI Drafting state
  const [aiDraftOpen, setAiDraftOpen] = useState(false);
  const [aiDescription, setAiDescription] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiGenerated, setAiGenerated] = useState(false);

  function addMilestone() {
    setMilestones((prev) => [...prev, { title: "", amountUSD: "", deadlineDays: "30" }]);
  }

  function removeMilestone(index: number) {
    setMilestones((prev) => prev.filter((_, i) => i !== index));
  }

  function updateMilestone(index: number, field: keyof MilestoneInput, value: string) {
    setMilestones((prev) => prev.map((m, i) => (i === index ? { ...m, [field]: value } : m)));
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
      toast.success("Milestone plan generated — review and edit before creating.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setAiLoading(false);
    }
  }

  const totalAmount = milestones.reduce((sum, m) => sum + (Number(m.amountUSD) || 0), 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

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

      <div style={{ display: "flex", gap: "12px" }}>
        <Button type="submit" disabled={loading} size="lg" style={{ flex: 1 }}>
          {loading ? "Creating…" : "Create Contract"}
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
    </form>
  );
}
