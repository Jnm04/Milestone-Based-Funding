"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ProofUploadProps {
  contractId: string;
  onUploaded: (proofId: string) => void;
}

export function ProofUpload({ contractId, onUploaded }: ProofUploadProps) {
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (selected.type !== "application/pdf") {
      toast.error("Only PDF files are accepted.");
      return;
    }
    if (selected.size > 10 * 1024 * 1024) {
      toast.error("File must be under 10 MB.");
      return;
    }
    setFile(selected);
  }

  async function handleUpload() {
    if (!file) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("contractId", contractId);

      const res = await fetch("/api/proof/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Upload failed");
      }

      const { proofId } = await res.json();
      toast.success("Proof uploaded! AI verification is starting…");
      onUploaded(proofId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 p-6 border-2 border-dashed rounded-xl bg-zinc-50">
      <div className="text-center">
        <p className="text-sm font-medium text-zinc-700">Upload Milestone Proof (PDF)</p>
        <p className="text-xs text-muted-foreground mt-1">Max 10 MB · PDF only</p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={handleFileChange}
      />

      {file ? (
        <div className="flex items-center gap-3 bg-white rounded-lg border px-4 py-3">
          <span className="text-sm text-zinc-700 flex-1 truncate">{file.name}</span>
          <button
            type="button"
            className="text-xs text-red-500 hover:underline"
            onClick={() => {
              setFile(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
          >
            Remove
          </button>
        </div>
      ) : (
        <Button
          variant="outline"
          onClick={() => inputRef.current?.click()}
          type="button"
        >
          Select PDF
        </Button>
      )}

      {file && (
        <Button onClick={handleUpload} disabled={loading}>
          {loading ? "Uploading…" : "Upload & Trigger AI Verification"}
        </Button>
      )}
    </div>
  );
}
