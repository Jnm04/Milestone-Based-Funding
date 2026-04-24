"use client";

import { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { useParams, useSearchParams } from "next/navigation";
import { toast } from "sonner";

interface DealDocument {
  id: string;
  name: string;
  sha256: string;
  uploadedAt: string;
}

interface BriefData {
  companyOverview?: string;
  keyRisks?: string[];
  financialsSummary?: string;
  milestoneFeasibility?: string;
  overallRating?: "HIGH" | "MEDIUM" | "LOW";
  ratingRationale?: string;
  raw?: string;
}

interface RoomData {
  id: string;
  status: string;
  aiBrief: string | null;
  briefAt: string | null;
  inviteToken: string;
  documents: DealDocument[];
  investor: { id: string; email: string; name: string | null; companyName: string | null };
}

const RATING_COLOR: Record<string, string> = {
  HIGH: "#22c55e",
  MEDIUM: "#f59e0b",
  LOW: "#ef4444",
};

const STATUS_LABEL: Record<string, string> = {
  OPEN: "Open — awaiting documents",
  SUBMITTED: "Documents submitted",
  CONVERTED: "Converted to contract",
  DECLINED: "Declined",
};

export default function DealRoomPage() {
  const { data: session } = useSession();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [room, setRoom] = useState<RoomData | null>(null);
  const [isInvestor, setIsInvestor] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [generatingBrief, setGeneratingBrief] = useState(false);
  const [brief, setBrief] = useState<BriefData | null>(null);
  const [actioning, setActioning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const url = `/api/deal-room/${params.id}${token ? `?token=${token}` : ""}`;
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { toast.error(d.error); return; }
        setRoom(d.room);
        setIsInvestor(d.isInvestor);
        if (d.room.aiBrief) {
          try { setBrief(JSON.parse(d.room.aiBrief) as BriefData); } catch { setBrief({ raw: d.room.aiBrief }); }
        }
      })
      .catch(() => toast.error("Failed to load deal room"))
      .finally(() => setLoading(false));
  }, [params.id, token]);

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/deal-room/${params.id}/documents`, { method: "POST", body: formData });
      const d = await res.json() as { error?: string; document?: DealDocument };
      if (!res.ok) throw new Error(d.error ?? "Upload failed");
      setRoom((prev) => prev ? { ...prev, documents: [d.document!, ...prev.documents], status: prev.status === "OPEN" ? "SUBMITTED" : prev.status } : prev);
      toast.success(`${file.name} uploaded`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleGenerateBrief() {
    setGeneratingBrief(true);
    try {
      const res = await fetch(`/api/deal-room/${params.id}/generate-brief`, { method: "POST" });
      const d = await res.json() as { error?: string; brief?: BriefData };
      if (!res.ok) throw new Error(d.error ?? "Failed");
      setBrief(d.brief ?? null);
      toast.success("AI brief generated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate brief");
    } finally {
      setGeneratingBrief(false);
    }
  }

  async function handleAction(action: "convert" | "decline") {
    setActioning(true);
    try {
      const res = await fetch(`/api/deal-room/${params.id}/${action}`, { method: "POST" });
      const d = await res.json() as { error?: string };
      if (!res.ok) throw new Error(d.error ?? "Failed");
      setRoom((prev) => prev ? { ...prev, status: action === "convert" ? "CONVERTED" : "DECLINED" } : prev);
      toast.success(action === "convert" ? "Deal room converted — create the contract now" : "Deal room declined");
      if (action === "convert") window.location.href = "/contract/new";
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActioning(false);
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{ background: "#171311", color: "#A89B8C" }}>Loading…</div>;
  if (!room) return <div className="min-h-screen flex items-center justify-center" style={{ background: "#171311", color: "#ef4444" }}>Deal room not found or access denied.</div>;

  const isClosed = room.status === "CONVERTED" || room.status === "DECLINED";

  return (
    <div className="min-h-screen p-6 md:p-10" style={{ background: "#171311", color: "#EDE6DD" }}>
      <div className="max-w-2xl mx-auto flex flex-col gap-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold" style={{ color: "#EDE6DD" }}>Deal Room</h1>
            <span className="text-xs px-2 py-1 rounded" style={{ background: "rgba(196,112,75,0.15)", color: "#C4704B" }}>
              {STATUS_LABEL[room.status] ?? room.status}
            </span>
          </div>
          <p className="text-sm" style={{ color: "#A89B8C" }}>
            Invited by {room.investor.companyName ?? room.investor.name ?? room.investor.email}
          </p>
        </div>

        {/* Startup: document upload */}
        {!isInvestor && !isClosed && (
          <div className="rounded-xl p-5 flex flex-col gap-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div>
              <h2 className="text-base font-semibold" style={{ color: "#EDE6DD" }}>Upload Documents</h2>
              <p className="text-xs mt-1" style={{ color: "#A89B8C" }}>
                Share your pitch deck, cap table, incorporation certificate, financial projections — up to 5 files.
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,image/*,.docx,.pptx,.xlsx"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
            />
            <button
              type="button"
              disabled={uploading || room.documents.length >= 5}
              onClick={() => fileInputRef.current?.click()}
              className="w-full rounded-lg py-3 text-sm font-medium"
              style={{ background: "rgba(196,112,75,0.1)", border: "1px solid rgba(196,112,75,0.35)", color: "#C4704B", minHeight: 44 }}
            >
              {uploading ? "Uploading…" : room.documents.length >= 5 ? "Max 5 files reached" : "Select Document"}
            </button>
          </div>
        )}

        {/* Documents list */}
        {room.documents.length > 0 && (
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="px-5 py-3 flex items-center justify-between" style={{ background: "rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <span className="text-sm font-semibold" style={{ color: "#EDE6DD" }}>Uploaded Documents</span>
              <span className="text-xs" style={{ color: "#A89B8C" }}>{room.documents.length}/5</span>
            </div>
            {room.documents.map((doc) => (
              <div key={doc.id} className="px-5 py-3 flex items-center gap-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <span className="text-sm flex-1" style={{ color: "#EDE6DD" }}>{doc.name}</span>
                <span className="text-xs font-mono" style={{ color: "#A89B8C" }}>{doc.sha256.slice(0, 10)}…</span>
              </div>
            ))}
          </div>
        )}

        {/* Investor: generate brief + actions */}
        {isInvestor && (
          <div className="flex flex-col gap-4">
            {room.documents.length > 0 && !brief && !isClosed && (
              <button
                type="button"
                disabled={generatingBrief}
                onClick={handleGenerateBrief}
                className="w-full rounded-lg py-3 text-sm font-semibold"
                style={{ background: "#C4704B", color: "#171311" }}
              >
                {generatingBrief ? "Generating AI brief…" : "Generate AI Due-Diligence Brief"}
              </button>
            )}

            {/* AI Brief */}
            {brief && (
              <div className="rounded-xl p-5 flex flex-col gap-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold" style={{ color: "#EDE6DD" }}>AI Due-Diligence Brief</h2>
                  {brief.overallRating && (
                    <span className="text-sm font-bold" style={{ color: RATING_COLOR[brief.overallRating] }}>
                      {brief.overallRating} CONFIDENCE
                    </span>
                  )}
                </div>

                {brief.raw ? (
                  <p className="text-sm" style={{ color: "#A89B8C" }}>{brief.raw}</p>
                ) : (
                  <>
                    {brief.companyOverview && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "#A89B8C" }}>Company Overview</p>
                        <p className="text-sm" style={{ color: "#EDE6DD" }}>{brief.companyOverview}</p>
                      </div>
                    )}
                    {brief.keyRisks && brief.keyRisks.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "#A89B8C" }}>Key Risks</p>
                        <ul className="flex flex-col gap-1">
                          {brief.keyRisks.map((r, i) => (
                            <li key={i} className="text-sm flex gap-2" style={{ color: "#EDE6DD" }}>
                              <span style={{ color: "#ef4444" }}>•</span> {r}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {brief.financialsSummary && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "#A89B8C" }}>Financials</p>
                        <p className="text-sm" style={{ color: "#EDE6DD" }}>{brief.financialsSummary}</p>
                      </div>
                    )}
                    {brief.milestoneFeasibility && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "#A89B8C" }}>Milestone Feasibility</p>
                        <p className="text-sm" style={{ color: "#EDE6DD" }}>{brief.milestoneFeasibility}</p>
                      </div>
                    )}
                    {brief.ratingRationale && (
                      <p className="text-xs italic" style={{ color: "#A89B8C" }}>{brief.ratingRationale}</p>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Convert / Decline */}
            {!isClosed && (
              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={actioning}
                  onClick={() => handleAction("convert")}
                  className="flex-1 rounded-lg py-3 text-sm font-semibold"
                  style={{ background: "#C4704B", color: "#171311" }}
                >
                  {actioning ? "…" : "Convert to Contract →"}
                </button>
                <button
                  type="button"
                  disabled={actioning}
                  onClick={() => handleAction("decline")}
                  className="rounded-lg py-3 px-5 text-sm font-medium"
                  style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444" }}
                >
                  Decline
                </button>
              </div>
            )}
          </div>
        )}

        {isClosed && (
          <div className="rounded-xl p-5 text-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-sm font-semibold" style={{ color: room.status === "CONVERTED" ? "#22c55e" : "#ef4444" }}>
              {room.status === "CONVERTED" ? "✅ This deal room has been converted to a contract." : "❌ This deal room was declined."}
            </p>
          </div>
        )}

        {/* Invite link for investor */}
        {isInvestor && !isClosed && (
          <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-xs font-semibold mb-2" style={{ color: "#A89B8C" }}>Share this link with the startup:</p>
            <div className="flex gap-2">
              <code className="text-xs flex-1 px-3 py-2 rounded" style={{ background: "rgba(255,255,255,0.05)", color: "#C4704B" }}>
                {typeof window !== "undefined" ? `${window.location.origin}/deal-room/${room.id}?token=${room.inviteToken}` : ""}
              </code>
              <button
                type="button"
                onClick={() => {
                  const url = `${window.location.origin}/deal-room/${room.id}?token=${room.inviteToken}`;
                  navigator.clipboard.writeText(url).then(() => toast.success("Link copied")).catch(() => {});
                }}
                className="text-xs px-3 rounded"
                style={{ background: "rgba(196,112,75,0.1)", border: "1px solid rgba(196,112,75,0.25)", color: "#C4704B" }}
              >
                Copy
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
