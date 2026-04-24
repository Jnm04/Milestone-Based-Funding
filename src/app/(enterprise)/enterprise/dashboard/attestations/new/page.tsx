"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface MilestoneRow {
  title: string;
  description: string;
  deadline: string;
  verificationCriteria: string;
}

export default function NewAttestationPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [milestones, setMilestones] = useState<MilestoneRow[]>([
    { title: "", description: "", deadline: "", verificationCriteria: "" },
  ]);
  const [loading, setLoading] = useState(false);

  function addMilestone() {
    setMilestones((prev) => [...prev, { title: "", description: "", deadline: "", verificationCriteria: "" }]);
  }

  function removeMilestone(index: number) {
    if (milestones.length <= 1) return;
    setMilestones((prev) => prev.filter((_, i) => i !== index));
  }

  function updateMilestone(index: number, field: keyof MilestoneRow, value: string) {
    setMilestones((prev) => prev.map((m, i) => (i === index ? { ...m, [field]: value } : m)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Please enter a goal set title");
      return;
    }
    for (let i = 0; i < milestones.length; i++) {
      if (!milestones[i].title.trim()) {
        toast.error(`Milestone ${i + 1} needs a title`);
        return;
      }
      if (!milestones[i].deadline) {
        toast.error(`Milestone ${i + 1} needs a deadline`);
        return;
      }
    }

    setLoading(true);
    try {
      const res = await fetch("/api/enterprise/attestations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          milestones: milestones.map((m) => ({
            title: m.title.trim(),
            description: m.description.trim() || undefined,
            verificationCriteria: m.verificationCriteria.trim() || undefined,
            deadline: m.deadline,
          })),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Something went wrong" }));
        throw new Error(err.error ?? "Failed to create goal set");
      }

      const data = await res.json();
      router.push(`/enterprise/dashboard/attestations/${data.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create goal set");
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "9px 12px",
    fontSize: 13.5,
    border: "1px solid var(--ent-border)",
    borderRadius: 7,
    background: "white",
    color: "var(--ent-text)",
    outline: "none",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 12.5,
    fontWeight: 600,
    color: "var(--ent-text)",
    marginBottom: 6,
  };

  return (
    <div style={{ padding: "32px 36px", maxWidth: 760 }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <a
          href="/enterprise/dashboard/attestations"
          style={{ fontSize: 13, color: "var(--ent-muted)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 16 }}
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Goal Sets
        </a>
        <h1 style={{ margin: "0 0 4px", fontSize: 24, fontWeight: 700, color: "var(--ent-text)", letterSpacing: "-0.02em" }}>
          New Goal Set
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: "var(--ent-muted)" }}>
          Define your goals and milestones for AI-verified attestation.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Goal Set Title */}
        <div style={{
          background: "white",
          border: "1px solid var(--ent-border)",
          borderRadius: 12,
          padding: "24px",
          marginBottom: 20,
        }}>
          <h2 style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 700, color: "var(--ent-text)" }}>Goal Set Details</h2>
          <div>
            <label style={labelStyle}>Goal Set Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Q2 2026 OKRs, CSRD Compliance 2026"
              style={inputStyle}
              required
            />
          </div>
        </div>

        {/* Milestones */}
        <div style={{
          background: "white",
          border: "1px solid var(--ent-border)",
          borderRadius: 12,
          padding: "24px",
          marginBottom: 20,
        }}>
          <h2 style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 700, color: "var(--ent-text)" }}>
            Milestones
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {milestones.map((m, index) => (
              <div
                key={index}
                style={{
                  border: "1px solid var(--ent-border)",
                  borderRadius: 10,
                  padding: "20px",
                  background: "var(--ent-bg)",
                  position: "relative",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ent-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Milestone {index + 1}
                  </span>
                  {milestones.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeMilestone(index)}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "var(--ent-muted)",
                        padding: "2px 4px",
                        borderRadius: 4,
                        display: "flex",
                        alignItems: "center",
                      }}
                      title="Remove milestone"
                    >
                      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 180px", gap: 14, marginBottom: 14 }}>
                  <div>
                    <label style={labelStyle}>Title</label>
                    <input
                      type="text"
                      value={m.title}
                      onChange={(e) => updateMilestone(index, "title", e.target.value)}
                      placeholder="e.g. Reduce carbon emissions by 20%"
                      style={inputStyle}
                      required
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Deadline</label>
                    <input
                      type="date"
                      value={m.deadline}
                      onChange={(e) => updateMilestone(index, "deadline", e.target.value)}
                      style={inputStyle}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>
                    Description <span style={{ fontWeight: 400, color: "var(--ent-muted)" }}>(optional)</span>
                  </label>
                  <textarea
                    value={m.description}
                    onChange={(e) => updateMilestone(index, "description", e.target.value)}
                    placeholder="Describe what evidence is needed to verify this milestone..."
                    rows={3}
                    style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }}
                  />
                </div>

                <div>
                  <label style={labelStyle}>
                    Custom AI verification criteria <span style={{ fontWeight: 400, color: "var(--ent-muted)" }}>(optional)</span>
                  </label>
                  <textarea
                    value={m.verificationCriteria}
                    onChange={(e) => updateMilestone(index, "verificationCriteria", e.target.value)}
                    placeholder="e.g. The evidence must include a signed auditor statement confirming Scope 2 emissions reduced by at least 20% compared to the 2024 baseline."
                    rows={3}
                    style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }}
                  />
                  <p style={{ fontSize: 11, color: "var(--ent-muted)", marginTop: 4 }}>
                    Override the default AI rubric with your own evaluation criteria. The AI panel will apply these in addition to standard verification checks.
                  </p>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addMilestone}
            style={{
              marginTop: 16,
              background: "white",
              color: "var(--ent-text)",
              border: "1px solid var(--ent-border)",
              borderRadius: 7,
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Milestone
          </button>
        </div>

        {/* Submit */}
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button
            type="submit"
            disabled={loading}
            style={{
              background: loading ? "#93C5FD" : "var(--ent-accent)",
              color: "white",
              border: "none",
              borderRadius: 7,
              padding: "10px 24px",
              fontSize: 13,
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {loading ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{ animation: "spin 1s linear infinite" }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
                Creating…
              </>
            ) : (
              "Create Goal Set"
            )}
          </button>
          <a
            href="/enterprise/dashboard/attestations"
            style={{
              background: "white",
              color: "var(--ent-text)",
              border: "1px solid var(--ent-border)",
              borderRadius: 7,
              padding: "10px 18px",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              textDecoration: "none",
            }}
          >
            Cancel
          </a>
        </div>
      </form>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
