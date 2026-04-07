"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

interface ContractPollerProps {
  contractId: string;
  currentStatus: string;
  milestoneStatuses: string[];
  // NFT fields — if COMPLETED but missing NFT, trigger mint automatically
  hasNft?: boolean;
  completedMilestoneId?: string | null;
}

const INTERVAL_MS = 3000;

export function ContractPoller({
  contractId,
  currentStatus,
  milestoneStatuses,
  hasNft = false,
  completedMilestoneId,
}: ContractPollerProps) {
  const router = useRouter();
  const statusRef = useRef(currentStatus);
  const msStatusesRef = useRef(milestoneStatuses.join(","));
  const nftTriggered = useRef(false);

  useEffect(() => {
    statusRef.current = currentStatus;
    msStatusesRef.current = milestoneStatuses.join(",");
  }, [currentStatus, milestoneStatuses]);

  // When contract/milestone is COMPLETED but NFT is missing, trigger mint as a
  // separate request — decoupled from the verify/finish routes to avoid timeouts.
  useEffect(() => {
    if (nftTriggered.current) return;
    if (!hasNft && currentStatus === "COMPLETED") {
      nftTriggered.current = true;
      fetch("/api/nft/mint-for-contract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractId,
          milestoneId: completedMilestoneId ?? undefined,
        }),
      })
        .then(() => {
          // Refresh after a short delay to show the certificate
          setTimeout(() => router.refresh(), 2000);
        })
        .catch(() => {/* silent — non-critical */});
    }
  }, [contractId, currentStatus, hasNft, completedMilestoneId, router]);

  useEffect(() => {
    // Keep polling even on COMPLETED until NFT appears
    const isTerminal = ["EXPIRED", "DECLINED"].includes(currentStatus) ||
      (currentStatus === "COMPLETED" && hasNft);
    if (isTerminal) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/contracts/${contractId}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();

        const newMsStatuses = (data.milestones ?? []).map((m: { status: string }) => m.status).join(",");
        const newHasNft = data.nftTokenId ||
          (data.milestones ?? []).some((m: { nftTokenId?: string }) => m.nftTokenId);

        if (
          data.status !== statusRef.current ||
          newMsStatuses !== msStatusesRef.current ||
          (newHasNft && !hasNft)
        ) {
          router.refresh();
        }
      } catch {
        // ignore network errors silently
      }
    }, INTERVAL_MS);

    return () => clearInterval(interval);
  }, [contractId, currentStatus, hasNft, router]);

  return null;
}
