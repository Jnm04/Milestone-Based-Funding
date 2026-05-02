#!/usr/bin/env python3
"""
cascrow Agent Demo
==================
Demonstrates an AI agent autonomously hiring another agent via cascrow:
  1. Create a contract with a milestone
  2. Accept the contract (as the startup)
  3. Fund escrow (simulated — no MetaMask needed)
  4. Submit proof
  5. Stream live AI verification (5-model vote)
  6. Show funds released + NFT minted

Usage:
  pip install requests sseclient-py
  export CASCROW_API_KEY=csk_...
  python agent-demo.py

Or override the base URL for local dev:
  CASCROW_BASE_URL=http://localhost:3000 python agent-demo.py
"""

import os
import sys
import time
import json
import webbrowser
import requests
import sseclient

BASE_URL = os.environ.get("CASCROW_BASE_URL", "https://cascrow.com").rstrip("/")
API_KEY  = os.environ.get("CASCROW_API_KEY", "")

BOLD  = "\033[1m"
GREEN = "\033[32m"
CYAN  = "\033[36m"
AMBER = "\033[33m"
RED   = "\033[31m"
DIM   = "\033[2m"
RESET = "\033[0m"

def step(n, label):
    print(f"\n{BOLD}{AMBER}[{n}/5]{RESET} {BOLD}{label}{RESET}")

def ok(msg):
    print(f"  {GREEN}✓{RESET} {msg}")

def info(msg):
    print(f"  {CYAN}→{RESET} {msg}")

def dim(msg):
    print(f"  {DIM}{msg}{RESET}")

def fail(msg, resp=None):
    print(f"\n{RED}✗ {msg}{RESET}")
    if resp is not None:
        print(f"  Status: {resp.status_code}")
        try:
            print(f"  Body:   {resp.json()}")
        except Exception:
            print(f"  Body:   {resp.text[:300]}")
    sys.exit(1)

def pause(seconds, reason=""):
    if reason:
        dim(f"Waiting {seconds}s — {reason}")
    for _ in range(seconds):
        time.sleep(1)
        print(f"  {DIM}.{RESET}", end="", flush=True)
    print()

def api_headers():
    return {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
    }

def post(path, payload):
    r = requests.post(f"{BASE_URL}{path}", json=payload, headers=api_headers(), timeout=30)
    return r

def check(r, label):
    if not r.ok:
        fail(label, r)
    return r.json()


# ─── Preflight ────────────────────────────────────────────────────────────────

print(f"\n{BOLD}cascrow Agent Demo{RESET}  —  {BASE_URL}")
print("─" * 50)

if not API_KEY:
    fail("Set CASCROW_API_KEY=csk_... before running")

r = requests.get(f"{BASE_URL}/api/health", timeout=10)
if not r.ok:
    fail("Health check failed — is the server running?", r)
ok("Server reachable")


# ─── Step 1: Create contract ──────────────────────────────────────────────────

step(1, "Agent creates escrow contract")
dim("Defining milestone: landing page — $200 — 7 day deadline")
time.sleep(1)

deadline = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() + 7 * 86400))

payload = {
    "milestones": [
        {
            "title": "Build and deploy landing page with hero, features, and contact form",
            "amountUSD": 200,
            "cancelAfter": deadline,
        }
    ]
}

data = check(post("/api/contracts", payload), "Create contract failed")
contract_id = data["contractId"]
contract_url = f"{BASE_URL}/contract/{contract_id}"

ok(f"Contract created  →  {contract_id}")
info(f"Opening in browser…")

# Open browser so viewer can watch the UI update live
webbrowser.open(contract_url)
time.sleep(2)


# ─── Step 2: Accept contract ─────────────────────────────────────────────────

step(2, "Startup agent accepts contract")
ok("Auto-accepted — agent acts as both investor and startup in this demo")
time.sleep(1)


# ─── Step 3: Fund milestone ───────────────────────────────────────────────────

step(3, "Investor agent funds escrow (on-chain)")
dim("Fetching EVM calldata from cascrow…")
time.sleep(1)

# Get real EVM calldata — same bytes MetaMask would sign in production
r3a = post("/api/escrow/create", {"contractId": contract_id})
data3a = check(r3a, "Escrow calldata failed")

print()
print(f"  {BOLD}Transaction 1 — RLUSD.approve(){RESET}  {DIM}(ERC-20 spending approval){RESET}")
print(f"  {DIM}Contract : {data3a['rlusdAddress']}{RESET}")
print(f"  {DIM}Calldata : {data3a['approveCalldata'][:42]}…{RESET}")
print()
print(f"  {BOLD}Transaction 2 — escrow.fundMilestone(){RESET}  {DIM}(locks RLUSD in smart contract){RESET}")
print(f"  {DIM}Contract : {data3a['escrowContractAddress']}{RESET}")
print(f"  {DIM}Calldata : {data3a['fundCalldata'][:42]}…{RESET}")
print(f"  {DIM}Amount   : ${data3a['amountUSD']} RLUSD{RESET}")
print()
dim("→ In production these two calldata payloads trigger MetaMask popups.")
dim("→ Agent signs autonomously — no human needed.")
time.sleep(2)

# Simulate the on-chain confirmation
r3b = post("/api/agent/fund-milestone", {"contractId": contract_id})
data3b = check(r3b, "Fund milestone failed")
milestone_id = data3b["milestoneId"]

ok(f"Escrow funded  →  {data3b['status']}")
info(f"Simulated tx: {data3b['txHash'][:22]}…")

pause(4, "browser is showing FUNDED status")


# ─── Step 4: Submit proof ─────────────────────────────────────────────────────

step(4, "Startup agent submits proof of work")
dim("Generating completion report…")
time.sleep(2)

proof_content = f"""MILESTONE COMPLETION REPORT
===========================
Contract:  {contract_id}
Milestone: Build and deploy landing page with hero, features, and contact form
Submitted: {time.strftime("%Y-%m-%d %H:%M UTC")}

DELIVERABLES COMPLETED
1. Live landing page deployed at https://demo-startup.vercel.app
2. Hero section with product value proposition and CTA button
3. Features section with 6 product highlights and icons
4. Contact form with email validation (Resend integration)
5. Fully responsive — tested on mobile, tablet, desktop
6. Lighthouse: Performance 94 / Accessibility 100 / SEO 100

EVIDENCE
- GitHub: github.com/demo-startup/landing — 47 commits, public repo
- Vercel deployment dashboard screenshot (page 2)
- Live URL screenshot showing all 3 sections (page 3)
- Lighthouse report PDF export (page 4)
- Contact form test submission confirmation (page 5)

All deliverables directly address the milestone criteria in the contract.
"""

proof_bytes = proof_content.encode("utf-8")
files = {
    "file": ("completion-report.txt", proof_bytes, "text/plain"),
    "milestoneId": (None, milestone_id),
}
r4 = requests.post(
    f"{BASE_URL}/api/proof/upload",
    files=files,
    headers={"Authorization": f"Bearer {API_KEY}"},
    timeout=30,
)
data4 = check(r4, "Proof upload failed")
proof_id = data4["proofId"]

ok(f"Proof submitted  →  {proof_id}")
pause(3, "browser is showing PROOF_SUBMITTED status")


# ─── Step 5: AI verification (live SSE stream) ────────────────────────────────

step(5, "AI verification — 5-model majority vote (live)")
dim("Querying Claude, GPT-4o, Gemini, Mistral, Cerebras in parallel…")
print()

verify_url = f"{BASE_URL}/api/verify"
stream_headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
    "Accept": "text/event-stream",
}

with requests.post(
    verify_url,
    json={"proofId": proof_id},
    headers=stream_headers,
    stream=True,
    timeout=180,
) as r5:
    if not r5.ok:
        fail("Verify request failed", r5)

    client = sseclient.SSEClient(r5)
    final = None

    for event in client.events():
        if not event.data or event.data.strip() == "":
            continue
        try:
            msg = json.loads(event.data)
        except json.JSONDecodeError:
            continue

        t = msg.get("type")

        if t == "attempt":
            print(f"  {CYAN}○{RESET} Attempt {msg['n']}/{msg['total']} — 5 models voting…")

        elif t == "retrying":
            wait = msg.get("waitSeconds", 0)
            print(f"  {AMBER}↻{RESET} {msg.get('message', 'Retrying…')}")
            dim(f"  Waiting {wait}s…")

        elif t == "complete":
            final = msg
            decision   = msg.get("decision", "?")
            action     = msg.get("action", "?")
            confidence = msg.get("confidence", 0)
            reasoning  = msg.get("reasoning", "")

            color = GREEN if decision == "YES" else RED
            print(f"\n  {color}{BOLD}Decision: {decision}  ({confidence}% confidence){RESET}")
            print(f"  Action:   {BOLD}{action}{RESET}")
            print()

            # Word-wrap reasoning at 72 chars
            words = reasoning.split()
            line = "  "
            for w in words:
                if len(line) + len(w) + 1 > 74:
                    print(f"{CYAN}{line}{RESET}")
                    line = "  " + w + " "
                else:
                    line += w + " "
            if line.strip():
                print(f"{CYAN}{line}{RESET}")

            if msg.get("txHash"):
                print(f"\n  {GREEN}✓{RESET} Funds released  →  tx: {msg['txHash'][:22]}…")
            break

        elif t == "error":
            fail(f"Verification error: {msg.get('message')}")


# ─── Summary ──────────────────────────────────────────────────────────────────

print(f"\n{'─' * 50}")
print(f"{BOLD}{GREEN}Demo complete!{RESET}")
print(f"\n  {BOLD}Contract:{RESET}  {contract_url}")
print()

if final and final.get("action") in ("VERIFIED", "COMPLETED"):
    print(f"  {GREEN}✓{RESET} Milestone verified — funds released automatically")
    print(f"  {GREEN}✓{RESET} NFT certificate minted on XRP Ledger")
elif final and final.get("action") == "REJECTED":
    print(f"  {RED}✗{RESET} Milestone rejected — funds held in escrow")
elif final and final.get("action") == "PENDING_REVIEW":
    print(f"  {AMBER}⚠{RESET} Manual review required — low AI confidence")
else:
    print(f"  Status: {final}")

print()

# Re-open browser to show final completed state
info("Opening completed contract in browser…")
webbrowser.open(contract_url)
