/**
 * Cascrow GitHub Action — Submit Proof & Wait for Verification
 *
 * Uses only Node.js built-ins + @actions/core to keep the bundle small.
 * No compile step needed — runs directly with node20.
 *
 * Flow:
 *  1. POST /api/proof/upload  → get proofId
 *  2. If wait-for-result=true: poll /api/agent/proof-status/:id until done
 *  3. Set outputs, exit 1 if decision is NO
 */

const https = require("https");
const { URL } = require("url");

// ─── @actions/core shim (avoids npm install in the action directory) ──────────
// Reads INPUT_* env vars (set by the GitHub Actions runner) and writes to stdout
// using the ::set-output / ::error workflow commands.

function getInput(name) {
  const key = `INPUT_${name.replace(/ /g, "_").toUpperCase()}`;
  return (process.env[key] ?? "").trim();
}

function setOutput(name, value) {
  // GitHub Actions output format
  process.stdout.write(`::set-output name=${name}::${value}\n`);
}

function setFailed(message) {
  process.stdout.write(`::error::${message}\n`);
  process.exit(1);
}

function info(message) {
  process.stdout.write(`${message}\n`);
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

function request(method, urlStr, headers, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === "https:" ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers,
    };
    const req = (url.protocol === "https:" ? https : require("http")).request(options, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const body = Buffer.concat(chunks).toString();
        resolve({ status: res.statusCode, body });
      });
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  const apiKey = getInput("api-key");
  const milestoneId = getInput("milestone-id");
  const content = getInput("content");
  const filename = getInput("filename") || "proof-report.txt";
  const waitForResult = getInput("wait-for-result") !== "false";
  const baseUrl = (getInput("cascrow-url") || "https://cascrow.com").replace(/\/$/, "");

  if (!apiKey) return setFailed("api-key input is required");
  if (!milestoneId) return setFailed("milestone-id input is required");
  if (!content) return setFailed("content input is required");

  // ── Step 1: Submit proof via multipart form ──────────────────────────────────
  info(`Submitting proof for milestone ${milestoneId}…`);

  // Build multipart/form-data manually
  const boundary = `----CascrowBoundary${Date.now()}`;
  const CRLF = "\r\n";

  const fileField =
    `--${boundary}${CRLF}` +
    `Content-Disposition: form-data; name="file"; filename="${filename}"${CRLF}` +
    `Content-Type: text/plain${CRLF}${CRLF}` +
    `${content}${CRLF}`;

  const milestoneField =
    `--${boundary}${CRLF}` +
    `Content-Disposition: form-data; name="milestoneId"${CRLF}${CRLF}` +
    `${milestoneId}${CRLF}`;

  const bodyStr = fileField + milestoneField + `--${boundary}--${CRLF}`;

  const uploadRes = await request(
    "POST",
    `${baseUrl}/api/proof/upload`,
    {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
      "Content-Length": Buffer.byteLength(bodyStr),
    },
    bodyStr
  );

  let uploadData;
  try {
    uploadData = JSON.parse(uploadRes.body);
  } catch {
    return setFailed(`Cascrow API returned non-JSON response (HTTP ${uploadRes.status})`);
  }

  if (uploadRes.status >= 400) {
    return setFailed(`Proof submission failed (HTTP ${uploadRes.status}): ${uploadData.error ?? uploadRes.body}`);
  }

  const proofId = uploadData.proofId;
  if (!proofId) return setFailed("Cascrow API did not return a proofId");

  setOutput("proof-id", proofId);
  info(`Proof submitted. ID: ${proofId}`);

  if (!waitForResult) {
    setOutput("decision", "PENDING");
    setOutput("confidence", "");
    setOutput("reasoning", "");
    info("wait-for-result=false — not waiting for AI verification.");
    return;
  }

  // ── Step 2: Poll for verification result ─────────────────────────────────────
  info("Waiting for AI verification…");

  const MAX_WAIT_MS = 120_000; // 2 minutes
  const POLL_MS = 6_000;
  const started = Date.now();

  while (Date.now() - started < MAX_WAIT_MS) {
    await sleep(POLL_MS);

    const statusRes = await request(
      "GET",
      `${baseUrl}/api/agent/proof-status/${encodeURIComponent(proofId)}`,
      { Authorization: `Bearer ${apiKey}` },
      null
    );

    let statusData;
    try {
      statusData = JSON.parse(statusRes.body);
    } catch {
      info("Could not parse status response — retrying…");
      continue;
    }

    if (statusRes.status >= 400) {
      info(`Status check returned HTTP ${statusRes.status} — retrying…`);
      continue;
    }

    if (!statusData.pending) {
      const decision = statusData.decision ?? "NO";
      const confidence = statusData.confidence ?? 0;
      const reasoning = (statusData.reasoning ?? "").slice(0, 300);

      setOutput("decision", decision);
      setOutput("confidence", String(confidence));
      setOutput("reasoning", reasoning);

      if (decision === "YES") {
        info(`✅ Verification APPROVED (${confidence}% confidence)`);
        if (reasoning) info(reasoning);
        return;
      } else {
        setFailed(`❌ Verification REJECTED (${confidence}% confidence): ${reasoning || "See Cascrow dashboard for details."}`);
        return;
      }
    }

    info(`  Still verifying… (${Math.round((Date.now() - started) / 1000)}s elapsed)`);
  }

  // Timed out — don't fail the CI step, just warn
  setOutput("decision", "PENDING");
  setOutput("confidence", "");
  setOutput("reasoning", "Verification timed out — check Cascrow dashboard.");
  info(`⚠️  Verification did not complete within 2 minutes. proofId: ${proofId}`);
  info("Check your Cascrow dashboard for the final result.");
}

run().catch((err) => setFailed(String(err?.message ?? err)));
