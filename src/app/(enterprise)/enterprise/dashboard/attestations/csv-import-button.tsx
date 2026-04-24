"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function CsvImportButton() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/enterprise/import/csv", { method: "POST", body: fd });
      const data = await res.json() as { contractId?: string; milestoneCount?: number; error?: string; details?: string[] };
      if (!res.ok) {
        if (data.details && data.details.length > 0) {
          toast.error(data.details.slice(0, 3).join(" · "));
        } else {
          toast.error(data.error ?? "Import failed");
        }
        return;
      }
      toast.success(`Imported ${data.milestoneCount} milestone${data.milestoneCount === 1 ? "" : "s"}`);
      router.push(`/enterprise/dashboard/attestations/${data.contractId}`);
      router.refresh();
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <>
      <input ref={inputRef} type="file" accept=".csv" style={{ display: "none" }} onChange={handleFile} />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={loading}
        style={{
          background: "white",
          color: "var(--ent-text)",
          border: "1px solid var(--ent-border)",
          borderRadius: 7,
          padding: "9px 16px",
          fontSize: 13,
          fontWeight: 500,
          cursor: loading ? "not-allowed" : "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          opacity: loading ? 0.6 : 1,
        }}
        title="Import milestones from CSV (columns: title, deadline, description, verificationCriteria)"
      >
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
        </svg>
        {loading ? "Importing…" : "Import CSV"}
      </button>
    </>
  );
}
