# Remote HTTP MCP Server — Smithery Listing

## Why

The current `cascrow-mcp` package runs locally via `npx` (stdio transport).
That works for **Claude Desktop** only.

A remote HTTP MCP server at `https://cascrow.com/mcp` would enable:
- **Claude.ai Web** (browser) — which only supports remote HTTP, not stdio
- **Smithery listing** under `cascrow/cascrow` with one-click install for 10k+ users
- **Any MCP client** without Node.js installed

## The Use Case (no escrow needed)

The primary value right now is **AI work verification**, independent of payments:

- Agent does work → calls `cascrow_mcp_submit` with `amountUSD: 0`
- 5 independent AI models vote on whether the work is complete
- User sees: "4/5 models approved, 89% confidence"
- Public certificate at `cascrow.com/proof/[hash]`

This works today on testnet. No MetaMask, no wallet, no escrow required.
Positions cascrow as the **trust/verification layer for AI work** before the agent economy matures.

## What Needs to Be Built

### 1. HTTP MCP Endpoint — `src/app/api/mcp/route.ts`

Replace stdio transport with HTTP transport using `@modelcontextprotocol/sdk`:

```ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

// Same 16 tools as cascrow-mcp/index.js but served over HTTP
// Auth: API key from Authorization header or ?api_key= query param
```

The 16 tools already exist in `cascrow-mcp/index.js` — they just need to be
ported from stdio to HTTP transport. All business logic (`/api/mcp/submit`,
`/api/contracts`, etc.) stays unchanged.

### 2. Smithery Registration

- Create Smithery account under `cascrow` org (not personal `moeller` namespace)
- Go to smithery.ai/new
- Namespace: `cascrow` / Server ID: `cascrow`
- MCP Server URL: `https://cascrow.com/mcp`
- Result: `smithery.ai/server/cascrow/cascrow` with one-click install

### 3. Auth for Remote Connections

Remote users authenticate with their cascrow API key (`csk_...`).
Two options (both fine):
- `Authorization: Bearer csk_...` header
- `?api_key=csk_...` query param (easier for Smithery config UI)

### 4. Smithery Config Schema (update smithery.yaml)

```yaml
startCommand:
  type: http
  configSchema:
    type: object
    properties:
      CASCROW_API_KEY:
        type: string
        description: "Your cascrow API key (csk_...)"
    required:
      - CASCROW_API_KEY
  url: https://cascrow.com/mcp
```

## Effort Estimate

~4–6 hours. The hard parts (tools, auth, business logic) are already done.
Only the transport layer needs to change.

## When to Do This

**Now** — the verification use case (amountUSD: 0) works on testnet today.
Getting listed on Smithery/Claude.ai Web establishes cascrow as the
verification standard before competitors enter the space.
