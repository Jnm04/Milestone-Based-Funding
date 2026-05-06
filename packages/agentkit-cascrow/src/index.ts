/**
 * agentkit-cascrow
 *
 * Coinbase AgentKit action provider that gives agents the ability to create
 * escrow contracts, fund milestones, submit proofs, and manage verification
 * on Cascrow — fully autonomously.
 *
 * Usage:
 *   import { cascrowActionProvider } from "agentkit-cascrow";
 *
 *   const agentkit = await AgentKit.from({
 *     walletProvider,
 *     actionProviders: [
 *       cascrowActionProvider({
 *         apiKey: process.env.CASCROW_API_KEY!,
 *       }),
 *     ],
 *   });
 */

import { z } from "zod";

// ─── Minimal AgentKit interface stubs ────────────────────────────────────────
// Using stubs so the package compiles without requiring agentkit at build time.
// At runtime the consuming agent's agentkit installation is used.

type Network = { networkId?: string };

interface ActionProviderBase {
  name: string;
  supportsNetwork(network: Network): boolean;
  getActions(): CascrowAction[];
}

interface CascrowAction {
  name: string;
  description: string;
  schema: z.ZodTypeAny;
  invoke(args: unknown): Promise<string>;
}

// ─── Config ──────────────────────────────────────────────────────────────────

export interface CascrowConfig {
  apiKey: string;
  baseUrl?: string;
}

// ─── Helper ──────────────────────────────────────────────────────────────────

async function call(
  config: CascrowConfig,
  path: string,
  options: RequestInit = {}
): Promise<{ ok: boolean; data: unknown }> {
  const baseUrl = config.baseUrl ?? "https://cascrow.com";
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

// ─── Schemas ─────────────────────────────────────────────────────────────────

const CreateContractSchema = z.object({
  milestone: z.string().describe("Description of the milestone to be completed"),
  amountUSD: z.number().positive().describe("Amount in USD to lock in escrow"),
  builderEmail: z.string().email().optional().describe("Email of the builder to invite"),
  deadlineDays: z.number().int().min(1).max(365).optional().default(30).describe("Days until the deadline"),
  agentReviewMode: z
    .enum(["AUTO", "MANUAL", "MANUAL_AUTO"])
    .optional()
    .default("AUTO")
    .describe("AUTO: borderline proofs rejected immediately. MANUAL: agent reviews via API. MANUAL_AUTO: agent reviews, auto-approves after 48h."),
});

const FundContractSchema = z.object({
  contractId: z.string().describe("The Cascrow contract ID to fund"),
  milestoneId: z.string().describe("The milestone ID to fund"),
  privateKey: z.string().describe("EVM private key of the funder wallet (hex, 0x-prefixed)"),
});

const SubmitProofSchema = z.object({
  contractId: z.string().describe("The contract ID to submit proof for"),
  proofText: z.string().describe("Text description of the completed work"),
  githubUrl: z.string().url().optional().describe("Optional GitHub repository or commit URL as evidence"),
});

const GetContractSchema = z.object({
  contractId: z.string().describe("The Cascrow contract ID to look up"),
});

const JoinContractSchema = z.object({
  inviteCode: z.string().describe("The invite code shared by the contract creator"),
});

const ReviewProofSchema = z.object({
  contractId: z.string().describe("The contract ID to review"),
  decision: z.enum(["APPROVE", "REJECT"]).describe("APPROVE releases funds on-chain immediately. REJECT extends the builder's deadline."),
});

const CheckInvitesSchema = z.object({});

// ─── Action provider class ────────────────────────────────────────────────────

class CascrowActionProvider implements ActionProviderBase {
  readonly name = "cascrow";

  constructor(private config: CascrowConfig) {}

  supportsNetwork(_network: Network): boolean {
    return true;
  }

  getActions(): CascrowAction[] {
    const cfg = this.config;

    return [
      {
        name: "cascrow_create_contract",
        description:
          "Create a new milestone-based escrow contract on Cascrow. Locks RLUSD until the milestone is verified by a 5-model AI quorum (3/5 YES = funds released automatically).",
        schema: CreateContractSchema,
        async invoke(args) {
          const a = CreateContractSchema.parse(args);
          const { ok, data } = await call(cfg, "/api/contracts", {
            method: "POST",
            body: JSON.stringify(a),
          });
          if (!ok) return `Error: ${(data as { error?: string }).error ?? "unknown"}`;
          const c = data as { id: string; inviteCode?: string };
          return JSON.stringify({
            success: true,
            contractId: c.id,
            inviteCode: c.inviteCode ?? null,
            message: `Contract created. Share invite code ${c.inviteCode} with the builder.`,
          });
        },
      },

      {
        name: "cascrow_fund_contract",
        description:
          "Fund a Cascrow contract milestone using an EVM private key. Executes ERC-20 approve + fundMilestone on the XRPL EVM Sidechain (Chain ID 1449000). Fully autonomous — no MetaMask required.",
        schema: FundContractSchema,
        async invoke(args) {
          const a = FundContractSchema.parse(args);
          const { ok, data } = await call(cfg, "/api/agent/escrow-fund", {
            method: "POST",
            body: JSON.stringify(a),
          });
          if (!ok) return `Error: ${(data as { error?: string }).error ?? "unknown"}`;
          const r = data as { txHash?: string; status?: string };
          return JSON.stringify({ success: true, txHash: r.txHash, status: r.status });
        },
      },

      {
        name: "cascrow_submit_proof",
        description:
          "Submit proof of milestone completion. Triggers a 5-model AI verification vote (Claude Haiku, Gemini Flash, GPT-4o-mini, Mistral Small, Cerebras/Qwen3). 3/5 YES + >85% confidence = funds released automatically on-chain.",
        schema: SubmitProofSchema,
        async invoke(args) {
          const a = SubmitProofSchema.parse(args);
          const { ok, data } = await call(cfg, "/api/proof/submit", {
            method: "POST",
            body: JSON.stringify(a),
          });
          if (!ok) return `Error: ${(data as { error?: string }).error ?? "unknown"}`;
          const r = data as { proofId?: string };
          return JSON.stringify({ success: true, proofId: r.proofId, message: "Proof submitted. AI verification in progress." });
        },
      },

      {
        name: "cascrow_get_contract",
        description: "Get the current status of a Cascrow contract and its milestones.",
        schema: GetContractSchema,
        async invoke(args) {
          const a = GetContractSchema.parse(args);
          const { ok, data } = await call(cfg, `/api/contracts/${a.contractId}`);
          if (!ok) return `Error: Contract not found or inaccessible.`;
          return JSON.stringify(data);
        },
      },

      {
        name: "cascrow_join_contract",
        description: "Join a Cascrow contract as the builder using an invite code. Required before submitting proof.",
        schema: JoinContractSchema,
        async invoke(args) {
          const a = JoinContractSchema.parse(args);
          const { ok, data } = await call(cfg, "/api/contracts/join", {
            method: "POST",
            body: JSON.stringify(a),
          });
          if (!ok) return `Error: ${(data as { error?: string }).error ?? "unknown"}`;
          const r = data as { contractId?: string };
          return JSON.stringify({ success: true, contractId: r.contractId });
        },
      },

      {
        name: "cascrow_check_invites",
        description: "Check pending contract invites for this agent.",
        schema: CheckInvitesSchema,
        async invoke(_args) {
          const { ok, data } = await call(cfg, "/api/agent/pending-invites");
          if (!ok) return "Error: Failed to fetch invites.";
          return JSON.stringify(data);
        },
      },

      {
        name: "cascrow_review_proof",
        description:
          "Approve or reject a proof in PENDING_REVIEW state (only for contracts with agentReviewMode MANUAL or MANUAL_AUTO). APPROVE releases funds on-chain immediately.",
        schema: ReviewProofSchema,
        async invoke(args) {
          const a = ReviewProofSchema.parse(args);
          const { ok, data } = await call(cfg, "/api/contracts/review", {
            method: "POST",
            body: JSON.stringify(a),
          });
          if (!ok) return `Error: ${(data as { error?: string }).error ?? "unknown"}`;
          const r = data as { status?: string; txHash?: string };
          return JSON.stringify({ success: true, status: r.status, txHash: r.txHash ?? null });
        },
      },
    ];
  }
}

// ─── Export ───────────────────────────────────────────────────────────────────

export function cascrowActionProvider(config: CascrowConfig): CascrowActionProvider {
  return new CascrowActionProvider(config);
}

