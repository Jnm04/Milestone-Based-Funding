import { notFound } from "next/navigation";
import Link from "next/link";

interface ModelVote {
  model: string;
  decision: "YES" | "NO";
  confidence: number;
  reasoning: string;
}

interface ChecklistResultItem {
  id: number;
  title: string;
  fixed: boolean;
  evidence: string;
  confidence: number;
}

interface ChecklistResults {
  items: ChecklistResultItem[];
  fixedCount: number;
  totalCount: number;
}

interface VerificationResult {
  decision: "YES" | "NO";
  confidence: number;
  reasoning: string;
  modelVotes: ModelVote[];
  consensusLevel: number;
  checklistResults?: ChecklistResults;
}

interface VerificationRecord {
  id: string;
  taskDescription: string;
  prUrl: string | null;
  decision: string | null;
  confidence: number | null;
  result: VerificationResult | null;
  status: string;
  checklistItems: { id: number; title: string; severity?: string }[] | null;
  createdAt: string;
}

const MODEL_COLORS: Record<string, string> = {
  Claude: "#C4704B",
  Gemini: "#4285f4",
  OpenAI: "#10a37f",
  Mistral: "#ff7000",
  "Cerebras/Qwen3": "#8b5cf6",
};

async function getVerification(hash: string): Promise<VerificationRecord | null> {
  try {
    const baseUrl = process.env.NEXTAUTH_URL ?? "https://cascrow.com";
    const res = await fetch(`${baseUrl}/api/verify/result/${hash}`, {
      next: { revalidate: 30 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ hash: string }> }) {
  const { hash } = await params;
  const record = await getVerification(hash);
  if (!record) return { title: "Verification Not Found — cascrow" };
  const decision = record.decision === "YES" ? "✓ Verified" : record.decision === "NO" ? "✗ Not Verified" : "Pending";
  return {
    title: `${decision} — cascrow Verification Report`,
    description: `AI verification report: ${record.taskDescription.slice(0, 120)}`,
  };
}

export default async function VerificationResultPage({
  params,
}: {
  params: Promise<{ hash: string }>;
}) {
  const { hash } = await params;

  if (!/^[a-f0-9]{64}$/.test(hash)) notFound();

  const record = await getVerification(hash);
  if (!record) notFound();

  const result = record.result as VerificationResult | null;
  const modelVotes: ModelVote[] = result?.modelVotes ?? [];
  const checklistResults = result?.checklistResults;
  const isYes = record.decision === "YES";
  const isPending = record.status === "PENDING";
  const isFailed = record.status === "FAILED";

  const decisionColor = isYes ? "#22c55e" : isFailed ? "#6b7280" : "#ef4444";
  const decisionText = isPending
    ? "Verifying…"
    : isFailed
      ? "Verification Failed"
      : isYes
        ? "Work Verified"
        : "Work Not Verified";

  const reportUrl = `https://cascrow.com/verify/result/${hash}`;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#171311",
        color: "#EDE6DD",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          borderBottom: "1px solid rgba(196,112,75,0.2)",
          padding: "16px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Link href="/" style={{ textDecoration: "none" }}>
          <span style={{ color: "#C4704B", fontWeight: 700, fontSize: 20 }}>cascrow</span>
        </Link>
        <Link
          href="/verify"
          style={{
            background: "rgba(196,112,75,0.15)",
            border: "1px solid rgba(196,112,75,0.3)",
            color: "#C4704B",
            padding: "6px 14px",
            borderRadius: 20,
            fontSize: 13,
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          Verify new work
        </Link>
      </div>

      <div style={{ maxWidth: 700, margin: "0 auto", padding: "40px 24px" }}>
        {/* Decision banner */}
        <div
          style={{
            background: `${decisionColor}18`,
            border: `1px solid ${decisionColor}44`,
            borderRadius: 16,
            padding: "24px",
            textAlign: "center",
            marginBottom: 24,
          }}
        >
          <div
            style={{
              fontSize: 48,
              marginBottom: 8,
            }}
          >
            {isPending ? "⏳" : isYes ? "✓" : isFailed ? "⚠" : "✗"}
          </div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: decisionColor,
              marginBottom: 6,
            }}
          >
            {decisionText}
          </div>
          {record.confidence !== null && !isPending && (
            <div style={{ color: "#A89B8C", fontSize: 14 }}>
              {record.confidence}% confidence · {modelVotes.filter((v) => v.decision === "YES").length}/{modelVotes.length} models agreed
            </div>
          )}
        </div>

        {/* Task */}
        <div
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(196,112,75,0.15)",
            borderRadius: 14,
            padding: 20,
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, color: "#A89B8C", marginBottom: 8, letterSpacing: 1 }}>
            TASK DESCRIPTION
          </div>
          <div style={{ fontSize: 15, lineHeight: 1.6 }}>{record.taskDescription}</div>
          {record.prUrl && (
            <div style={{ marginTop: 10 }}>
              <a
                href={record.prUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#C4704B", fontSize: 13, textDecoration: "none" }}
              >
                {record.prUrl.replace("https://", "")} →
              </a>
            </div>
          )}
        </div>

        {/* AI Reasoning */}
        {result?.reasoning && (
          <div
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(196,112,75,0.15)",
              borderRadius: 14,
              padding: 20,
              marginBottom: 16,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, color: "#A89B8C", marginBottom: 8, letterSpacing: 1 }}>
              AI SUMMARY
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.7, color: "#EDE6DD" }}>{result.reasoning}</div>
          </div>
        )}

        {/* Checklist results */}
        {checklistResults && (
          <div
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(196,112,75,0.15)",
              borderRadius: 14,
              padding: 20,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 600, color: "#A89B8C", letterSpacing: 1 }}>
                CHECKLIST RESULTS
              </div>
              <div style={{ fontSize: 13, color: checklistResults.fixedCount === checklistResults.totalCount ? "#22c55e" : "#f97316" }}>
                {checklistResults.fixedCount}/{checklistResults.totalCount} items addressed
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {checklistResults.items.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    gap: 12,
                    background: item.fixed ? "rgba(34,197,94,0.06)" : "rgba(239,68,68,0.06)",
                    border: `1px solid ${item.fixed ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
                    borderRadius: 10,
                    padding: "10px 14px",
                  }}
                >
                  <span style={{ fontSize: 18, flexShrink: 0 }}>{item.fixed ? "✓" : "✗"}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: 12, color: "#A89B8C" }}>{item.evidence}</div>
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: item.confidence > 70 ? "#22c55e" : "#f97316",
                      flexShrink: 0,
                      alignSelf: "flex-start",
                    }}
                  >
                    {item.confidence}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Model votes */}
        {modelVotes.length > 0 && (
          <div
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(196,112,75,0.15)",
              borderRadius: 14,
              padding: 20,
              marginBottom: 16,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, color: "#A89B8C", marginBottom: 12, letterSpacing: 1 }}>
              INDEPENDENT AI PANEL ({modelVotes.length} MODELS)
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {modelVotes.map((vote) => (
                <div
                  key={vote.model}
                  style={{
                    display: "flex",
                    gap: 12,
                    alignItems: "flex-start",
                    background: "rgba(255,255,255,0.02)",
                    borderRadius: 10,
                    padding: "10px 12px",
                  }}
                >
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: MODEL_COLORS[vote.model.split(" ")[0]] ?? "#A89B8C",
                      marginTop: 5,
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{vote.model}</span>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: vote.decision === "YES" ? "#22c55e" : "#ef4444",
                        }}
                      >
                        {vote.decision} · {vote.confidence}%
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "#A89B8C", lineHeight: 1.5 }}>
                      {vote.reasoning}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Share + metadata */}
        <div
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(196,112,75,0.15)",
            borderRadius: 14,
            padding: 16,
            marginBottom: 24,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, color: "#A89B8C", letterSpacing: 1 }}>
            SHARE THIS REPORT
          </div>
          <div
            style={{
              background: "rgba(255,255,255,0.04)",
              borderRadius: 8,
              padding: "8px 12px",
              fontSize: 12,
              fontFamily: "monospace",
              color: "#A89B8C",
              wordBreak: "break-all",
            }}
          >
            {reportUrl}
          </div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>
            Verified {new Date(record.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })} · Powered by{" "}
            <Link href="/" style={{ color: "#C4704B", textDecoration: "none" }}>
              cascrow
            </Link>
          </div>
        </div>

        {/* CTA */}
        <div
          style={{
            padding: 20,
            background: "rgba(196,112,75,0.08)",
            border: "1px solid rgba(196,112,75,0.2)",
            borderRadius: 14,
            textAlign: "center",
          }}
        >
          <p style={{ margin: "0 0 10px", color: "#A89B8C", fontSize: 14 }}>
            Want guaranteed payment on delivery? Lock funds in escrow — released automatically
            when cascrow confirms the work is done.
          </p>
          <Link
            href="/register"
            style={{
              display: "inline-block",
              background: "#C4704B",
              color: "#EDE6DD",
              padding: "10px 24px",
              borderRadius: 20,
              fontSize: 14,
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Create free escrow contract →
          </Link>
        </div>
      </div>
    </div>
  );
}
