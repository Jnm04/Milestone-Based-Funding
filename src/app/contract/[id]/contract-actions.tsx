"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ProofUpload } from "@/components/proof-upload";
import { toast } from "sonner";
import { ContractStatus } from "@/types";
import Image from "next/image";

interface ContractActionsProps {
  contractId: string;
  status: ContractStatus;
  investorAddress: string;
  startupAddress: string | null;
  escrowSequence: number | null;
  escrowCondition: string | null;
  amountRLUSD: string;
  cancelAfter: string;
  latestProofId: string | null;
  latestProofReasoning: string | null;
  latestProofConfidence: number | null;
  viewerWallet: string | null;
}

export function ContractActions({
  contractId,
  status,
  investorAddress,
  startupAddress,
  escrowSequence: _escrowSequence,
  escrowCondition: _escrowCondition,
  amountRLUSD,
  cancelAfter,
  latestProofId,
  latestProofReasoning,
  latestProofConfidence,
  viewerWallet,
}: ContractActionsProps) {
  const [escrowStep, setEscrowStep] = useState<"idle" | "qr" | "polling" | "done">("idle");
  const [escrowQr, setEscrowQr] = useState<string | null>(null);
  const [loadingVerify, setLoadingVerify] = useState(false);
  const [loadingReview, setLoadingReview] = useState<"APPROVE" | "REJECT" | null>(null);
  const [loadingFinish, setLoadingFinish] = useState(false);
  const [loadingCancel, setLoadingCancel] = useState(false);
  const [loadingResubmit, setLoadingResubmit] = useState(false);
  const [verifyDone, setVerifyDone] = useState(false);
  const [finishStep, setFinishStep] = useState<"idle" | "qr" | "polling" | "done">("idle");
  const [finishQr, setFinishQr] = useState<string | null>(null);

  async function handleFundEscrow() {
    setEscrowStep("qr");
    try {
      const res = await fetch("/api/escrow/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Escrow creation failed");
      }
      const { qrPng, payloadUuid } = await res.json();
      setEscrowQr(qrPng);
      setEscrowStep("polling");
      toast.info("Scan the QR code with Xaman to sign the EscrowCreate.");

      // Poll Xumm until the user signs (max 10 min)
      const deadline = Date.now() + 10 * 60 * 1000;
      const interval = setInterval(async () => {
        if (Date.now() > deadline) {
          clearInterval(interval);
          setEscrowStep("idle");
          setEscrowQr(null);
          toast.error("Sign request expired.");
          return;
        }
        try {
          const poll = await fetch(`/api/auth/xumm-result?uuid=${payloadUuid}`);
          if (!poll.ok) return;
          const data = await poll.json();

          if (data.signed) {
            clearInterval(interval);
            toast.info("Signed! Confirming escrow on XRPL…");
            // Confirm server-side: fetch sequence from XRPL, set status=FUNDED
            const confirm = await fetch("/api/escrow/confirm", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ contractId, payloadUuid }),
            });
            if (confirm.ok) {
              setEscrowStep("done");
              toast.success("Escrow funded! Reloading…");
              setTimeout(() => window.location.reload(), 1200);
            } else {
              const e = await confirm.json();
              toast.error(e.error ?? "Confirm failed.");
              setEscrowStep("idle");
              setEscrowQr(null);
            }
          } else if (data.resolved && !data.signed) {
            clearInterval(interval);
            setEscrowStep("idle");
            setEscrowQr(null);
            toast.error("Rejected in Xaman.");
          }
        } catch { /* transient — keep polling */ }
      }, 2000);
    } catch (err) {
      setEscrowStep("idle");
      setEscrowQr(null);
      toast.error(err instanceof Error ? err.message : "Escrow failed.");
    }
  }

  async function handleVerify(proofId: string) {
    setLoadingVerify(true);
    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proofId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Verification failed");
      }
      const result = await res.json();
      if (result.decision === "YES") {
        toast.success("AI approved! Escrow release triggered.");
      } else {
        toast.error(`AI rejected: ${result.reasoning}`);
      }
      setVerifyDone(true);
      // Reload to show updated status
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setLoadingVerify(false);
    }
  }

  async function handleFinishEscrow() {
    setFinishStep("qr");
    try {
      const res = await fetch("/api/escrow/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "EscrowFinish failed");
      }
      const { qrPng, payloadUuid } = await res.json();
      setFinishQr(qrPng);
      setFinishStep("polling");
      toast.info("Scan the QR code with Xaman to release funds.");

      // Poll until signed (max 10 min)
      const deadline = Date.now() + 10 * 60 * 1000;
      const interval = setInterval(async () => {
        if (Date.now() > deadline) {
          clearInterval(interval);
          setFinishStep("idle");
          setFinishQr(null);
          toast.error("Sign request expired.");
          return;
        }
        try {
          const poll = await fetch(`/api/auth/xumm-result?uuid=${payloadUuid}`);
          if (!poll.ok) return;
          const data = await poll.json();

          if (data.signed) {
            clearInterval(interval);
            toast.info("Signed! Submitting EscrowFinish to XRPL…");
            // Confirm outside the swallowing catch block
            try {
              const confirm = await fetch("/api/escrow/finish/confirm", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ contractId, payloadUuid }),
              });
              if (confirm.ok) {
                setFinishStep("done");
                toast.success("Funds released! Contract completed.");
                setTimeout(() => window.location.reload(), 1500);
              } else {
                const e = await confirm.json();
                toast.error(e.error ?? "Confirm failed.");
                setFinishStep("idle");
                setFinishQr(null);
              }
            } catch (confirmErr) {
              toast.error(confirmErr instanceof Error ? confirmErr.message : "Confirm failed.");
              setFinishStep("idle");
              setFinishQr(null);
            }
          } else if (data.resolved && !data.signed) {
            clearInterval(interval);
            setFinishStep("idle");
            setFinishQr(null);
            toast.error("Rejected in Xaman.");
          }
        } catch { /* transient network error — keep polling */ }
      }, 2000);
    } catch (err) {
      setFinishStep("idle");
      setFinishQr(null);
      toast.error(err instanceof Error ? err.message : "EscrowFinish failed.");
    }
  }

  async function handleCancelEscrow() {
    setLoadingCancel(true);
    try {
      const res = await fetch("/api/escrow/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "EscrowCancel failed");
      }
      const data = await res.json();
      if (data.action === "already_closed") {
        toast.success("Escrow already closed. Contract marked as expired.");
        setTimeout(() => window.location.reload(), 1000);
      } else {
        toast.info("Opening Xumm — sign the EscrowCancel to recover your funds.");
        window.open(data.xummUrl, "_blank");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "EscrowCancel failed.");
    } finally {
      setLoadingCancel(false);
    }
  }

  async function handleReview(decision: "APPROVE" | "REJECT") {
    setLoadingReview(decision);
    try {
      const res = await fetch("/api/contracts/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractId, decision }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Review failed");
      }
      toast.success(decision === "APPROVE" ? "Freigegeben! Startup kann jetzt auszahlen." : "Abgelehnt. Startup kann neu einreichen.");
      setTimeout(() => window.location.reload(), 1200);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Review fehlgeschlagen.");
    } finally {
      setLoadingReview(null);
    }
  }

  async function handleResubmit() {
    setLoadingResubmit(true);
    try {
      const res = await fetch("/api/contracts/resubmit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Resubmit failed");
      }
      toast.success("Contract reset — you can now upload a new proof.");
      setTimeout(() => window.location.reload(), 1000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Resubmit failed.");
    } finally {
      setLoadingResubmit(false);
    }
  }

  const isExpired = new Date() >= new Date(cancelAfter);

  // AWAITING_ESCROW: only the investor can fund
  if (status === "AWAITING_ESCROW") {
    if (viewerWallet !== investorAddress) {
      return (
        <div className="flex flex-col gap-3 p-5 bg-amber-50 border border-amber-200 rounded-xl">
          <p className="text-sm font-medium text-amber-800">
            Waiting for the investor to fund the escrow.
          </p>
        </div>
      );
    }
    if ((escrowStep === "qr" || escrowStep === "polling") && escrowQr) {
      return (
        <div className="flex flex-col items-center gap-4 p-5 bg-amber-50 border border-amber-200 rounded-xl">
          <p className="text-sm font-medium text-amber-800">
            Scan with Xaman to sign the EscrowCreate transaction
          </p>
          <Image src={escrowQr} alt="Xumm QR code" width={192} height={192} className="rounded-lg border" unoptimized />
          <p className="text-xs text-amber-600 animate-pulse">Waiting for Xaman signature…</p>
          <Button variant="ghost" size="sm" onClick={() => { setEscrowStep("idle"); setEscrowQr(null); }}>
            Cancel
          </Button>
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-3 p-5 bg-amber-50 border border-amber-200 rounded-xl">
        <p className="text-sm font-medium text-amber-800">
          Both parties have committed. Fund the escrow to lock funds.
        </p>
        <Button onClick={handleFundEscrow} disabled={escrowStep === "qr"}>
          {escrowStep === "qr" ? "Opening Xaman…" : "Fund Escrow via Xaman"}
        </Button>
      </div>
    );
  }

  // FUNDED: only startup uploads proof
  if (status === "FUNDED") {
    if (viewerWallet !== startupAddress) {
      return (
        <div className="flex flex-col gap-3 p-5 bg-blue-50 border border-blue-200 rounded-xl">
          <p className="text-sm font-medium text-blue-800">
            Waiting for the startup to upload milestone proof.
          </p>
        </div>
      );
    }
    return (
      <ProofUpload
        contractId={contractId}
        onUploaded={(proofId) => handleVerify(proofId)}
      />
    );
  }

  // PROOF_SUBMITTED: trigger AI verification manually (if not auto-triggered)
  if (status === "PROOF_SUBMITTED" && latestProofId && !verifyDone) {
    return (
      <div className="flex flex-col gap-3 p-5 bg-blue-50 border border-blue-200 rounded-xl">
        <p className="text-sm text-blue-800">Proof uploaded. Ready for AI verification.</p>
        <Button
          onClick={() => handleVerify(latestProofId)}
          disabled={loadingVerify}
        >
          {loadingVerify ? "Verifying…" : "Run AI Verification"}
        </Button>
      </div>
    );
  }

  // PENDING_REVIEW: investor manually approves or rejects
  if (status === "PENDING_REVIEW") {
    return (
      <div className="flex flex-col gap-4 p-5 bg-amber-50 border border-amber-200 rounded-xl">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-amber-900">Manuelle Prüfung erforderlich</p>
          {latestProofConfidence !== null && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
              KI-Sicherheit: {latestProofConfidence}%
            </span>
          )}
        </div>

        {latestProofReasoning && (
          <div className="flex flex-col gap-1">
            <p className="text-xs font-medium text-amber-700 uppercase tracking-wide">KI-Analyse</p>
            <p className="text-sm text-amber-900 leading-relaxed bg-amber-100 rounded-lg p-3">
              {latestProofReasoning}
            </p>
          </div>
        )}

        {viewerWallet === investorAddress ? (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-amber-700">
              Die KI war nicht sicher genug für eine automatische Entscheidung. Bitte prüfe den Nachweis und entscheide manuell.
            </p>
            <div className="flex gap-3">
              <Button
                onClick={() => handleReview("APPROVE")}
                disabled={loadingReview !== null}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              >
                {loadingReview === "APPROVE" ? "Wird freigegeben…" : "✓ Freigeben"}
              </Button>
              <Button
                onClick={() => handleReview("REJECT")}
                disabled={loadingReview !== null}
                variant="outline"
                className="flex-1 border-red-300 text-red-700 hover:bg-red-50"
              >
                {loadingReview === "REJECT" ? "Wird abgelehnt…" : "✗ Ablehnen"}
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-amber-700">
            Der Investor prüft deinen Nachweis. Du wirst benachrichtigt sobald eine Entscheidung getroffen wurde.
          </p>
        )}
      </div>
    );
  }

  // VERIFIED: startup signs EscrowFinish to release funds
  if (status === "VERIFIED") {
    if ((finishStep === "qr" || finishStep === "polling") && finishQr) {
      return (
        <div className="flex flex-col items-center gap-4 p-5 bg-green-50 border border-green-200 rounded-xl">
          <p className="text-sm font-medium text-green-800">
            Scan with Xaman to release the funds
          </p>
          <Image src={finishQr} alt="Xumm QR code" width={192} height={192} className="rounded-lg border" unoptimized />
          <p className="text-xs text-green-600 animate-pulse">Waiting for Xaman signature…</p>
          <Button variant="ghost" size="sm" onClick={() => { setFinishStep("idle"); setFinishQr(null); }}>
            Cancel
          </Button>
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-3 p-5 bg-green-50 border border-green-200 rounded-xl">
        <p className="text-sm font-medium text-green-800">
          AI approved the milestone! Sign with Xaman to receive your funds.
        </p>
        <Button onClick={handleFinishEscrow} disabled={finishStep !== "idle"}>
          {finishStep !== "idle" ? "Opening Xaman…" : "Release Funds via Xaman"}
        </Button>
      </div>
    );
  }

  // REJECTED: startup can resubmit, or cancel if expired
  if (status === "REJECTED") {
    return (
      <div className="flex flex-col gap-3 p-5 bg-red-50 border border-red-200 rounded-xl">
        <p className="text-sm font-medium text-red-800">AI rejected the proof.</p>
        {isExpired ? (
          <>
            <p className="text-xs text-red-700">Deadline has passed. You can cancel the escrow to recover funds.</p>
            <Button variant="destructive" onClick={handleCancelEscrow} disabled={loadingCancel}>
              {loadingCancel ? "Opening Xumm…" : "Cancel Escrow & Recover Funds"}
            </Button>
          </>
        ) : (
          <Button variant="outline" onClick={handleResubmit} disabled={loadingResubmit}>
            {loadingResubmit ? "Resetting…" : "Resubmit New Proof"}
          </Button>
        )}
      </div>
    );
  }

  // FUNDED or EXPIRED with escrow still open: show cancel option when deadline passed
  if (["FUNDED", "PROOF_SUBMITTED"].includes(status) && isExpired) {
    return (
      <div className="flex flex-col gap-3 p-5 bg-orange-50 border border-orange-200 rounded-xl">
        <p className="text-sm font-medium text-orange-800">
          Deadline has passed. Cancel the escrow to recover your RLUSD.
        </p>
        <Button variant="destructive" onClick={handleCancelEscrow} disabled={loadingCancel}>
          {loadingCancel ? "Opening Xumm…" : "Cancel Escrow & Recover Funds"}
        </Button>
      </div>
    );
  }

  return null;
}
