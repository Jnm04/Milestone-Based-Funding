"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ProofUploadProps {
  contractId: string;
  milestoneId?: string | null;
  onUploaded: (proofId: string) => void;
  replaceMode?: boolean;
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
  return file.name.split(".").pop()?.toUpperCase() ?? "FILE";
}

export function ProofUpload({ contractId, milestoneId, onUploaded, replaceMode }: ProofUploadProps) {
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [uploaded, setUploaded] = useState(false);
  const [showReplace, setShowReplace] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    const oversized = selected.filter((f) => f.size > MAX_SIZE);
    if (oversized.length > 0) {
      toast.error(`${oversized.map((f) => f.name).join(", ")} exceed 20 MB limit.`);
      return;
    }
    setFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name));
      return [...prev, ...selected.filter((f) => !existing.has(f.name))];
    });
    if (inputRef.current) inputRef.current.value = "";
  }

  function removeFile(name: string) {
    setFiles((prev) => prev.filter((f) => f.name !== name));
  }

  async function handleUpload() {
    if (files.length === 0) return;
    setLoading(true);
    let lastProofId = "";
    try {
      for (const file of files) {
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
          throw new Error(`${file.name}: ${err.error ?? "Upload failed"}`);
        }

        const { proofId } = await res.json();
        lastProofId = proofId;
      }

      setUploaded(true);
      toast.success(`${files.length} file${files.length > 1 ? "s" : ""} uploaded! AI verification is starting…`);
      onUploaded(lastProofId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setLoading(false);
    }
  }

  // In replaceMode, show just a button until the user clicks it
  if (replaceMode && !showReplace) {
    return (
      <Button variant="outline" onClick={() => setShowReplace(true)} type="button">
        Replace File
      </Button>
    );
  }

  return (
    <div
      className="flex flex-col gap-4 p-6 rounded-xl"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "2px dashed rgba(196,112,75,0.3)",
      }}
    >
      <div className="text-center">
        <p className="text-sm font-medium" style={{ color: "#EDE6DD" }}>Upload Milestone Proof</p>
        <p className="text-xs mt-1" style={{ color: "#A89B8C" }}>
          PDF, DOCX, PPTX, XLSX · Images (JPG, PNG, WEBP) · CSV, TXT · Max 20 MB · Multiple files supported
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      {files.length > 0 && (
        <div className="flex flex-col gap-2">
          {files.map((file) => (
            <div
              key={file.name}
              className="flex items-center gap-3 rounded-lg px-4 py-3"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(196,112,75,0.2)" }}
            >
              <span
                className="text-xs font-mono px-1.5 py-0.5 rounded"
                style={{ background: "rgba(196,112,75,0.15)", color: "#C4704B" }}
              >
                {fileTypeLabel(file)}
              </span>
              <span className="text-sm flex-1 truncate" style={{ color: "#EDE6DD" }}>{file.name}</span>
              <button
                type="button"
                className="text-xs hover:underline"
                style={{ color: "#ef4444" }}
                onClick={() => removeFile(file.name)}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {!uploaded && (
        <button
          type="button"
          disabled={loading}
          onClick={() => inputRef.current?.click()}
          className="w-full rounded-lg py-2 text-sm font-medium transition-colors disabled:opacity-50"
          style={{
            background: "rgba(196,112,75,0.1)",
            border: "1px solid rgba(196,112,75,0.35)",
            color: "#C4704B",
          }}
        >
          {files.length > 0 ? "Add Another File" : "Select File"}
        </button>
      )}

      {files.length > 0 && !uploaded && (
        <button
          type="button"
          onClick={handleUpload}
          disabled={loading}
          className="w-full rounded-lg py-2.5 text-sm font-semibold transition-colors disabled:opacity-50"
          style={{ background: "#C4704B", color: "#171311" }}
        >
          {loading
            ? "Uploading…"
            : `Upload ${files.length} file${files.length > 1 ? "s" : ""} & start AI verification`}
        </button>
      )}

      {uploaded && (
        <button
          type="button"
          onClick={() => { setFiles([]); setUploaded(false); }}
          className="w-full rounded-lg py-2 text-sm font-medium transition-colors"
          style={{
            background: "rgba(196,112,75,0.1)",
            border: "1px solid rgba(196,112,75,0.35)",
            color: "#C4704B",
          }}
        >
          Upload Other Documents
        </button>
      )}
    </div>
  );
}
