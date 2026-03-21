import { ContractStatus, Role } from "@prisma/client";

export type { ContractStatus, Role };

export interface XRPLEscrowParams {
  investorAddress: string;
  startupAddress: string;
  amountRLUSD: string;
  condition: string;
  cancelAfter: number; // Unix timestamp
}

export interface CryptoCondition {
  condition: string;    // hex-encoded condition
  fulfillment: string;  // hex-encoded fulfillment (keep server-side!)
}

export interface AIVerificationResult {
  decision: "YES" | "NO";
  reasoning: string;
  confidence: number;
}

export interface ContractWithRelations {
  id: string;
  milestone: string;
  amountUSD: string;
  amountRLUSD: string | null;
  status: ContractStatus;
  escrowSequence: number | null;
  cancelAfter: Date;
  inviteLink: string | null;
  investor: {
    id: string;
    walletAddress: string;
    role: Role;
  };
  startup: {
    id: string;
    walletAddress: string;
    role: Role;
  } | null;
  proofs: ProofData[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ProofData {
  id: string;
  contractId: string;
  fileUrl: string;
  fileName: string;
  extractedText: string | null;
  aiDecision: string | null;
  aiReasoning: string | null;
  aiConfidence: number | null;
  createdAt: Date;
}
