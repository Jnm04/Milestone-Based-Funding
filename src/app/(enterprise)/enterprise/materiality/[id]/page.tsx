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
      .catch(() => router.push("/enterprise/materiality"));
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

  if (!assessment) return <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--ent-bg)" }}><p style={{ color: "var(--ent-muted)" }}>Loading…</p></div>;

  // Results view
  if (currentStep === 4 && assessment.status === "COMPLETE" && assessment.matrix) {
    return (
      <div style={{ background: "var(--ent-bg)", minHeight: "100vh" }}>
        <nav style={{ borderBottom: "1px solid var(--ent-border)", background: "white" }}>
          <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
            <Link href="/enterprise/materiality" style={{ fontWeight: 700, color: "var(--ent-text)" }}>← All Assessments</Link>
            <span style={{ fontSize: "0.875rem", color: "var(--ent-muted)" }}>Sector: {assessment.sector}</span>
          </div>
        </nav>
        <main className="max-w-6xl mx-auto px-6 py-12">
          <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--ent-text)" }}>Materiality Matrix</h1>
          {assessment.summary && (
            <div className="mb-8 rounded-xl overflow-hidden" style={{ border: "1px solid var(--ent-border)" }}>
              <div className="px-6 py-3 flex items-center gap-2" style={{ background: "var(--ent-accent)", borderBottom: "1px solid var(--ent-border)" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>
                <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: "white" }}>Executive Summary</span>
              </div>
              <div className="p-6" style={{ background: "white" }}>
                {assessment.summary.split(/\n\n+/).map((para, i) => {
                  const trimmed = para.trim();
                  // Detect paragraphs with inline numbered items like "(1) Foo, (2) Bar"
                  const hasNumbered = /\(\d+\)/.test(trimmed);
                  if (hasNumbered) {
                    // Split into: text before (1), then each numbered item
                    const parts = trimmed.split(/\s*\(\d+\)\s*/);
                    const intro = parts[0]?.trim();
                    const items = parts.slice(1).map((s) => s.replace(/[,.]?\s*$/, "").trim()).filter(Boolean);
                    return (
                      <div key={i} className={i > 0 ? "mt-4" : ""}>
                        {intro && <p className="text-sm leading-relaxed mb-2" style={{ color: "var(--ent-muted)" }}>{intro}</p>}
                        <ol className="space-y-1 pl-1">
                          {items.map((item, j) => (
                            <li key={j} className="flex gap-2 text-sm" style={{ color: "var(--ent-muted)" }}>
                              <span className="font-semibold shrink-0" style={{ color: "var(--ent-accent)", minWidth: "1.5rem" }}>({j + 1})</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    );
                  }
                  return (
                    <p key={i} className={`text-sm leading-relaxed${i > 0 ? " mt-4" : ""}`} style={{ color: "var(--ent-muted)" }}>{trimmed}</p>
                  );
                })}
              </div>
            </div>
          )}
          <MaterialityMatrix matrix={assessment.matrix} />
        </main>
      </div>
    );
  }

  // Generating state
  if (generating) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: "var(--ent-bg)" }}>
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="font-semibold" style={{ color: "var(--ent-text)" }}>AI is analyzing your responses…</p>
          <p className="text-sm mt-2" style={{ color: "var(--ent-muted)" }}>Generating ESRS materiality matrix</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "var(--ent-bg)", minHeight: "100vh" }}>
      <nav style={{ borderBottom: "1px solid var(--ent-border)", background: "white" }}>
        <div className="max-w-2xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/enterprise/materiality" style={{ fontWeight: 700, color: "var(--ent-text)" }}>← Back</Link>
          <span className="text-sm" style={{ color: "var(--ent-muted)" }}>Step {currentStep} of 3</span>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-12">
        <div className="flex gap-1.5 mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="h-1.5 flex-1 rounded-full" style={{ background: s <= currentStep ? "var(--ent-accent)" : "var(--ent-border)" }} />
          ))}
        </div>

        <h2 className="text-2xl font-bold mb-8" style={{ color: "var(--ent-text)" }}>
          {currentStep === 1 ? "Company Profile" : currentStep === 2 ? "ESG Exposure" : "Stakeholder Concerns"}
        </h2>

        <div className="space-y-8">
          {stepQuestions.map((q) => {
            const globalIndex = WIZARD_QUESTIONS.indexOf(q);
            return (
              <div key={globalIndex} className="p-6 rounded-xl" style={{ background: "white", border: "1px solid var(--ent-border)" }}>
                <p className="font-medium mb-4" style={{ color: "var(--ent-text)", fontSize: "0.9375rem" }}>{q.q}</p>
                {q.freeText ? (
                  <textarea
                    rows={3}
                    value={(answers[globalIndex] as string) ?? ""}
                    onChange={(e) => setAnswer(globalIndex, e.target.value)}
                    placeholder="Type your answer…"
                    className="w-full rounded-lg px-3.5 py-2.5 text-sm outline-none resize-none"
                    style={{ border: "1px solid var(--ent-border)", background: "var(--ent-bg)", color: "var(--ent-text)" }}
                  />
                ) : q.multi ? (
                  <div className="flex flex-wrap gap-2">
                    {q.options?.map((opt) => {
                      const selected = ((answers[globalIndex] as string[]) ?? []).includes(opt);
                      return (
                        <button key={opt} onClick={() => toggleMulti(globalIndex, opt)}
                          className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                          style={{ border: `1px solid ${selected ? "var(--ent-accent)" : "var(--ent-border)"}`, background: selected ? "#EFF6FF" : "white", color: selected ? "var(--ent-accent)" : "var(--ent-text)" }}>
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {q.options?.map((opt) => {
                      const selected = answers[globalIndex] === opt;
                      return (
                        <button key={opt} onClick={() => setAnswer(globalIndex, opt)}
                          className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                          style={{ border: `1px solid ${selected ? "var(--ent-accent)" : "var(--ent-border)"}`, background: selected ? "#EFF6FF" : "white", color: selected ? "var(--ent-accent)" : "var(--ent-text)" }}>
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

        {error && <p className="text-sm text-red-500 mt-4">{error}</p>}

        <div className="flex gap-3 mt-8">
          {currentStep > 1 && (
            <button onClick={() => setCurrentStep((s) => s - 1)}
              className="flex-1 py-3 rounded-lg font-medium text-sm"
              style={{ border: "1px solid var(--ent-border)", color: "var(--ent-text)", background: "white" }}>
              Back
            </button>
          )}
          <button
            onClick={saveAndNext}
            disabled={saving || !allStepAnswered}
            className="flex-1 py-3 rounded-lg font-semibold text-sm text-white transition-opacity"
            style={{ background: "var(--ent-accent)", opacity: saving || !allStepAnswered ? 0.6 : 1 }}>
            {saving ? "Saving…" : currentStep === 3 ? "Generate Matrix →" : "Next →"}
          </button>
        </div>
      </main>
    </div>
  );
}
