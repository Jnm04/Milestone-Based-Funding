"use client";

import { useState } from "react";
import { toast } from "sonner";

interface Props {
  contractId: string;
}

export function AuditorShare({ contractId }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const link = `${window.location.origin}/enterprise/share/${contractId}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("Share link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for browsers that block clipboard API
      toast.error("Could not copy. Link: " + link);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      style={{
        background: copied ? "#ECFDF5" : "white",
        color: copied ? "#059669" : "var(--ent-text)",
        border: `1px solid ${copied ? "#A7F3D0" : "var(--ent-border)"}`,
        borderRadius: 7,
        padding: "7px 14px",
        fontSize: 12.5,
        fontWeight: 500,
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        transition: "all 0.15s ease",
        whiteSpace: "nowrap",
      }}
    >
      {copied ? (
        <>
          <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
          Copied!
        </>
      ) : (
        <>
          <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
          </svg>
          Copy Share Link
        </>
      )}
    </button>
  );
}
