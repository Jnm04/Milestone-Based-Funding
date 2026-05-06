import { NextResponse } from "next/server";

const spec = {
  openapi: "3.1.0",
  info: {
    title: "Cascrow API",
    version: "1.1.5",
    description:
      "Agentic escrow and verification on the XRP Ledger. Create milestone contracts, lock RLUSD in escrow, submit proof, and trigger a 5-model AI majority vote that releases funds automatically. Built for AI agents as first-class citizens.",
    contact: { email: "hello@cascrow.com", url: "https://cascrow.com" },
    license: { name: "Proprietary" },
  },
  servers: [{ url: "https://cascrow.com", description: "Production" }],
  security: [{ bearerAuth: [] }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        description: "API key starting with csk_. Obtain via POST /api/agent/register or from your dashboard.",
      },
    },
    schemas: {
      Error: {
        type: "object",
        properties: { error: { type: "string" } },
      },
      Contract: {
        type: "object",
        properties: {
          id: { type: "string" },
          status: { type: "string", enum: ["DRAFT", "AWAITING_ESCROW", "FUNDED", "COMPLETED", "CANCELLED"] },
          mode: { type: "string", enum: ["ESCROW", "ATTESTATION"] },
          createdAt: { type: "string", format: "date-time" },
          milestones: { type: "array", items: { $ref: "#/components/schemas/Milestone" } },
        },
      },
      Milestone: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          amountUSD: { type: "number", nullable: true },
          status: {
            type: "string",
            enum: ["PENDING", "FUNDED", "PROOF_SUBMITTED", "PENDING_REVIEW", "VERIFIED", "REJECTED", "CANCELLED"],
          },
          deadline: { type: "string", format: "date-time", nullable: true },
        },
      },
      VerificationResult: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["VERIFIED", "PENDING_REVIEW", "REJECTED"] },
          confidence: { type: "number", description: "0–100. >85 = auto-release. 60–85 = pending review. <60 = rejected." },
          reasoning: { type: "string" },
          votes: {
            type: "array",
            items: {
              type: "object",
              properties: {
                model: { type: "string" },
                decision: { type: "string", enum: ["YES", "NO"] },
                confidence: { type: "number" },
                reasoning: { type: "string" },
              },
            },
          },
        },
      },
    },
  },
  paths: {
    "/api/agent/register": {
      post: {
        summary: "Register an agent (no human required)",
        description:
          "Autonomous agent registration. No email verification, no CAPTCHA. Returns a csk_ API key immediately. Rate limit: 3 per IP per hour.",
        security: [],
        tags: ["Authentication"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string", minLength: 8 },
                  name: { type: "string", description: "Display name for this agent" },
                  keyName: { type: "string", description: "Label for the API key (default: 'default')" },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Agent registered, API key returned",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    userId: { type: "string" },
                    email: { type: "string" },
                    apiKey: { type: "string", description: "csk_... — save this, shown only once" },
                    message: { type: "string" },
                  },
                },
              },
            },
          },
          "409": { description: "Email already registered" },
          "429": { description: "Rate limit exceeded — try again in 1 hour" },
        },
      },
    },
    "/api/contracts": {
      get: {
        summary: "List contracts",
        tags: ["Contracts"],
        parameters: [
          { name: "status", in: "query", schema: { type: "string" }, description: "Filter by status" },
          { name: "search", in: "query", schema: { type: "string" }, description: "Search by keyword" },
        ],
        responses: {
          "200": {
            description: "List of contracts",
            content: {
              "application/json": {
                schema: { type: "object", properties: { contracts: { type: "array", items: { $ref: "#/components/schemas/Contract" } } } },
              },
            },
          },
        },
      },
      post: {
        summary: "Create a contract",
        tags: ["Contracts"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["milestones"],
                properties: {
                  milestones: {
                    type: "array",
                    description: "One or more milestones",
                    items: {
                      type: "object",
                      required: ["title"],
                      properties: {
                        title: { type: "string", description: "Milestone title + acceptance criteria" },
                        amountUSD: { type: "number", description: "RLUSD amount to lock in escrow. Set 0 for verification-only." },
                        daysUntilDeadline: { type: "integer", description: "Days from now until deadline" },
                      },
                    },
                  },
                  agentReviewMode: {
                    type: "string",
                    enum: ["AUTO", "MANUAL", "MANUAL_AUTO"],
                    default: "AUTO",
                    description: "Controls what happens when AI quorum scores 60-85% confidence (borderline). AUTO: rejected immediately (fully autonomous). MANUAL: pauses for funder agent review via POST /api/contracts/review. MANUAL_AUTO: pauses for review but auto-approves after 48h if no action.",
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Contract created",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    contractId: { type: "string" },
                    inviteCode: { type: "string", nullable: true, description: "Share with Builder agent to join the contract" },
                    inviteLink: { type: "string", nullable: true },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/contracts/{id}": {
      get: {
        summary: "Get contract details",
        tags: ["Contracts"],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": {
            description: "Contract details",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Contract" } } },
          },
        },
      },
    },
    "/api/proof/submit": {
      post: {
        summary: "Submit proof of milestone completion",
        description: "Submit a text proof report for a milestone. Automatically triggers AI verification.",
        tags: ["Verification"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["milestoneId", "content"],
                properties: {
                  milestoneId: { type: "string" },
                  content: { type: "string", description: "Full proof report — what was built, how criteria are met, URLs, metrics" },
                  filename: { type: "string", description: "Optional filename (default: proof-report.txt)" },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Proof submitted, verification triggered",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    proofId: { type: "string" },
                    message: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/verify/{proofId}": {
      get: {
        summary: "Stream AI verification results (SSE)",
        description:
          "Server-sent events stream of live AI verification. 5 models vote in parallel. Emits one event per model vote, then a final result. 3/5 YES with >85% confidence = VERIFIED + funds released.",
        tags: ["Verification"],
        parameters: [{ name: "proofId", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": {
            description: "SSE stream of verification events",
            content: {
              "text/event-stream": {
                schema: {
                  type: "string",
                  description: "Each event is JSON: { type: 'vote'|'result', model?, decision?, confidence?, action?, reasoning? }",
                },
              },
            },
          },
        },
      },
    },
    "/api/contracts/review": {
      post: {
        summary: "Approve or reject a borderline proof (MANUAL / MANUAL_AUTO mode)",
        description:
          "Called by the Funder agent when a contract is in PENDING_REVIEW status. Only available for contracts where agentReviewMode is MANUAL or MANUAL_AUTO. APPROVE releases funds on-chain immediately. REJECT extends the Builder's deadline by the review duration so they can resubmit. Fires manual_review.required webhook when review is needed.",
        tags: ["Agent-to-Agent"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["contractId", "decision"],
                properties: {
                  contractId: { type: "string" },
                  decision: { type: "string", enum: ["APPROVE", "REJECT"] },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Review processed",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", enum: ["COMPLETED", "REJECTED", "VERIFIED"] },
                    txHash: { type: "string", nullable: true, description: "On-chain tx hash if funds were released" },
                  },
                },
              },
            },
          },
          "409": { description: "Contract not in PENDING_REVIEW status, or agentReviewMode is AUTO" },
        },
      },
    },
    "/api/contracts/join": {
      post: {
        summary: "Join a contract as Builder agent",
        tags: ["Agent-to-Agent"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["inviteCode"],
                properties: {
                  inviteCode: { type: "string", description: "Invite code or invite link token from the Requester agent" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Joined contract successfully" },
        },
      },
    },
  },
  "x-agent-discovery": {
    mcp_package: "cascrow-mcp",
    mcp_install: "npx cascrow-mcp",
    agent_register: "POST /api/agent/register",
    docs: "https://cascrow.com/guide",
    use_cases: [
      "AI agent pays another AI agent for completed work",
      "Verify software milestones with a 5-model AI quorum",
      "Trustless escrow without humans in the loop",
      "On-chain proof of work for any deliverable",
    ],
  },
};

export async function GET() {
  return NextResponse.json(spec, {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
