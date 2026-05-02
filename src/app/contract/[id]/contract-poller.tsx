"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

interface ContractPollerProps {
  contractId: string;
  currentStatus: string;
  milestoneStatuses: string[];
  hasNft?: boolean;
}

const INTERVAL_MS = 1500;

export function ContractPoller({
  contractId,
  currentStatus,
  milestoneStatuses,
  hasNft = false,
}: ContractPollerProps) {
  const router = useRouter();
  const statusRef = useRef(currentStatus);
  const msStatusesRef = useRef(milestoneStatuses.join(","));

  useEffect(() => {
    statusRef.current = currentStatus;
    msStatusesRef.current = milestoneStatuses.join(",");
  }, [currentStatus, milestoneStatuses]);

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
