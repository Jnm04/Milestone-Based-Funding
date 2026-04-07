"use client";

import { useState, useEffect } from "react";
import { NftCertificate } from "./nft-certificate";

interface Cert {
  tokenId: string;
  txHash: string;
  title: string;
  amountUSD: string;
  completedAt: string;
}

interface NftSectionProps {
  contractId: string;
  milestoneId?: string | null;
  certs: Cert[];
  isCompleted: boolean;
}

export function NftSection({ contractId, milestoneId, certs: initialCerts, isCompleted }: NftSectionProps) {
  const [certs, setCerts] = useState<Cert[]>(initialCerts);
  const [minting, setMinting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasCerts = certs.length > 0;

  // Auto-trigger mint if completed but no NFT yet
  useEffect(() => {
    if (!isCompleted || hasCerts) return;
    triggerMint();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function triggerMint() {
    setMinting(true);
    setError(null);
    try {
      const res = await fetch("/api/nft/mint-for-contract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractId, milestoneId: milestoneId ?? undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Minting failed");
        return;
      }
      if (data.alreadyMinted) {
        // Reload to get the token data from DB
        window.location.reload();
        return;
      }
      // Reload to show the new certificate
      window.location.reload();
    } catch {
      setError("Network error — please try again");
    } finally {
      setMinting(false);
    }
  }

  if (hasCerts) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <span className="text-xs uppercase tracking-widest font-medium" style={{ color: "#D4B896" }}>
          Completion Certificates
        </span>
        {certs.map((c) => (
          <NftCertificate
            key={c.tokenId}
            tokenId={c.tokenId}
            txHash={c.txHash}
            milestoneTitle={c.title}
            amountUSD={c.amountUSD}
            completedAt={c.completedAt}
          />
        ))}
      </div>
    );
  }

  if (!isCompleted) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <span className="text-xs uppercase tracking-widest font-medium" style={{ color: "#D4B896" }}>
        Completion Certificates
      </span>
      <div
        style={{
          padding: "20px 24px",
          borderRadius: 16,
          border: "1px dashed rgba(212,184,150,0.25)",
          background: "rgba(212,184,150,0.03)",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <p className="text-sm" style={{ color: "#A89B8C" }}>
          {minting
            ? "Minting your XRPL completion certificate…"
            : "Your completion certificate is being minted on the XRPL Ledger."}
        </p>
        {error && (
          <p className="text-xs" style={{ color: "#f87171" }}>{error}</p>
        )}
        {!minting && (
          <button
            onClick={triggerMint}
            className="cs-btn-ghost cs-btn-sm"
            style={{ alignSelf: "flex-start" }}
          >
            {error ? "Retry" : "Mint Certificate"}
          </button>
        )}
        {minting && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              className="w-4 h-4 rounded-full border-2 animate-spin"
              style={{ borderColor: "rgba(212,184,150,0.3)", borderTopColor: "#D4B896" }}
            />
            <span className="text-xs" style={{ color: "#A89B8C" }}>Connecting to XRPL…</span>
          </div>
        )}
      </div>
    </div>
  );
}
