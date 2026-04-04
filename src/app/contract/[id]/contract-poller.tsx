"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

interface ContractPollerProps {
  contractId: string;
  currentStatus: string;
  milestoneStatuses: string[];
}

const INTERVAL_MS = 3000;

export function ContractPoller({
  contractId,
  currentStatus,
  milestoneStatuses,
}: ContractPollerProps) {
  const router = useRouter();
  const statusRef = useRef(currentStatus);
  const msStatusesRef = useRef(milestoneStatuses.join(","));

  useEffect(() => {
    statusRef.current = currentStatus;
    msStatusesRef.current = milestoneStatuses.join(",");
  }, [currentStatus, milestoneStatuses]);

  useEffect(() => {
    // Don't poll on terminal states
    if (["COMPLETED", "EXPIRED", "DECLINED"].includes(currentStatus)) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/contracts/${contractId}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();

        const newMsStatuses = (data.milestones ?? []).map((m: { status: string }) => m.status).join(",");

        if (data.status !== statusRef.current || newMsStatuses !== msStatusesRef.current) {
          router.refresh();
        }
      } catch {
        // ignore network errors silently
      }
    }, INTERVAL_MS);

    return () => clearInterval(interval);
  }, [contractId, currentStatus, router]);

  return null;
}
