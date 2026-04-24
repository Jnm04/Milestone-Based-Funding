import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "API Reference — Cascrow",
  description: "Programmatic access to Cascrow attestation contracts, milestones, and verification events.",
};

const ACCENT = "#C4704B";
const MUTED = "#A89B8C";
const TEXT = "#EDE6DD";
const BG = "#171311";
const CARD = "rgba(255,255,255,0.03)";
const BORDER = "rgba(196,112,75,0.15)";

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code style={{ fontFamily: "monospace", fontSize: 12.5, background: "rgba(196,112,75,0.1)", padding: "2px 6px", borderRadius: 4, color: "#E8935A" }}>
      {children}
    </code>
  );
}

function Badge({ method }: { method: "GET" | "POST" | "PATCH" | "DELETE" | "PUT" }) {
  const colors: Record<string, string> = {
    GET: "rgba(74,222,128,0.15)", POST: "rgba(59,130,246,0.15)",
    PATCH: "rgba(212,160,60,0.15)", DELETE: "rgba(248,113,113,0.15)", PUT: "rgba(167,139,250,0.15)",
  };
  const text: Record<string, string> = {
    GET: "#86efac", POST: "#7DB8F7", PATCH: "#D4A03C", DELETE: "#F87171", PUT: "#a78bfa",
  };
  return (
    <span style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700, background: colors[method], color: text[method], padding: "2px 8px", borderRadius: 4 }}>
      {method}
    </span>
  );
}

interface Endpoint {
  method: "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
  path: string;
  description: string;
  params?: { name: string; type: string; required?: boolean; description: string }[];
  response?: string;
}

const sections: { title: string; endpoints: Endpoint[] }[] = [
  {
    title: "Authentication",
    endpoints: [
      {
        method: "GET",
        path: "/api/contracts",
        description: "All API requests require an API key passed in the Authorization header.",
        params: [{ name: "Authorization", type: "header", required: true, description: "Bearer <api_key> — generate keys at /enterprise/settings/api-keys" }],
        response: `{ "error": "Unauthorized" }  // 401 if key missing or invalid`,
      },
    ],
  },
  {
    title: "Contracts",
    endpoints: [
      {
        method: "GET",
        path: "/api/contracts",
        description: "List all attestation contracts for your account.",
        response: `{ "contracts": [{ "id", "milestone", "status", "mode", "createdAt", "milestones": [...] }] }`,
      },
      {
        method: "POST",
        path: "/api/contracts",
        description: "Create a new attestation contract with one or more milestones.",
        params: [
          { name: "mode", type: "string", required: true, description: `Must be "ATTESTATION"` },
          { name: "attestationMilestones", type: "array", required: true, description: `[{ title, cancelAfter (ISO date), amountUSD?, scheduleType?, verificationCriteria? }]` },
          { name: "auditorEmail", type: "string", description: "Optional auditor CC'd on all results" },
          { name: "isConfidential", type: "boolean", description: "Encrypt goal text with AES-256-GCM (requires confidentialPassphrase)" },
        ],
        response: `{ "contractId": "...", "inviteLink": null }`,
      },
    ],
  },
  {
    title: "Milestones",
    endpoints: [
      {
        method: "GET",
        path: "/api/contracts/[id]/milestones/[milestoneId]",
        description: "Get full details for a specific milestone including latest attestation result.",
        response: `{ "milestone": { "id", "title", "status", "attestationEntries": [...], "connectorStatus" } }`,
      },
      {
        method: "PATCH",
        path: "/api/contracts/[id]/milestones/[milestoneId]",
        description: "Update milestone data source configuration (URL, API key, method).",
        params: [
          { name: "dataSourceType", type: "string", description: `"URL_SCRAPE" | "REST_API" | "FILE_UPLOAD" | "MANUAL_REVIEW"` },
          { name: "dataSourceUrl", type: "string", description: "URL to scrape or REST API endpoint (must be HTTPS, public internet)" },
          { name: "dataSourceConfig", type: "object", description: `{ method: "GET"|"POST", headers: {}, responsePath: "data.value" }` },
        ],
        response: `{ "milestone": { "id", "dataSourceType", "dataSourceUrl", "connectorStatus" } }`,
      },
    ],
  },
  {
    title: "Proof Submission",
    endpoints: [
      {
        method: "POST",
        path: "/api/proof/upload",
        description: "Submit a file as proof for a milestone. Triggers AI verification automatically.",
        params: [
          { name: "milestoneId", type: "string (form)", required: true, description: "ID of the milestone to submit proof for" },
          { name: "file", type: "File (form)", required: true, description: "PDF, image (JPEG/PNG/WEBP), DOCX, or XLSX — max 10 MB" },
        ],
        response: `{ "proofId": "...", "status": "PROOF_SUBMITTED" }`,
      },
      {
        method: "POST",
        path: "/api/proof/github",
        description: "Link a GitHub repository as proof for a milestone.",
        params: [
          { name: "milestoneId", type: "string", required: true, description: "ID of the milestone" },
          { name: "githubUrl", type: "string", required: true, description: "Full GitHub repo URL, e.g. https://github.com/org/repo" },
        ],
        response: `{ "proofId": "...", "status": "PROOF_SUBMITTED" }`,
      },
    ],
  },
  {
    title: "Attestation Results",
    endpoints: [
      {
        method: "GET",
        path: "/api/enterprise/attestations/[id]",
        description: "Get the full attestation history for a contract, including all AI verdicts and XRPL tx hashes.",
        response: `{ "contract": { "id", "milestones": [{ "attestationEntries": [{ "period", "aiVerdict", "aiReasoning", "xrplTxHash", "certUrl" }] }] } }`,
      },
    ],
  },
  {
    title: "Webhooks",
    endpoints: [
      {
        method: "GET",
        path: "/api/webhooks",
        description: "List all registered webhook endpoints and available event types.",
        response: `{ "endpoints": [...], "availableEvents": ["attestation.completed", "contract.funded", ...] }`,
      },
      {
        method: "POST",
        path: "/api/webhooks",
        description: "Register a new webhook endpoint. The signing secret is returned once and never stored.",
        params: [
          { name: "url", type: "string", required: true, description: "HTTPS endpoint to receive events (must be public internet)" },
          { name: "events", type: "string[]", required: true, description: `Subset of available events, or ["*"] for all` },
        ],
        response: `{ "endpoint": { "id", "url", "events", "active" }, "secret": "hex32..." }`,
      },
      {
        method: "DELETE",
        path: "/api/webhooks?id=[endpointId]",
        description: "Delete a webhook endpoint.",
        response: `{ "ok": true }`,
      },
      {
        method: "PATCH",
        path: "/api/webhooks?id=[endpointId]",
        description: "Toggle active status or update subscribed events for an endpoint.",
        params: [
          { name: "active", type: "boolean", description: "Enable or disable the endpoint" },
          { name: "events", type: "string[]", description: "Update subscribed event list" },
        ],
        response: `{ "endpoint": { ... } }`,
      },
      {
        method: "PUT",
        path: "/api/webhooks?id=[endpointId]",
        description: "Regenerate the signing secret for an endpoint. Returns new secret once.",
        response: `{ "secret": "newhex32..." }`,
      },
    ],
  },
  {
    title: "Webhook Payload Format",
    endpoints: [
      {
        method: "POST",
        path: "(your endpoint)",
        description: "Each event is sent as a signed POST. Verify authenticity using the X-Cascrow-Signature header.",
        response: `// Header: X-Cascrow-Signature: sha256=<HMAC-SHA256(raw_body, secret)>
// Body:
{
  "event": "attestation.completed",
  "contractId": "...",
  "milestoneId": "...",
  "data": { ... },
  "ts": 1714000000000
}`,
      },
    ],
  },
  {
    title: "CSV Import",
    endpoints: [
      {
        method: "POST",
        path: "/api/enterprise/import/csv",
        description: "Bulk-create an attestation contract from a CSV file. Returns the new contract ID.",
        params: [
          { name: "file", type: "File (form)", required: true, description: "CSV with columns: title, deadline (YYYY-MM-DD), description (opt), verificationCriteria (opt)" },
          { name: "contractTitle", type: "string (form)", description: "Optional name for the goal set" },
        ],
        response: `{ "contractId": "...", "milestoneCount": 5 }`,
      },
    ],
  },
];

export default function ApiDocsPage() {
  return (
    <main style={{ minHeight: "100vh", background: BG, padding: "48px 24px" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: 48 }}>
          <Link href="/" style={{ color: MUTED, fontSize: 13, textDecoration: "none" }}>← cascrow.com</Link>
          <h1 style={{ fontFamily: "var(--font-libre-franklin)", fontWeight: 300, fontSize: 36, color: TEXT, margin: "16px 0 8px" }}>
            API Reference
          </h1>
          <p style={{ color: MUTED, fontSize: 15, lineHeight: 1.6 }}>
            Programmatic access to attestation contracts, milestone verification, and webhook events.
            Generate API keys at{" "}
            <Link href="/enterprise/settings/api-keys" style={{ color: ACCENT }}>
              Settings → API Keys
            </Link>.
          </p>
        </div>

        {/* Base URL */}
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "16px 20px", marginBottom: 40 }}>
          <p style={{ fontSize: 12, color: MUTED, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Base URL</p>
          <Code>https://cascrow.com</Code>
          <p style={{ fontSize: 13, color: MUTED, marginTop: 10 }}>
            All endpoints require{" "}
            <Code>Authorization: Bearer {"<api_key>"}</Code>{" "}
            in the request header. API keys can be created and revoked at any time.
          </p>
        </div>

        {/* Sections */}
        {sections.map((section) => (
          <div key={section.title} style={{ marginBottom: 48 }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: ACCENT, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>
              {section.title}
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {section.endpoints.map((ep) => (
                <div key={ep.path + ep.method} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ padding: "14px 20px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", gap: 12 }}>
                    <Badge method={ep.method} />
                    <code style={{ fontSize: 13.5, color: TEXT, fontFamily: "monospace" }}>{ep.path}</code>
                  </div>
                  <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
                    <p style={{ fontSize: 13.5, color: MUTED, lineHeight: 1.6, margin: 0 }}>{ep.description}</p>

                    {ep.params && ep.params.length > 0 && (
                      <div>
                        <p style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Parameters</p>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                          <tbody>
                            {ep.params.map((p) => (
                              <tr key={p.name} style={{ borderBottom: `1px solid ${BORDER}` }}>
                                <td style={{ padding: "6px 0", paddingRight: 12, width: "30%", verticalAlign: "top" }}>
                                  <Code>{p.name}</Code>
                                  {p.required && <span style={{ color: "#F87171", marginLeft: 4, fontSize: 11 }}>*</span>}
                                </td>
                                <td style={{ padding: "6px 0", color: "#7DB8F7", fontFamily: "monospace", fontSize: 12, width: "15%", verticalAlign: "top" }}>{p.type}</td>
                                <td style={{ padding: "6px 0", color: MUTED, lineHeight: 1.5, verticalAlign: "top" }}>{p.description}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {ep.response && (
                      <div>
                        <p style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Response</p>
                        <pre style={{ background: "rgba(0,0,0,0.3)", borderRadius: 8, padding: "12px 16px", fontSize: 12, color: "#86efac", overflowX: "auto", margin: 0, lineHeight: 1.6 }}>
                          {ep.response}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Footer note */}
        <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 32, color: MUTED, fontSize: 13, lineHeight: 1.7 }}>
          <p>
            All API responses use JSON. Errors return <Code>{`{ "error": "..." }`}</Code> with appropriate HTTP status codes.
            Rate limits apply per API key. Contact <a href="mailto:support@cascrow.com" style={{ color: ACCENT }}>support@cascrow.com</a> for higher limits.
          </p>
        </div>
      </div>
    </main>
  );
}
