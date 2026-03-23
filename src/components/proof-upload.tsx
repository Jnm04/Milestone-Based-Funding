"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ProofUploadProps {
  contractId: string;
  milestoneId?: string | null;
  onUploaded: (proofId: string) => void;
}

const ACCEPTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "text/csv",
  "text/plain",
].join(",");

const MAX_SIZE = 20 * 1024 * 1024; // 20 MB

function fileTypeLabel(file: File): string {
  const ext = file.name.split(".").pop()?.toUpperCase() ?? "FILE";
  return ext;
}

export function ProofUpload({ contractId, milestoneId, onUploaded }: ProofUploadProps) {
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploaded, setUploaded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (selected.size > MAX_SIZE) {
      toast.error("File must be under 20 MB.");
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
      if (milestoneId) formData.append("milestoneId", milestoneId);

      const res = await fetch("/api/proof/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Upload failed");
      }

      const { proofId } = await res.json();
      setUploaded(true);
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
        <p className="text-sm font-medium text-zinc-700">Upload Milestone Proof</p>
        <p className="text-xs text-muted-foreground mt-1">
          PDF, DOCX, PPTX, XLSX · Images (JPG, PNG, WEBP) · CSV, TXT · Max 20 MB
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        className="hidden"
        onChange={handleFileChange}
      />

      {file ? (
        <div className="flex items-center gap-3 bg-white rounded-lg border px-4 py-3">
          <span className="text-xs font-mono bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded">
            {fileTypeLabel(file)}
          </span>
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
          Select File
        </Button>
      )}

      {file && !uploaded && (
        <Button onClick={handleUpload} disabled={loading}>
          {loading ? "Uploading…" : "Upload & Trigger AI Verification"}
        </Button>
      )}

      {uploaded && (
        <Button
          variant="outline"
          onClick={() => {
            setFile(null);
            setUploaded(false);
            if (inputRef.current) inputRef.current.value = "";
          }}
        >
          Upload a different document
        </Button>
      )}
    </div>
  );
}
