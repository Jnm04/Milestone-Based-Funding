"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";

interface AttestationEntry {
  id: string;
  period: string;
  fetchedAt: string;
  aiVerdict: string;
  aiReasoning: string;
  xrplTxHash: string | null;
  certUrl: string | null;
  type: string;
}

interface Milestone {
  id: string;
  title: string;
  status: string;
  scheduleType: string | null;
  regulatoryTags: string | null;
  attestationEntries: AttestationEntry[];
}

interface Contract {
  id: string;
  milestone: string;
  status: string;
  createdAt: string;
  auditorEmail: string | null;
  milestones: Milestone[];
}

const VERDICT_BADGE: Record<string, string> = {
  YES: "bg-green-500/15 text-green-400",
  NO: "bg-red-500/15 text-red-400",
  INCONCLUSIVE: "bg-yellow-500/15 text-yellow-400",
};

export default function AuditorClientPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams<{ clientId: string }>();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") { router.push("/login"); return; }
    if (status !== "authenticated") return;

    fetch(`/api/auditor/clients/${params.clientId}/attestations`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { toast.error(d.error); router.push("/auditor"); return; }
        setContracts(d.contracts ?? []);
      })
      .catch(() => toast.error("Failed to load attestations"))
      .finally(() => setLoading(false));
  }, [status, params.clientId, router]);

  if (status !== "authenticated") return null;

  const isXrplMainnet = true;
  const xrplExplorer = isXrplMainnet ? "xrpscan.com" : "testnet.xrpscan.com";

  return (
    <div className="min-h-screen p-8" style={{ background: "#171311", color: "#EDE6DD" }}>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/auditor" className="text-sm" style={{ color: "#A89B8C", textDecoration: "underline" }}>
            ← All clients
          </Link>
          <h1 className="text-2xl font-bold" style={{ color: "#EDE6DD" }}>Attestation Workspace</h1>
          <span className="text-xs px-2 py-1 rounded" style={{ background: "rgba(196,112,75,0.15)", color: "#C4704B" }}>
            Read-only
          </span>
        </div>

        {loading ? (
          <p style={{ color: "#A89B8C" }}>Loading attestations…</p>
        ) : contracts.length === 0 ? (
          <p style={{ color: "#A89B8C" }}>No attestation contracts found for this client.</p>
        ) : (
          <div className="flex flex-col gap-6">
            {contracts.map((contract) => (
              <div
                key={contract.id}
                className="rounded-xl overflow-hidden"
                style={{ border: "1px solid rgba(255,255,255,0.1)" }}
              >
                <div className="p-4" style={{ background: "rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm" style={{ color: "#EDE6DD" }}>{contract.milestone}</span>
                    <span className="text-xs" style={{ color: "#A89B8C" }}>{new Date(contract.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                  {contract.milestones.map((ms) => (
                    <div key={ms.id} className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium" style={{ color: "#EDE6DD" }}>{ms.title}</span>
                        <div className="flex items-center gap-2">
                          {ms.regulatoryTags && (
                            <span className="text-xs px-2 py-0.5 rounded" style={{ background: "rgba(196,112,75,0.1)", color: "#C4704B" }}>
                              {ms.regulatoryTags.split(",")[0]}
                            </span>
                          )}
                          <span className="text-xs" style={{ color: "#A89B8C" }}>{ms.scheduleType}</span>
                        </div>
                      </div>

                      {ms.attestationEntries.length === 0 ? (
                        <p className="text-xs" style={{ color: "#A89B8C" }}>No attestation runs yet.</p>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {ms.attestationEntries.map((entry) => (
                            <div
                              key={entry.id}
                              className="rounded-lg p-3"
                              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-mono" style={{ color: "#A89B8C" }}>{entry.period}</span>
                                  <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${VERDICT_BADGE[entry.aiVerdict] ?? ""}`}>
                                    {entry.aiVerdict}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3">
                                  {entry.xrplTxHash && (
                                    <a
                                      href={`https://${xrplExplorer}/transactions/${entry.xrplTxHash}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs"
                                      style={{ color: "#A89B8C", textDecoration: "underline" }}
                                    >
                                      On-chain →
                                    </a>
                                  )}
                                  {entry.certUrl && (
                                    <a
                                      href={entry.certUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs"
                                      style={{ color: "#C4704B", textDecoration: "underline" }}
                                    >
                                      Certificate →
                                    </a>
                                  )}
                                </div>
                              </div>
                              <p className="text-xs" style={{ color: "#A89B8C" }}>{entry.aiReasoning.slice(0, 300)}{entry.aiReasoning.length > 300 ? "…" : ""}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
