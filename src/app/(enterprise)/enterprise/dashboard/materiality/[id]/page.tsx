"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { MaterialityMatrix } from "@/components/materiality-matrix";

const WIZARD_QUESTIONS = [
  // Step 1 — Company Profile
  { step: 1, q: "In which regions does your company primarily operate?", options: ["EU only", "EU + North America", "Global", "Asia-Pacific", "Other"] },
  { step: 1, q: "How many employees does your company have?", options: ["<50", "50–250", "250–1,000", "1,000–5,000", ">5,000"] },
  { step: 1, q: "Does your company have a supply chain with significant environmental or labor impacts?", options: ["Yes, significantly", "Partially", "No"] },
  { step: 1, q: "Which regulatory reporting frameworks apply to your company?", multi: true, options: ["CSRD", "TCFD", "GRI", "SEC ESG", "None"] },
  // Step 2 — ESG Exposure
  { step: 2, q: "Which environmental topics are most relevant to your business?", multi: true, options: ["Climate / GHG", "Pollution", "Water", "Biodiversity", "Circular Economy"] },
  { step: 2, q: "Does your business significantly affect communities or workers (directly or through supply chain)? (1=minimal, 5=significant)", options: ["1", "2", "3", "4", "5"] },
  { step: 2, q: "How dependent is your revenue on fossil fuels or carbon-intensive activities? (1=not at all, 5=heavily)", options: ["1", "2", "3", "4", "5"] },
  { step: 2, q: "Are your products or services subject to significant environmental regulatory requirements?", options: ["Yes", "No", "Partially"] },
  { step: 2, q: "Have ESG topics caused financial risk (litigation, fines) in the last 3 years?", options: ["Yes", "No"] },
  // Step 3 — Stakeholder Concerns
  { step: 3, q: "What ESG topics do your investors most frequently ask about?", freeText: true },
  { step: 3, q: "Have any ESG topics been raised by employees, customers, or civil society in the last 2 years?", freeText: true },
  { step: 3, q: "What is your primary CSRD / ESG reporting goal?", freeText: true },
];

type Assessment = {
  id: string;
  sector: string;
  status: string;
  answers: { question: string; answer: string }[];
  matrix?: MatrixItem[];
  summary?: string;
};

type MatrixItem = {
  topic: string;
  financialScore: number;
  impactScore: number;
  material: boolean;
  esrsArticles: string[];
  griStandards: string[];
  rationale: string;
};

export default function MaterialityWizardPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [answers, setAnswers] = useState<Record<number, string | string[]>>({});
  const [currentStep, setCurrentStep] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/attestation/materiality/${id}`)
      .then((r) => r.json())
      .then((data: Assessment) => {
        setAssessment(data);
        if (data.status === "COMPLETE") setCurrentStep(4);
      })
      .catch(() => router.push("/enterprise/dashboard/materiality"));
  }, [id, router]);

  const stepQuestions = WIZARD_QUESTIONS.filter((q) => q.step === currentStep);
  const allStepAnswered = stepQuestions.every((_, i) => {
    const globalIndex = WIZARD_QUESTIONS.findIndex((q) => q.step === currentStep && q === stepQuestions[i]);
    const ans = answers[globalIndex];
    return ans && (Array.isArray(ans) ? ans.length > 0 : ans.trim().length > 0);
  });

  async function saveAndNext() {
    setSaving(true);
    setError("");
    const builtAnswers = WIZARD_QUESTIONS.map((q, i) => ({
      question: q.q,
      answer: Array.isArray(answers[i]) ? (answers[i] as string[]).join(", ") : (answers[i] as string) ?? "",
    })).filter((a) => a.answer);

    try {
      await fetch(`/api/attestation/materiality/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: builtAnswers }),
      });
      if (currentStep < 3) setCurrentStep((s) => s + 1);
      else await generate(builtAnswers);
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function generate(builtAnswers: { question: string; answer: string }[]) {
    setGenerating(true);
    await fetch(`/api/attestation/materiality/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers: builtAnswers }),
    });
    const res = await fetch(`/api/attestation/materiality/${id}/generate`, { method: "POST" });
    if (!res.ok) { setError("AI generation failed. Please try again."); setGenerating(false); return; }
    const data = await res.json() as Assessment;
    setAssessment(data);
    setCurrentStep(4);
    setGenerating(false);
  }

  function setAnswer(index: number, value: string | string[]) {
    setAnswers((prev) => ({ ...prev, [index]: value }));
  }

  function toggleMulti(index: number, option: string) {
    const curr = (answers[index] as string[]) ?? [];
    const next = curr.includes(option) ? curr.filter((o) => o !== option) : [...curr, option];
    setAnswer(index, next);
  }

  if (!assessment) {
    return (
      <div style={{ padding: "32px 36px" }}>
        <div style={{ height: 20, width: 160, borderRadius: 6, background: "var(--ent-bg)", marginBottom: 24 }} />
        <div style={{ height: 300, borderRadius: 12, background: "var(--ent-bg)" }} />
      </div>
    );
  }

  // Results view
  if (currentStep === 4 && assessment.status === "COMPLETE" && assessment.matrix) {
    return (
      <div style={{ padding: "32px 36px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <Link
              href="/enterprise/dashboard/materiality"
              style={{ fontSize: 13, color: "var(--ent-accent)", textDecoration: "none", display: "flex", alignItems: "center", gap: 4, marginBottom: 8 }}
            >
              ← All Assessments
            </Link>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "var(--ent-text)", letterSpacing: "-0.02em" }}>
              Materiality Matrix
            </h1>
          </div>
          <span style={{ fontSize: 12.5, color: "var(--ent-muted)" }}>Sector: {assessment.sector}</span>
        </div>
        {assessment.summary && (
          <div style={{ marginBottom: 24, padding: 20, borderRadius: 10, background: "white", border: "1px solid var(--ent-border)" }}>
            <p style={{ margin: 0, fontSize: 13.5, color: "var(--ent-muted)", lineHeight: 1.7 }}>{assessment.summary}</p>
          </div>
        )}
        <MaterialityMatrix matrix={assessment.matrix} />
      </div>
    );
  }

  // Generating state
  if (generating) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 36px" }}>
        <div style={{ width: 48, height: 48, borderRadius: "50%", border: "4px solid var(--ent-accent)", borderTopColor: "transparent", animation: "spin 0.8s linear infinite", marginBottom: 20 }} />
        <p style={{ margin: "0 0 4px", fontWeight: 600, color: "var(--ent-text)" }}>AI is analyzing your responses…</p>
        <p style={{ margin: 0, fontSize: 13, color: "var(--ent-muted)" }}>Generating ESRS materiality matrix</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ padding: "32px 36px", maxWidth: 660 }}>
      {/* Back + step indicator */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <Link href="/enterprise/dashboard/materiality" style={{ fontSize: 13, color: "var(--ent-accent)", textDecoration: "none" }}>
          ← Back
        </Link>
        <span style={{ fontSize: 12.5, color: "var(--ent-muted)" }}>Step {currentStep} of 3</span>
      </div>

      {/* Progress bar */}
      <div style={{ display: "flex", gap: 6, marginBottom: 28 }}>
        {[1, 2, 3].map((s) => (
          <div key={s} style={{ height: 5, flex: 1, borderRadius: 99, background: s <= currentStep ? "var(--ent-accent)" : "var(--ent-border)" }} />
        ))}
      </div>

      <h2 style={{ margin: "0 0 24px", fontSize: 20, fontWeight: 700, color: "var(--ent-text)", letterSpacing: "-0.01em" }}>
        {currentStep === 1 ? "Company Profile" : currentStep === 2 ? "ESG Exposure" : "Stakeholder Concerns"}
      </h2>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {stepQuestions.map((q) => {
          const globalIndex = WIZARD_QUESTIONS.indexOf(q);
          return (
            <div key={globalIndex} style={{ padding: 20, borderRadius: 10, background: "white", border: "1px solid var(--ent-border)" }}>
              <p style={{ margin: "0 0 14px", fontWeight: 600, fontSize: 14, color: "var(--ent-text)" }}>{q.q}</p>
              {q.freeText ? (
                <textarea
                  rows={3}
                  value={(answers[globalIndex] as string) ?? ""}
                  onChange={(e) => setAnswer(globalIndex, e.target.value)}
                  placeholder="Type your answer…"
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    fontSize: 13.5,
                    border: "1px solid var(--ent-border)",
                    borderRadius: 8,
                    background: "var(--ent-bg)",
                    color: "var(--ent-text)",
                    outline: "none",
                    resize: "none",
                    boxSizing: "border-box",
                  }}
                />
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {q.options?.map((opt) => {
                    const selected = q.multi
                      ? ((answers[globalIndex] as string[]) ?? []).includes(opt)
                      : answers[globalIndex] === opt;
                    return (
                      <button
                        key={opt}
                        onClick={() => q.multi ? toggleMulti(globalIndex, opt) : setAnswer(globalIndex, opt)}
                        style={{
                          padding: "7px 14px",
                          borderRadius: 8,
                          fontSize: 13,
                          fontWeight: 500,
                          border: `1px solid ${selected ? "var(--ent-accent)" : "var(--ent-border)"}`,
                          background: selected ? "#EFF6FF" : "white",
                          color: selected ? "var(--ent-accent)" : "var(--ent-text)",
                          cursor: "pointer",
                          transition: "all 0.1s",
                        }}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {error && <p style={{ fontSize: 13, color: "#DC2626", marginTop: 12 }}>{error}</p>}

      <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
        {currentStep > 1 && (
          <button
            onClick={() => setCurrentStep((s) => s - 1)}
            style={{
              flex: 1,
              padding: "11px 0",
              borderRadius: 8,
              fontSize: 13.5,
              fontWeight: 600,
              border: "1px solid var(--ent-border)",
              color: "var(--ent-text)",
              background: "white",
              cursor: "pointer",
            }}
          >
            Back
          </button>
        )}
        <button
          onClick={saveAndNext}
          disabled={saving || !allStepAnswered}
          style={{
            flex: 1,
            padding: "11px 0",
            borderRadius: 8,
            fontSize: 13.5,
            fontWeight: 600,
            color: "white",
            background: saving || !allStepAnswered ? "#93C5FD" : "var(--ent-accent)",
            border: "none",
            cursor: saving || !allStepAnswered ? "not-allowed" : "pointer",
            boxShadow: saving || !allStepAnswered ? "none" : "0 1px 3px rgba(29,78,216,0.2)",
          }}
        >
          {saving ? "Saving…" : currentStep === 3 ? "Generate Matrix →" : "Next →"}
        </button>
      </div>
    </div>
  );
}
