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
    <div className="flex flex-col gap-4 p-6 border-2 border-dashed rounded-xl bg-zinc-50">
      <div className="text-center">
        <p className="text-sm font-medium text-zinc-700">Upload Milestone Proof</p>
        <p className="text-xs text-zinc-500 mt-1">
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
            <div key={file.name} className="flex items-center gap-3 bg-white rounded-lg border px-4 py-3">
              <span className="text-xs font-mono bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded">
                {fileTypeLabel(file)}
              </span>
              <span className="text-sm text-zinc-700 flex-1 truncate">{file.name}</span>
              <button
                type="button"
                className="text-xs text-red-500 hover:underline"
                onClick={() => removeFile(file.name)}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {!uploaded && (
        <Button
          variant="outline"
          onClick={() => inputRef.current?.click()}
          type="button"
          disabled={loading}
        >
          {files.length > 0 ? "Add Another File" : "Select File"}
        </Button>
      )}

      {files.length > 0 && !uploaded && (
        <Button onClick={handleUpload} disabled={loading}>
          {loading
            ? "Uploading…"
            : `Upload ${files.length} file${files.length > 1 ? "s" : ""} & start AI verification`}
        </Button>
      )}

      {uploaded && (
        <Button
          variant="outline"
          onClick={() => {
            setFiles([]);
            setUploaded(false);
          }}
        >
          Upload Other Documents
        </Button>
      )}
    </div>
  );
}
