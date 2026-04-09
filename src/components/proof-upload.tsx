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

function GitHubIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.335-1.755-1.335-1.755-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

export function ProofUpload({ contractId, milestoneId, onUploaded, replaceMode }: ProofUploadProps) {
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [uploaded, setUploaded] = useState(false);
  const [showReplace, setShowReplace] = useState(false);

  // GitHub optional field
  const [repoUrl, setRepoUrl] = useState("");
  const [showGitHub, setShowGitHub] = useState(false);

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

  const canSubmit = files.length > 0 || (showGitHub && repoUrl.trim().startsWith("https://github.com/"));

  async function handleSubmit() {
    if (!canSubmit) return;
    setLoading(true);
    let lastProofId = "";
    try {
      // Upload files first
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

      // Submit GitHub repo if provided
      const url = repoUrl.trim();
      if (showGitHub && url) {
        if (!url.startsWith("https://github.com/")) {
          toast.error("Please enter a valid GitHub repository URL.");
          setLoading(false);
          return;
        }
        const res = await fetch("/api/proof/github", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            repoUrl: url,
            contractId,
            ...(milestoneId ? { milestoneId } : {}),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to submit GitHub repo");
        lastProofId = data.proofId;
      }

      if (!lastProofId) return;

      setUploaded(true);
      const parts: string[] = [];
      if (files.length > 0) parts.push(`${files.length} file${files.length > 1 ? "s" : ""}`);
      if (showGitHub && repoUrl.trim()) parts.push("GitHub repo");
      toast.success(`${parts.join(" + ")} submitted! AI verification is starting…`);
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
      className="flex flex-col gap-0 rounded-xl overflow-hidden"
      style={{ border: "1px solid rgba(196,112,75,0.3)" }}
    >
      {/* File upload section */}
      <div
        className="flex flex-col gap-4 p-6"
        style={{ background: "rgba(255,255,255,0.03)" }}
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
      </div>

      {/* GitHub optional section */}
      {!uploaded && (
        <div style={{ borderTop: "1px solid rgba(196,112,75,0.15)" }}>
          {!showGitHub ? (
            <button
              type="button"
              onClick={() => setShowGitHub(true)}
              className="w-full flex items-center justify-center gap-2 py-3 text-xs font-medium transition-colors"
              style={{ color: "#A89B8C", background: "rgba(255,255,255,0.02)" }}
            >
              <GitHubIcon />
              Also attach a GitHub repository (optional)
            </button>
          ) : (
            <div className="flex flex-col gap-3 p-5" style={{ background: "rgba(255,255,255,0.02)" }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GitHubIcon />
                  <span className="text-xs font-medium uppercase tracking-widest" style={{ color: "#A89B8C" }}>GitHub Repository</span>
                  <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(196,112,75,0.1)", color: "#C4704B" }}>optional</span>
                </div>
                <button
                  type="button"
                  onClick={() => { setShowGitHub(false); setRepoUrl(""); }}
                  className="text-xs"
                  style={{ color: "#A89B8C" }}
                >
                  Remove
                </button>
              </div>
              <input
                type="url"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/your-org/your-repo"
                className="cs-input"
                disabled={loading}
              />
              <p className="text-xs" style={{ color: "#A89B8C" }}>
                Must be a <strong style={{ color: "#D4B896" }}>public</strong> repository. The AI will analyze commits, README, file structure and activity since the contract start.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Submit button */}
      {!uploaded && canSubmit && (
        <div className="px-6 pb-6 pt-2" style={{ background: "rgba(255,255,255,0.03)" }}>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="w-full rounded-lg py-2.5 text-sm font-semibold transition-colors disabled:opacity-50"
            style={{ background: "#C4704B", color: "#171311" }}
          >
            {loading
              ? "Uploading…"
              : files.length > 0 && showGitHub && repoUrl.trim()
                ? `Upload ${files.length} file${files.length > 1 ? "s" : ""} + GitHub repo & start AI verification`
                : files.length > 0
                  ? `Upload ${files.length} file${files.length > 1 ? "s" : ""} & start AI verification`
                  : "Submit GitHub repo & start AI verification"}
          </button>
        </div>
      )}

      {uploaded && (
        <div className="px-6 pb-6 pt-2" style={{ background: "rgba(255,255,255,0.03)" }}>
          <button
            type="button"
            onClick={() => { setFiles([]); setUploaded(false); setRepoUrl(""); setShowGitHub(false); }}
            className="w-full rounded-lg py-2 text-sm font-medium transition-colors"
            style={{
              background: "rgba(196,112,75,0.1)",
              border: "1px solid rgba(196,112,75,0.35)",
              color: "#C4704B",
            }}
          >
            Upload Other Documents
          </button>
        </div>
      )}
    </div>
  );
}
