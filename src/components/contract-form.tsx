"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface MilestoneInput {
  title: string;
  amountUSD: string;
  deadlineDays: string;
}

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

  function addMilestone() {
    setMilestones((prev) => [...prev, { title: "", amountUSD: "", deadlineDays: "30" }]);
  }

  function removeMilestone(index: number) {
    setMilestones((prev) => prev.filter((_, i) => i !== index));
  }

  function updateMilestone(index: number, field: keyof MilestoneInput, value: string) {
    setMilestones((prev) => prev.map((m, i) => (i === index ? { ...m, [field]: value } : m)));
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
      toast.success(directlyLinked ? "Contract created and receiver linked!" : "Contract created! Share the invite link with the receiver.");
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
            ? "The receiver will be linked directly — no invite link needed."
            : "You will get an invite link to share with the receiver after creation."}
        </p>
      </div>

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
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <Label htmlFor={`ms-title-${idx}`}>Milestone Description</Label>
              <textarea
                id={`ms-title-${idx}`}
                rows={3}
                placeholder="Describe what the startup must deliver to receive payment for this milestone…"
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
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
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

      <Button type="submit" disabled={loading} size="lg">
        {loading ? "Creating…" : "Create Contract"}
      </Button>
    </form>
  );
}
