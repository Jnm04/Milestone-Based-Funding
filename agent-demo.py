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
import requests
import sseclient

BASE_URL = os.environ.get("CASCROW_BASE_URL", "https://cascrow.com").rstrip("/")
API_KEY  = os.environ.get("CASCROW_API_KEY", "")

BOLD  = "\033[1m"
GREEN = "\033[32m"
CYAN  = "\033[36m"
AMBER = "\033[33m"
RED   = "\033[31m"
RESET = "\033[0m"

def step(n, label):
    print(f"\n{BOLD}{AMBER}[{n}/5]{RESET} {BOLD}{label}{RESET}")

def ok(msg):
    print(f"  {GREEN}✓{RESET} {msg}")

def info(msg):
    print(f"  {CYAN}→{RESET} {msg}")

def fail(msg, resp=None):
    print(f"\n{RED}✗ {msg}{RESET}")
    if resp is not None:
        print(f"  Status: {resp.status_code}")
        try:
            print(f"  Body:   {resp.json()}")
        except Exception:
            print(f"  Body:   {resp.text[:300]}")
    sys.exit(1)

def headers():
    return {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
    }

def post(path, payload):
    r = requests.post(f"{BASE_URL}{path}", json=payload, headers=headers(), timeout=30)
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

# Verify the API key works
r = requests.get(f"{BASE_URL}/api/health", timeout=10)
if not r.ok:
    fail("Health check failed — is the server running?", r)
ok("Server reachable")


# ─── Step 1: Create contract ──────────────────────────────────────────────────

step(1, "Agent creates escrow contract")

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
invite_link  = data.get("inviteLink")

ok(f"Contract created  →  {contract_id}")
info(f"View: {BASE_URL}/contract/{contract_id}")
if invite_link:
    info(f"Invite: {BASE_URL}/dashboard/startup?invite={invite_link}")


# ─── Step 2: Accept contract (join as startup) ────────────────────────────────

step(2, "Startup agent accepts contract")

if invite_link:
    r2 = post(f"/api/contracts/{contract_id}/join", {"inviteLink": invite_link})
    if r2.ok:
        ok("Contract accepted via invite")
    else:
        # Already linked or self-linked — not a fatal error in demo
        info(f"Join response: {r2.status_code} — {r2.text[:120]}")
else:
    info("Contract was directly linked — no invite needed")


# ─── Step 3: Fund milestone (agent escrow — no MetaMask) ─────────────────────

step(3, "Investor agent funds escrow (simulated on-chain)")

r3 = post("/api/agent/fund-milestone", {"contractId": contract_id})
data3 = check(r3, "Fund milestone failed")

ok(f"Milestone funded  →  {data3['status']}")
info(f"Simulated tx hash: {data3['txHash'][:18]}…")
milestone_id = data3["milestoneId"]


# ─── Step 4: Submit proof ─────────────────────────────────────────────────────

step(4, "Startup agent submits proof of work")

proof_content = f"""MILESTONE COMPLETION REPORT
===========================
Contract: {contract_id}
Milestone: Build and deploy landing page

DELIVERABLES COMPLETED
1. Live landing page deployed at https://demo-startup.vercel.app
2. Hero section with product value proposition and CTA
3. Features section with 6 product highlights
4. Contact form with email validation (powered by Resend)
5. Responsive design — tested on mobile, tablet, desktop
6. Lighthouse score: Performance 94, Accessibility 100, SEO 100

EVIDENCE
- GitHub repo: github.com/demo-startup/landing (public, 47 commits)
- Deployment: Vercel dashboard screenshot attached
- Live URL screenshot (pages 2-3)
- Lighthouse report export (page 4)

All deliverables meet the acceptance criteria defined in the contract.
Submitted: {time.strftime("%Y-%m-%d %H:%M UTC")}
"""

proof_bytes = proof_content.encode("utf-8")
files = {
    "file": ("completion-report.txt", proof_bytes, "text/plain"),
    "milestoneId": (None, milestone_id),
}
auth_header = {"Authorization": f"Bearer {API_KEY}"}
r4 = requests.post(f"{BASE_URL}/api/proof/upload", files=files, headers=auth_header, timeout=30)
data4 = check(r4, "Proof upload failed")

proof_id = data4["proofId"]
ok(f"Proof submitted  →  {proof_id}")


# ─── Step 5: AI verification (live SSE stream) ────────────────────────────────

step(5, "AI verification — 5-model majority vote (live)")

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
            print(f"  {CYAN}○{RESET} Attempt {msg['n']}/{msg['total']} — querying 5 AI models…")

        elif t == "retrying":
            wait = msg.get("waitSeconds", 0)
            print(f"  {AMBER}↻{RESET} {msg.get('message', 'Retrying…')}")
            print(f"  {AMBER}  Waiting {wait}s before next attempt…{RESET}")

        elif t == "complete":
            final = msg
            decision  = msg.get("decision", "?")
            action    = msg.get("action", "?")
            confidence = msg.get("confidence", 0)
            reasoning  = msg.get("reasoning", "")

            color = GREEN if decision == "YES" else RED
            print(f"\n  {color}{BOLD}Decision: {decision}  ({confidence}% confidence){RESET}")
            print(f"  Action:   {BOLD}{action}{RESET}")
            print()

            # Wrap reasoning at 72 chars
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
                print(f"\n  {GREEN}✓{RESET} Funds released  →  tx: {msg['txHash'][:18]}…")
            break

        elif t == "error":
            fail(f"Verification error: {msg.get('message')}")


# ─── Summary ──────────────────────────────────────────────────────────────────

print(f"\n{'─' * 50}")
print(f"{BOLD}{GREEN}Demo complete!{RESET}")
print(f"\n  Contract:  {BASE_URL}/contract/{contract_id}")
print()

if final and final.get("action") in ("VERIFIED", "COMPLETED"):
    print(f"  {GREEN}✓ Milestone verified — funds released automatically{RESET}")
    print(f"  {GREEN}✓ NFT certificate minted on XRP Ledger{RESET}")
elif final and final.get("action") == "REJECTED":
    print(f"  {RED}✗ Milestone rejected — funds held in escrow{RESET}")
elif final and final.get("action") == "PENDING_REVIEW":
    print(f"  {AMBER}⚠ Manual review required — low confidence{RESET}")
else:
    print(f"  Status: {final}")

print()
