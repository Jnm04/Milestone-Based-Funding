/**
 * elizaos-plugin-cascrow
 *
 * Gives ElizaOS agents the ability to create escrow contracts, fund milestones,
 * submit proofs, and manage verification on Cascrow — fully autonomously.
 *
 * Setup in your character file:
 *   settings: {
 *     CASCROW_API_KEY: "csk_...",
 *     CASCROW_API_URL: "https://cascrow.com"   // optional, defaults to prod
 *   }
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type IAgentRuntime = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Memory = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type State = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type HandlerCallback = (response: { text: string; action?: string }, files?: Record<string, string>) => Promise<unknown[]>;

interface Action {
  name: string;
  similes: string[];
  description: string;
  validate: (runtime: IAgentRuntime, message: Memory, state?: State) => Promise<boolean>;
  handler: (runtime: IAgentRuntime, message: Memory, state?: State, options?: Record<string, unknown>, callback?: HandlerCallback) => Promise<boolean>;
  examples: { user: string; content: { text: string; action?: string } }[][];
}

interface Plugin {
  name: string;
  description: string;
  actions: Action[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getConfig(runtime: IAgentRuntime): { apiKey: string; baseUrl: string } {
  const apiKey = runtime.getSetting("CASCROW_API_KEY") as string;
  const baseUrl = (runtime.getSetting("CASCROW_API_URL") as string | undefined) ?? "https://cascrow.com";
  return { apiKey, baseUrl };
}

async function cascrowFetch(
  runtime: IAgentRuntime,
  path: string,
  options: RequestInit = {}
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const { apiKey, baseUrl } = getConfig(runtime);
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

function validateConfig(runtime: IAgentRuntime): Promise<boolean> {
  return Promise.resolve(!!runtime.getSetting("CASCROW_API_KEY"));
}

// ─── Actions ─────────────────────────────────────────────────────────────────

const createContract: Action = {
  name: "CASCROW_CREATE_CONTRACT",
  similes: ["CREATE_ESCROW", "SET_UP_CONTRACT", "NEW_MILESTONE_CONTRACT"],
  description:
    "Create a new milestone-based escrow contract on Cascrow. The contract locks RLUSD until the milestone is verified by AI.",
  validate: validateConfig,
  handler: async (_runtime, _message, _state, options, callback) => {
    const { milestone, amountUSD, builderEmail, deadlineDays, agentReviewMode } =
      (options ?? {}) as Record<string, unknown>;

    const { ok, data } = await cascrowFetch(_runtime, "/api/contracts", {
      method: "POST",
      body: JSON.stringify({
        milestone,
        amountUSD,
        builderEmail,
        deadlineDays: deadlineDays ?? 30,
        agentReviewMode: agentReviewMode ?? "AUTO",
      }),
    });

    if (!ok) {
      const err = (data as { error?: string }).error ?? "Unknown error";
      callback?.({ text: `Failed to create contract: ${err}` });
      return false;
    }

    const contract = data as { id: string; inviteCode?: string };
    callback?.({
      text: `Contract created. ID: ${contract.id}${contract.inviteCode ? ` · Invite code for builder: ${contract.inviteCode}` : ""}`,
      action: "CASCROW_CREATE_CONTRACT",
    });
    return true;
  },
  examples: [
    [
      { user: "user", content: { text: "Create an escrow for $500 to build a REST API" } },
      { user: "agent", content: { text: "Contract created. ID: clx... · Invite code for builder: ABC123", action: "CASCROW_CREATE_CONTRACT" } },
    ],
  ],
};

const fundContract: Action = {
  name: "CASCROW_FUND_CONTRACT",
  similes: ["FUND_ESCROW", "LOCK_FUNDS", "DEPOSIT_RLUSD"],
  description:
    "Fund a Cascrow contract milestone using a private key (fully autonomous). Locks RLUSD in the escrow smart contract on XRPL EVM Sidechain.",
  validate: validateConfig,
  handler: async (_runtime, _message, _state, options, callback) => {
    const { contractId, milestoneId, privateKey } = (options ?? {}) as Record<string, unknown>;

    const { ok, data } = await cascrowFetch(_runtime, "/api/agent/escrow-fund", {
      method: "POST",
      body: JSON.stringify({ contractId, milestoneId, privateKey }),
    });

    if (!ok) {
      const err = (data as { error?: string }).error ?? "Unknown error";
      callback?.({ text: `Failed to fund contract: ${err}` });
      return false;
    }

    const result = data as { txHash?: string };
    callback?.({
      text: `Contract funded on-chain.${result.txHash ? ` TX: ${result.txHash}` : ""}`,
      action: "CASCROW_FUND_CONTRACT",
    });
    return true;
  },
  examples: [
    [
      { user: "user", content: { text: "Fund the contract clx..." } },
      { user: "agent", content: { text: "Contract funded on-chain. TX: 0xabc...", action: "CASCROW_FUND_CONTRACT" } },
    ],
  ],
};

const submitProof: Action = {
  name: "CASCROW_SUBMIT_PROOF",
  similes: ["SUBMIT_EVIDENCE", "UPLOAD_PROOF", "CLAIM_MILESTONE"],
  description:
    "Submit proof of milestone completion to Cascrow. Triggers a 5-model AI verification vote. If 3/5 vote YES with >85% confidence, funds are released automatically.",
  validate: validateConfig,
  handler: async (_runtime, _message, _state, options, callback) => {
    const { contractId, proofText, githubUrl } = (options ?? {}) as Record<string, unknown>;

    const { ok, data } = await cascrowFetch(_runtime, "/api/proof/submit", {
      method: "POST",
      body: JSON.stringify({ contractId, proofText, githubUrl }),
    });

    if (!ok) {
      const err = (data as { error?: string }).error ?? "Unknown error";
      callback?.({ text: `Failed to submit proof: ${err}` });
      return false;
    }

    const result = data as { proofId?: string; message?: string };
    callback?.({
      text: `Proof submitted. ID: ${result.proofId ?? "unknown"} — AI verification in progress.`,
      action: "CASCROW_SUBMIT_PROOF",
    });
    return true;
  },
  examples: [
    [
      { user: "user", content: { text: "Submit proof that the API is live at https://api.example.com" } },
      { user: "agent", content: { text: "Proof submitted. ID: clx... — AI verification in progress.", action: "CASCROW_SUBMIT_PROOF" } },
    ],
  ],
};

const getContract: Action = {
  name: "CASCROW_GET_CONTRACT",
  similes: ["CHECK_CONTRACT", "CONTRACT_STATUS", "GET_MILESTONE_STATUS"],
  description: "Get the current status of a Cascrow contract and its milestones.",
  validate: validateConfig,
  handler: async (_runtime, _message, _state, options, callback) => {
    const { contractId } = (options ?? {}) as Record<string, unknown>;

    const { ok, data } = await cascrowFetch(_runtime, `/api/contracts/${contractId}`);

    if (!ok) {
      callback?.({ text: `Contract not found or inaccessible.` });
      return false;
    }

    const contract = data as { status?: string; milestone?: string; milestones?: { status: string; amountUSD: number }[] };
    const milestoneSummary = contract.milestones
      ? contract.milestones.map((m, i) => `  ${i + 1}. ${m.status} — $${m.amountUSD}`).join("\n")
      : "";

    callback?.({
      text: `Contract status: ${contract.status}\nMilestone: ${contract.milestone ?? "—"}\n${milestoneSummary}`,
      action: "CASCROW_GET_CONTRACT",
    });
    return true;
  },
  examples: [
    [
      { user: "user", content: { text: "What is the status of contract clx..." } },
      { user: "agent", content: { text: "Contract status: FUNDED\nMilestone: Build REST API\n  1. FUNDED — $500", action: "CASCROW_GET_CONTRACT" } },
    ],
  ],
};

const joinContract: Action = {
  name: "CASCROW_JOIN_CONTRACT",
  similes: ["ACCEPT_CONTRACT", "JOIN_ESCROW", "ACCEPT_INVITE"],
  description: "Join a Cascrow contract as the builder using an invite code.",
  validate: validateConfig,
  handler: async (_runtime, _message, _state, options, callback) => {
    const { inviteCode } = (options ?? {}) as Record<string, unknown>;

    const { ok, data } = await cascrowFetch(_runtime, "/api/contracts/join", {
      method: "POST",
      body: JSON.stringify({ inviteCode }),
    });

    if (!ok) {
      const err = (data as { error?: string }).error ?? "Unknown error";
      callback?.({ text: `Failed to join contract: ${err}` });
      return false;
    }

    const result = data as { contractId?: string };
    callback?.({
      text: `Joined contract as builder. Contract ID: ${result.contractId ?? "unknown"}`,
      action: "CASCROW_JOIN_CONTRACT",
    });
    return true;
  },
  examples: [
    [
      { user: "user", content: { text: "Join contract with invite code ABC123" } },
      { user: "agent", content: { text: "Joined contract as builder. Contract ID: clx...", action: "CASCROW_JOIN_CONTRACT" } },
    ],
  ],
};

const checkInvites: Action = {
  name: "CASCROW_CHECK_INVITES",
  similes: ["LIST_INVITES", "PENDING_CONTRACTS", "CHECK_PENDING_INVITES"],
  description: "Check pending contract invites for this agent.",
  validate: validateConfig,
  handler: async (_runtime, _message, _state, _options, callback) => {
    const { ok, data } = await cascrowFetch(_runtime, "/api/agent/pending-invites");

    if (!ok) {
      callback?.({ text: "Failed to fetch pending invites." });
      return false;
    }

    const invites = data as { inviteCode: string; milestone: string; amountUSD: number }[];
    if (!invites.length) {
      callback?.({ text: "No pending contract invites." });
      return true;
    }

    const list = invites.map((i) => `  • ${i.milestone} — $${i.amountUSD} (code: ${i.inviteCode})`).join("\n");
    callback?.({ text: `Pending invites:\n${list}`, action: "CASCROW_CHECK_INVITES" });
    return true;
  },
  examples: [
    [
      { user: "user", content: { text: "Do I have any pending contract invites?" } },
      { user: "agent", content: { text: "Pending invites:\n  • Build REST API — $500 (code: ABC123)", action: "CASCROW_CHECK_INVITES" } },
    ],
  ],
};

const reviewProof: Action = {
  name: "CASCROW_REVIEW_PROOF",
  similes: ["APPROVE_PROOF", "REJECT_PROOF", "MANUAL_REVIEW"],
  description:
    "Approve or reject a proof that is in PENDING_REVIEW state (only for contracts with agentReviewMode MANUAL or MANUAL_AUTO). APPROVE releases funds on-chain immediately.",
  validate: validateConfig,
  handler: async (_runtime, _message, _state, options, callback) => {
    const { contractId, decision } = (options ?? {}) as Record<string, unknown>;

    const { ok, data } = await cascrowFetch(_runtime, "/api/contracts/review", {
      method: "POST",
      body: JSON.stringify({ contractId, decision }),
    });

    if (!ok) {
      const err = (data as { error?: string }).error ?? "Unknown error";
      callback?.({ text: `Review failed: ${err}` });
      return false;
    }

    const result = data as { status?: string; txHash?: string };
    const txNote = result.txHash ? ` TX: ${result.txHash}` : "";
    callback?.({
      text: `Review submitted. New status: ${result.status ?? "updated"}.${txNote}`,
      action: "CASCROW_REVIEW_PROOF",
    });
    return true;
  },
  examples: [
    [
      { user: "user", content: { text: "Approve the proof for contract clx..." } },
      { user: "agent", content: { text: "Review submitted. New status: COMPLETED. TX: 0xabc...", action: "CASCROW_REVIEW_PROOF" } },
    ],
  ],
};

// ─── Plugin export ────────────────────────────────────────────────────────────

export const cascrowPlugin: Plugin = {
  name: "cascrow",
  description:
    "Cascrow — agentic escrow and milestone verification on the XRP Ledger. Create contracts, lock RLUSD, submit proofs, and receive autonomous AI verification.",
  actions: [
    createContract,
    fundContract,
    submitProof,
    getContract,
    joinContract,
    checkInvites,
    reviewProof,
  ],
};

export default cascrowPlugin;
