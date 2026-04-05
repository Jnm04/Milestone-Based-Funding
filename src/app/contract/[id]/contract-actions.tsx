"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ProofUpload } from "@/components/proof-upload";
import { toast } from "sonner";
import { ContractStatus } from "@/types";
import { XRPL_EVM_CHAIN_ID, ERC20_ABI, toRLUSDUnits } from "@/lib/evm-abi";
import { ethers } from "ethers";

interface ContractActionsProps {
  contractId: string;
  status: ContractStatus;
  investorAddress: string;
  startupAddress: string | null;
  amountRLUSD: string;
  cancelAfter: string;
  milestoneId: string | null;
  milestoneTitle: string | null;
  milestoneNumber: number | null;
  totalMilestones: number;
  latestProofId: string | null;
  latestProofReasoning: string | null;
  latestProofConfidence: number | null;
  latestProofFileUrl: string | null;
  latestProofFileName: string | null;
  viewerWallet: string | null;
}

// ─── MetaMask helpers ────────────────────────────────────────────────────────

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      isMetaMask?: boolean;
    };
  }
}

/** Extract a human-readable message from any thrown value (Error or MetaMask object). */
function extractError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    if (typeof e.message === "string") return e.message;
    if (typeof e.error === "string") return e.error;
  }
  return String(err);
}

/** Ensure MetaMask is connected and on the XRPL EVM chain (always refreshes RPC). */
async function connectMetaMask(): Promise<string> {
  if (!window.ethereum) {
    throw new Error(
      "MetaMask is not installed. Please install MetaMask to fund the escrow."
    );
  }
  const accounts = (await window.ethereum.request({
    method: "eth_requestAccounts",
  })) as string[];

  if (!accounts || accounts.length === 0) {
    throw new Error("No MetaMask account selected.");
  }

  const targetChainId = `0x${XRPL_EVM_CHAIN_ID.toString(16)}`;
  const chainParams = {
    chainId: targetChainId,
    chainName: "XRPL EVM Sidechain Testnet",
    nativeCurrency: { name: "XRP", symbol: "XRP", decimals: 18 },
    rpcUrls: [
      process.env.NEXT_PUBLIC_EVM_RPC_URL ?? "https://1449000.rpc.thirdweb.com",
    ],
    blockExplorerUrls: ["https://explorer.xrplevm.org"],
  };

  // Always call addEthereumChain — MetaMask updates RPC if chain already exists
  try {
    await window.ethereum.request({
      method: "wallet_addEthereumChain",
      params: [chainParams],
    });
  } catch {
    // Chain exists and MetaMask rejected the update prompt — just switch
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: targetChainId }],
      });
    } catch (switchErr) {
      throw new Error(`Failed to switch to XRPL EVM chain: ${extractError(switchErr)}`);
    }
  }

  // Confirm we're on the right chain
  const chainId = (await window.ethereum.request({ method: "eth_chainId" })) as string;
  if (parseInt(chainId, 16) !== XRPL_EVM_CHAIN_ID) {
    throw new Error("Wrong network selected in MetaMask. Please switch to XRPL EVM Sidechain Testnet.");
  }

  return accounts[0].toLowerCase();
}

/** Send a raw EVM transaction and return the tx hash. */
async function sendTx(from: string, to: string, data: string): Promise<string> {
  const txHash = (await window.ethereum!.request({
    method: "eth_sendTransaction",
    params: [{ from, to, data }],
  })) as string;
  return txHash;
}

/** Call MockRLUSD.faucet(amount) to mint test tokens into the caller's wallet. */
async function callFaucet(from: string, amountUSD: string): Promise<void> {
  const rlusdAddress = process.env.NEXT_PUBLIC_RLUSD_CONTRACT_ADDRESS!;
  const iface = new ethers.Interface(ERC20_ABI);
  const amount = toRLUSDUnits(amountUSD);
  const data = iface.encodeFunctionData("faucet", [amount]);
  const txHash = await sendTx(from, rlusdAddress, data);
  await waitForReceipt(txHash);
}

/** Poll eth_getTransactionReceipt until the tx is mined (max 5 min). */
async function waitForReceipt(txHash: string): Promise<void> {
  const deadline = Date.now() + 5 * 60 * 1000;
  while (Date.now() < deadline) {
    const receipt = (await window.ethereum!.request({
      method: "eth_getTransactionReceipt",
      params: [txHash],
    })) as { status: string } | null;

    if (receipt) {
      if (receipt.status !== "0x1") {
        throw new Error("Transaction reverted on-chain.");
      }
      return;
    }
    await new Promise((r) => setTimeout(r, 4000));
  }
  throw new Error("Transaction not mined within 5 minutes.");
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ContractActions({
  contractId,
  status,
  investorAddress,
  startupAddress,
  amountRLUSD,
  cancelAfter,
  milestoneId,
  milestoneTitle,
  milestoneNumber,
  totalMilestones,
  latestProofId,
  latestProofReasoning,
  latestProofConfidence,
  latestProofFileUrl,
  latestProofFileName,
  viewerWallet,
}: ContractActionsProps) {
  const [fundingStep, setFundingStep] = useState<
    "idle" | "approving" | "funding" | "confirming" | "done"
  >("idle");
  const [faucetLoading, setFaucetLoading] = useState(false);
  const [loadingVerify, setLoadingVerify] = useState(false);
  const [loadingReview, setLoadingReview] = useState<"APPROVE" | "REJECT" | null>(null);
  const [loadingFinish, setLoadingFinish] = useState(false);
  const [loadingCancel, setLoadingCancel] = useState(false);
  const [loadingResubmit, setLoadingResubmit] = useState(false);
  const [verifyDone, setVerifyDone] = useState(false);

  // ── Mint test RLUSD via MockRLUSD.faucet() ───────────────────────────────
  async function handleFaucet() {
    setFaucetLoading(true);
    try {
      const account = await connectMetaMask();
      toast.info("Minting test RLUSD to your wallet…");
      await callFaucet(account, amountRLUSD);
      toast.success(`Minted ${amountRLUSD} RLUSD to your wallet! You can now fund the escrow.`);
    } catch (err) {
      console.error("Faucet error:", err);
      toast.error(extractError(err));
    } finally {
      setFaucetLoading(false);
    }
  }

  // ── Fund escrow via MetaMask ──────────────────────────────────────────────
  async function handleFundEscrow() {
    setFundingStep("approving");
    try {
      const account = await connectMetaMask();

      // 1. Get pre-encoded calldata from backend
      const res = await fetch("/api/escrow/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractId, milestoneId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to prepare escrow transaction");
      }
      const { rlusdAddress, escrowContractAddress, approveCalldata, fundCalldata } =
        await res.json();

      // 2. Step 1 — Approve RLUSD spending
      toast.info("Step 1/2: Approve RLUSD in MetaMask…");
      const approveTxHash = await sendTx(account, rlusdAddress, approveCalldata);
      await waitForReceipt(approveTxHash);
      toast.info("Approved! Step 2/2: Fund escrow in MetaMask…");
      // Small delay so the RPC rate-limiter resets between the two transactions
      await new Promise((r) => setTimeout(r, 4000));

      // 3. Step 2 — Fund milestone on-chain
      setFundingStep("funding");
      const fundTxHash = await sendTx(account, escrowContractAddress, fundCalldata);
      await waitForReceipt(fundTxHash);

      // 4. Confirm with backend
      setFundingStep("confirming");
      toast.info("Confirming on server…");
      const confirm = await fetch("/api/escrow/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractId, milestoneId, txHash: fundTxHash }),
      });
      if (!confirm.ok) {
        const e = await confirm.json();
        throw new Error(e.error ?? "Escrow confirm failed");
      }

      setFundingStep("done");
      toast.success("Escrow funded! Reloading…");
      setTimeout(() => window.location.reload(), 1200);
    } catch (err) {
      console.error("Escrow funding error:", err);
      setFundingStep("idle");
      toast.error(extractError(err));
    }
  }

  // ── AI verification ───────────────────────────────────────────────────────
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
        toast.success("AI approved! Milestone verified — you can now release the funds.");
      } else {
        toast.error(`AI rejected: ${result.reasoning}`);
      }
      setVerifyDone(true);
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setLoadingVerify(false);
    }
  }

  // ── Release funds (platform signs on-chain — no MetaMask needed) ──────────
  async function handleFinishEscrow() {
    setLoadingFinish(true);
    try {
      const res = await fetch("/api/escrow/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractId, milestoneId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Release failed");
      }
      toast.success("Funds released! Contract completed.");
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Release failed.");
    } finally {
      setLoadingFinish(false);
    }
  }

  // ── Cancel escrow (platform signs on-chain — no MetaMask needed) ──────────
  async function handleCancelEscrow() {
    setLoadingCancel(true);
    try {
      const res = await fetch("/api/escrow/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractId, milestoneId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Cancel failed");
      }
      const data = await res.json();
      if (data.action === "already_closed") {
        toast.success("Escrow already settled. Contract marked as expired.");
      } else {
        toast.success("Escrow cancelled. Funds returned to grant giver.");
      }
      setTimeout(() => window.location.reload(), 1200);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Cancel failed.");
    } finally {
      setLoadingCancel(false);
    }
  }

  // ── Manual review (investor approves/rejects) ─────────────────────────────
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
      toast.success(
        decision === "APPROVE"
          ? "Approved! Receiver can now withdraw funds."
          : "Rejected. Receiver can resubmit."
      );
      setTimeout(() => window.location.reload(), 1200);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Review failed.");
    } finally {
      setLoadingReview(null);
    }
  }

  // ── Resubmit proof ────────────────────────────────────────────────────────
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

  // ── AWAITING_ESCROW: investor funds via MetaMask ──────────────────────────
  if (status === "AWAITING_ESCROW") {
    if (viewerWallet !== investorAddress) {
      return (
        <div className="flex flex-col gap-3 p-5 bg-amber-50 border border-amber-200 rounded-xl">
          <p className="text-sm font-medium text-amber-800">
            Waiting for the grant giver to fund the escrow.
          </p>
        </div>
      );
    }

    const fundingLabel =
      totalMilestones > 1 && milestoneNumber !== null
        ? `Fund Milestone ${milestoneNumber}/${totalMilestones} via MetaMask`
        : "Fund Escrow via MetaMask";

    const stepLabel: Record<typeof fundingStep, string> = {
      idle: fundingLabel,
      approving: "Step 1/2: Approving RLUSD…",
      funding: "Step 2/2: Funding escrow…",
      confirming: "Confirming…",
      done: "Done!",
    };

    return (
      <div className="flex flex-col gap-3 p-5 bg-amber-50 border border-amber-200 rounded-xl">
        <p className="text-sm font-medium text-amber-800">
          {totalMilestones > 1 && milestoneNumber !== null
            ? `Milestone ${milestoneNumber} of ${totalMilestones}${milestoneTitle ? `: ${milestoneTitle}` : ""} — fund the escrow to lock funds.`
            : "Both parties have committed. Fund the escrow to lock funds."}
        </p>
        <p className="text-xs text-amber-600">
          Amount: <strong>{amountRLUSD} RLUSD</strong> — MetaMask will ask you to
          approve the token transfer, then sign the escrow transaction.
        </p>
        <Button
          onClick={handleFundEscrow}
          disabled={fundingStep !== "idle" || faucetLoading}
        >
          {stepLabel[fundingStep]}
        </Button>
        <button
          onClick={handleFaucet}
          disabled={faucetLoading || fundingStep !== "idle"}
          className="text-xs underline text-amber-700 hover:text-amber-900 disabled:opacity-50 disabled:no-underline"
        >
          {faucetLoading ? "Minting…" : `No RLUSD? Get ${amountRLUSD} test RLUSD from faucet`}
        </button>
      </div>
    );
  }

  // ── FUNDED: startup uploads proof ─────────────────────────────────────────
  if (status === "FUNDED") {
    if (viewerWallet !== startupAddress) {
      return (
        <div className="flex flex-col gap-3 p-5 bg-blue-50 border border-blue-200 rounded-xl">
          <p className="text-sm font-medium text-blue-800">
            Waiting for the receiver to upload milestone proof.
          </p>
        </div>
      );
    }
    return (
      <ProofUpload
        contractId={contractId}
        milestoneId={milestoneId}
        onUploaded={(proofId) => handleVerify(proofId)}
      />
    );
  }

  // ── PROOF_SUBMITTED: trigger AI verification ──────────────────────────────
  if (status === "PROOF_SUBMITTED" && latestProofId && !verifyDone) {
    const isStartup = viewerWallet === startupAddress;
    return (
      <div className="flex flex-col gap-3 p-5 bg-blue-50 border border-blue-200 rounded-xl">
        <p className="text-sm text-blue-800">
          {isStartup ? "Proof uploaded. Ready for AI verification." : "The receiver has submitted proof. AI verification is pending."}
        </p>
        {latestProofFileUrl && isStartup && (
          <a
            href={latestProofFileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-3 bg-white border border-blue-200 rounded-lg hover:border-blue-400 transition-colors"
          >
            <span className="text-xs font-mono bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">
              {latestProofFileName?.split(".").pop()?.toUpperCase() ?? "FILE"}
            </span>
            <span className="text-sm text-blue-900 flex-1 truncate">{latestProofFileName}</span>
            <span className="text-xs text-blue-600">Open ↗</span>
          </a>
        )}
        {isStartup && (
          <Button onClick={() => handleVerify(latestProofId)} disabled={loadingVerify}>
            {loadingVerify ? "Verifying…" : "Run AI Verification"}
          </Button>
        )}
      </div>
    );
  }

  // ── PENDING_REVIEW: investor manually approves or rejects ─────────────────
  if (status === "PENDING_REVIEW") {
    return (
      <div className="flex flex-col gap-4 p-5 bg-amber-50 border border-amber-200 rounded-xl">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-amber-900">Manual Review Required</p>
          {latestProofConfidence !== null && (
            <span
              style={{ background: "#fef3c7", color: "#92400e" }}
              className="text-xs font-medium px-2 py-0.5 rounded-full"
            >
              AI Confidence: {latestProofConfidence}%
            </span>
          )}
        </div>

        {latestProofReasoning && (
          <div className="flex flex-col gap-1">
            <p className="text-xs font-medium text-amber-700 uppercase tracking-wide">
              AI Analysis
            </p>
            <p className="text-sm text-amber-900 leading-relaxed bg-amber-100 rounded-lg p-3">
              {latestProofReasoning}
            </p>
          </div>
        )}

        {latestProofFileUrl && (
          <a
            href={latestProofFileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-3 bg-white border border-amber-200 rounded-lg hover:border-amber-400 transition-colors"
          >
            <span className="text-xs font-mono bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
              {latestProofFileName?.split(".").pop()?.toUpperCase() ?? "FILE"}
            </span>
            <span className="text-sm text-amber-900 flex-1 truncate">{latestProofFileName}</span>
            <span className="text-xs text-amber-600">Open ↗</span>
          </a>
        )}

        {viewerWallet === investorAddress ? (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-amber-700">
              The AI was not confident enough for an automatic decision. Review the proof above and decide manually.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleReview("APPROVE")}
                disabled={loadingReview !== null}
                style={{
                  background: "#16a34a",
                  color: "#fff",
                  flex: 1,
                  padding: "8px 16px",
                  borderRadius: "8px",
                  border: "none",
                  fontWeight: 600,
                  cursor: loadingReview !== null ? "not-allowed" : "pointer",
                  opacity: loadingReview !== null ? 0.6 : 1,
                }}
              >
                {loadingReview === "APPROVE" ? "Approving…" : "✓ Approve"}
              </button>
              <button
                onClick={() => handleReview("REJECT")}
                disabled={loadingReview !== null}
                style={{
                  background: "#fff",
                  color: "#b91c1c",
                  flex: 1,
                  padding: "8px 16px",
                  borderRadius: "8px",
                  border: "1px solid #fca5a5",
                  fontWeight: 600,
                  cursor: loadingReview !== null ? "not-allowed" : "pointer",
                  opacity: loadingReview !== null ? 0.6 : 1,
                }}
              >
                {loadingReview === "REJECT" ? "Rejecting…" : "✗ Reject"}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-amber-700">
            The grant giver is reviewing your proof. You will be notified once a decision has been made.
          </p>
        )}
      </div>
    );
  }

  // ── VERIFIED: startup releases funds (platform calls contract server-side) ─
  if (status === "VERIFIED") {
    if (viewerWallet !== startupAddress) {
      return (
        <div className="flex flex-col gap-3 p-5 bg-green-50 border border-green-200 rounded-xl">
          <p className="text-sm font-medium text-green-800">
            Milestone approved. The receiver can now withdraw the funds.
          </p>
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-3 p-5 bg-green-50 border border-green-200 rounded-xl">
        <p className="text-sm font-medium text-green-800">
          Milestone approved! Click below to receive your RLUSD — no wallet signing
          required.
        </p>
        <Button onClick={handleFinishEscrow} disabled={loadingFinish}>
          {loadingFinish ? "Releasing funds…" : "Release Funds"}
        </Button>
      </div>
    );
  }

  // ── REJECTED: startup resubmits or investor cancels if expired ────────────
  if (status === "REJECTED") {
    return (
      <div className="flex flex-col gap-3 p-5 bg-red-50 border border-red-200 rounded-xl">
        <p className="text-sm font-medium text-red-800">AI rejected the proof.</p>
        {isExpired ? (
          <>
            <p className="text-xs text-red-700">
              Deadline has passed. Cancel the escrow to recover your RLUSD.
            </p>
            {viewerWallet === investorAddress && (
              <Button variant="destructive" onClick={handleCancelEscrow} disabled={loadingCancel}>
                {loadingCancel ? "Cancelling…" : "Cancel Escrow & Recover Funds"}
              </Button>
            )}
          </>
        ) : viewerWallet === startupAddress ? (
          <Button variant="outline" onClick={handleResubmit} disabled={loadingResubmit}>
            {loadingResubmit ? "Resetting…" : "Resubmit New Proof"}
          </Button>
        ) : (
          <p className="text-xs text-red-700">
            The proof was rejected. The receiver will need to resubmit a new proof.
          </p>
        )}
      </div>
    );
  }

  // ── Deadline passed on FUNDED/PROOF_SUBMITTED ─────────────────────────────
  if (["FUNDED", "PROOF_SUBMITTED"].includes(status) && isExpired) {
    return (
      <div className="flex flex-col gap-3 p-5 bg-orange-50 border border-orange-200 rounded-xl">
        <p className="text-sm font-medium text-orange-800">
          Deadline has passed. Cancel the escrow to recover your RLUSD.
        </p>
        {viewerWallet === investorAddress && (
          <Button variant="destructive" onClick={handleCancelEscrow} disabled={loadingCancel}>
            {loadingCancel ? "Cancelling…" : "Cancel Escrow & Recover Funds"}
          </Button>
        )}
      </div>
    );
  }

  return null;
}
