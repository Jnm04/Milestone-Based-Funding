# cascrow — New Feature Roadmap (Phase 7+)

> **Last updated:** 2026-04-24
> **Status:** Planning — not yet started.
> See [PLANNING.md](PLANNING.md) for Phases 1–5 (Escrow features A–Z).
> See [PLANNING_ENTERPRISE.md](PLANNING_ENTERPRISE.md) for Phase 6 (Enterprise Attestation, all complete).

---

## Overview

This document plans the next generation of cascrow features across three categories:

| Category | Requires Incorporation? | Features |
|----------|------------------------|---------|
| **A — Enterprise Enhancements** | ❌ No | SSO/SAML, Multi-Entity, Slack/Teams, Health Monitoring, Regulatory Alerts, Confidential Attestation, Audit Firm Portal |
| **B — Escrow Enhancements** | ❌ No | Deal Room, Contract Templates, Startup Public Profile, Mobile Proof Upload |
| **C — Monetisation & Financial** | ✅ Yes — registered company required | In-App Billing, RLUSD Fiat Onramp, Protocol Fee, Investor Syndicate, Yield on Escrow |

**Important:** Category C features involve collecting money from users or pooling third-party funds. Under German/EU law (GewO, ZAG, KWG, KAGB), this requires at minimum a registered Gewerbe, and some features additionally require BaFin authorisation. Do not ship Category C features in production without a registered legal entity.

---

## Build Priority

```
Phase 7 — Enterprise Scale (no incorporation needed)
  Feature 1 — SSO / SAML
  Feature 2 — Multi-Entity / Group Structure
  Feature 3 — Slack & Microsoft Teams Integration
  Feature 4 — Connector Health Monitoring

Phase 8 — Escrow & Product Polish (no incorporation needed)
  Feature 5 — Deal Room
  Feature 6 — Contract Templates
  Feature 7 — Startup Public Profile & Verified Badge
  Feature 8 — Mobile-Optimised Proof Upload
  Feature 9 — Regulatory Change Alerts (Enterprise)
  Feature 10 — Confidential Attestation Mode
  Feature 11 — Audit Firm Partner Portal

Phase 9 — Monetisation (requires registered company)
  Feature 12 — In-App Billing (Stripe Subscriptions)
  Feature 13 — RLUSD Fiat Onramp (MoonPay / Transak)
  Feature 14 — Protocol Fee (0.5% on Escrow Release)
  Feature 15 — Investor Syndicate / Co-Invest
  Feature 16 — Yield on Locked Escrow Funds
```

---

## Phase 7 — Enterprise Scale

---

### Feature 1 — SSO / SAML (Okta, Azure AD, Google Workspace)

**Why:** Every enterprise IT department requires SSO before approving a new tool. Without it, cascrow cannot be sold to companies with >50 employees. This is a hard prerequisite for enterprise sales.

**What it does:**
- Users authenticate via their company's identity provider (Okta, Azure AD, Google Workspace) using SAML 2.0 or OIDC
- Enterprise account owner configures SSO in Settings → Security tab
- Team members no longer need a cascrow password — they log in with their company credentials
- Session management follows the IdP's session policies (auto-logout, MFA enforcement)

**Approach:**
Use `next-auth` with a generic SAML/OIDC provider. Libraries: `@boxyhq/saml-jackson` (open-source, self-hostable SAML proxy) or `WorkOS` (managed, ~$49/month per enterprise customer).

Recommendation: **WorkOS** for MVP — handles SAML, SCIM provisioning, audit logs. One integration covers 100+ IdPs. Can be swapped for self-hosted Jackson later.

**DB Changes:**
```prisma
model SsoConfig {
  id           String   @id @default(cuid())
  orgId        String   @unique  // links to OrgMember owner's userId
  provider     String            // "workos" | "saml" | "oidc"
  connectionId String            // WorkOS connection ID or SAML metadata URL
  domain       String            // e.g. "bmw.de" — auto-routes users with this email domain
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

**New API Routes:**
- `POST /api/enterprise/sso` — save SSO config
- `GET /api/enterprise/sso` — get current config
- `DELETE /api/enterprise/sso` — remove SSO (revert to password)
- NextAuth callback route for WorkOS OIDC

**UI:**
Settings sub-tab "Security" → "Single Sign-On" section:
- Input: "Your company email domain" (e.g. `bmw.de`)
- Button: "Configure SSO" → opens WorkOS-hosted setup wizard
- Status badge: Enabled / Not configured
- Warning: "Once enabled, all team members with @domain.com email addresses must log in via SSO"

**Effort:** Medium (3–4 days)

---

### Feature 2 — Multi-Entity / Group Structure

**Why:** CSRD reporting obligations apply at the consolidated group level. A company like Bosch has 400+ subsidiaries — all need to be attested. Today each subsidiary would need a separate cascrow account. Enterprises need one parent account that manages all subsidiaries centrally.

**What it does:**
- Parent organisation creates "entities" (subsidiaries / business units)
- Each entity has its own attestation workspace, team members, and goals
- Parent can see a consolidated roll-up view: X of Y entities on track, group-wide compliance rate
- Board report covers the entire group, not just one entity
- Enterprise billing is at the parent level (one invoice covers all entities)

**DB Changes:**
```prisma
model Organisation {
  id          String   @id @default(cuid())
  name        String
  ownerId     String   @unique
  plan        String   @default("free") // "free" | "pro" | "enterprise"
  createdAt   DateTime @default(now())
  entities    Entity[]
  owner       User     @relation(fields: [ownerId], references: [id])
}

model Entity {
  id             String       @id @default(cuid())
  name           String
  orgId          String
  parentEntityId String?      // optional, for nested structures
  createdAt      DateTime     @default(now())
  organisation   Organisation @relation(fields: [orgId], references: [id])
  members        OrgMember[]
  contracts      Contract[]   // attestation contracts owned by this entity
}
```

Existing `OrgMember` model gains `entityId String?` — members can be scoped to a specific entity or have group-wide access.

**New Pages:**
- `/enterprise/group` — Group overview dashboard: entities list, per-entity compliance score, roll-up stats
- `/enterprise/group/[entityId]` — entity detail (same as current attestation dashboard, scoped)
- `/enterprise/settings/entities` — manage entities (add / rename / archive)

**New API Routes:**
- `GET/POST /api/enterprise/entities` — list / create entities
- `PATCH/DELETE /api/enterprise/entities/[id]`
- `GET /api/enterprise/group/summary` — aggregate stats across all entities

**Effort:** High (5–7 days, mainly data model + scoped auth)

---

### Feature 3 — Slack & Microsoft Teams Integration

**Why:** Enterprise workflows run in Slack or Teams. Email notifications are not enough — decisions and alerts need to appear where the team already works.

**What it does:**
- Users connect a Slack workspace or Teams tenant from Settings → Notifications
- Choose which events trigger notifications: attestation completed, deadline in 7 days, AI verdict, connector error
- Notification is sent to a configurable channel (e.g. `#esg-reporting`)
- Message includes: goal title, verdict (✅ / ❌), XRPL link, link to cascrow

**Approach:**
- Slack: OAuth 2.0 app install flow, store `access_token` + `channel_id`, use `chat.postMessage` API
- Teams: Incoming Webhook (simpler, no OAuth needed for MVP), or full Teams App with Bot Framework

Recommended MVP: Slack OAuth + Teams Incoming Webhook. Full Teams Bot in Phase 8.

**DB Changes:**
```prisma
model NotificationIntegration {
  id          String   @id @default(cuid())
  userId      String
  type        String   // "slack" | "teams"
  accessToken String?  @db.Text  // encrypted, Slack only
  webhookUrl  String?  @db.Text  // Teams incoming webhook URL
  channelId   String?            // Slack channel ID
  channelName String?            // human-readable, for UI display
  events      Json               // array of event strings to notify on
  createdAt   DateTime @default(now())
  user        User     @relation(fields: [userId], references: [id])

  @@unique([userId, type])
}
```

**New API Routes:**
- `GET /api/enterprise/integrations/slack/connect` — initiates OAuth flow
- `GET /api/enterprise/integrations/slack/callback` — OAuth callback, saves token
- `POST /api/enterprise/integrations/teams` — save Teams webhook URL
- `DELETE /api/enterprise/integrations/[type]` — disconnect
- `POST /api/enterprise/integrations/[type]/test` — send a test message

**Extend `fireWebhook` service:** After existing webhook delivery, also call `sendSlackNotification()` / `sendTeamsNotification()` if integration is active for that event type.

**UI:**
Settings tab "Notifications" → "Integrations" section:
- "Connect Slack" button → OAuth flow → shows connected workspace + channel selector
- "Connect Microsoft Teams" → paste webhook URL + test button
- Event checkboxes per integration

**Effort:** Medium (3–4 days)

---

### Feature 4 — Connector Health Monitoring

**Why:** If a REST API connector returns 401 or a URL is unreachable, the owner should know *weeks* before the verification date — not on the day itself. A failed attestation due to a broken data source destroys trust.

**What it does:**
- Daily cron job checks every active data source connector (type `REST_API` and `URL_SCRAPE`)
- If a connector returns an error (non-2xx, DNS failure, timeout): owner receives email + Slack alert
- Alert includes: attestation name, connector URL, error code, days until verification date
- If a connector has been unhealthy for 7+ days and verification date is within 14 days: escalation email to all team members
- Health status is visible in the attestation detail page next to each data source

**DB Changes:**
```prisma
model ConnectorHealthCheck {
  id           String   @id @default(cuid())
  milestoneId  String
  connectorUrl String
  status       String   // "OK" | "ERROR" | "TIMEOUT"
  httpStatus   Int?
  errorMessage String?  @db.Text
  checkedAt    DateTime @default(now())

  @@index([milestoneId])
  @@index([checkedAt])
}

// Add to Milestone:
connectorLastHealthy DateTime?
connectorStatus      String?   @default("UNKNOWN") // "OK" | "ERROR" | "UNKNOWN"
```

**New API Route:**
- `GET /api/enterprise/attestations/[id]/connector-health` — latest health status per milestone

**New Cron Route:**
`/api/cron/connector-health` — runs daily at 07:00 UTC

```typescript
// Pseudocode
for each active attestation milestone with connectorType REST_API or URL_SCRAPE:
  try HEAD/GET connectorUrl (5s timeout)
  if error:
    save ConnectorHealthCheck (status=ERROR)
    update Milestone.connectorStatus = "ERROR"
    send alert email to owner
    if unhealthy for 7+ days AND verificationDate within 14 days:
      send escalation email to all team members
  else:
    save ConnectorHealthCheck (status=OK)
    update Milestone.connectorLastHealthy = now
```

**vercel.json addition:**
```json
{ "path": "/api/cron/connector-health", "schedule": "0 7 * * *" }
```

**UI:**
In attestation detail, next to each data source:
- Green dot: "Last checked X hours ago — OK"
- Red dot: "Error since DATE — check your API key or URL"
- Yellow dot: "Not checked yet"

**Effort:** Low–Medium (2–3 days)

---

## Phase 8 — Escrow & Product Polish

---

### Feature 5 — Deal Room (Pre-Commitment Due Diligence)

**Why:** Currently an investor creates a contract and immediately sends the invite link. There's no structured space for the startup to present themselves before the investor commits capital. A Deal Room bridges "interested" to "funded" with a proper due diligence step.

**What it does:**
- Investor creates a Deal Room (lightweight, no contract yet) and shares a link with a startup
- Startup uploads: pitch deck, cap table, incorporation certificate, financial projections — up to 5 files
- AI summarises all uploaded documents and produces a due diligence brief: company overview, key risks, financials summary, milestone feasibility assessment
- Investor reads the brief and either (a) converts the Deal Room into a Contract or (b) declines
- All documents are hashed and stored — if the deal completes, the hash is anchored on-chain as "data present at deal inception"

**DB Changes:**
```prisma
model DealRoom {
  id          String        @id @default(cuid())
  investorId  String
  startupId   String?       // set when startup accepts the link
  inviteToken String        @unique @default(cuid())
  status      String        @default("OPEN") // "OPEN" | "SUBMITTED" | "CONVERTED" | "DECLINED"
  aiBrief     String?       @db.Text
  briefAt     DateTime?
  convertedToContractId String?
  createdAt   DateTime      @default(now())
  documents   DealDocument[]
  investor    User          @relation("DealRoomInvestor", fields: [investorId], references: [id])
}

model DealDocument {
  id         String   @id @default(cuid())
  dealRoomId String
  name       String
  url        String
  sha256     String   // file hash for on-chain anchoring
  uploadedAt DateTime @default(now())
  dealRoom   DealRoom @relation(fields: [dealRoomId], references: [id])
}
```

**New Routes:**
- `POST /api/deal-room` — create deal room
- `GET /api/deal-room/[id]` — get deal room + brief
- `POST /api/deal-room/[id]/documents` — upload document (Vercel Blob)
- `POST /api/deal-room/[id]/generate-brief` — trigger AI brief generation
- `POST /api/deal-room/[id]/convert` — convert to Contract (pre-fills contract form)
- `POST /api/deal-room/[id]/decline`

**New Pages:**
- `/deal-room/[id]` — startup upload interface
- `/dashboard/investor` gains "Deal Rooms" tab alongside "Contracts"

**AI Strategy:**
Model: Claude Haiku — summarise each document individually, then produce a 1-page brief.
Output structure: `{ companyOverview, keyRisks, financialsSummary, milestoneFeasibility, overallRating: "HIGH|MEDIUM|LOW" }`

**Effort:** High (4–5 days)

---

### Feature 6 — Contract Templates

**Why:** Experienced investors create similar contract structures repeatedly (e.g. "standard SaaS seed deal: 3 milestones, $50k"). Today they re-enter everything manually. Templates save time and standardise deal structures.

**What it does:**
- After creating a contract, investor can click "Save as Template"
- Templates are stored under "My Templates" in the investor dashboard
- When creating a new contract, investor can "Load from Template" to pre-fill milestones
- Community Templates tab: anonymised, opt-in templates shared by other investors, browsable by industry/category
- Each community template shows: number of uses, average success rate of deals created from it

**DB Changes:**
```prisma
model ContractTemplate {
  id           String   @id @default(cuid())
  creatorId    String
  name         String
  description  String?
  industry     String?
  milestones   Json     // [{title, amountUSD, deadlineDays, description}]
  isPublic     Boolean  @default(false)
  useCount     Int      @default(0)
  createdAt    DateTime @default(now())
  creator      User     @relation(fields: [creatorId], references: [id])

  @@index([isPublic])
  @@index([industry])
}
```

**New API Routes:**
- `GET/POST /api/templates` — list own templates / create template
- `GET /api/templates/community` — browse public templates (paginated, filter by industry)
- `GET /api/templates/[id]` — get template detail
- `PATCH/DELETE /api/templates/[id]`
- `POST /api/templates/[id]/use` — increment useCount

**UI:**
- `contract-form.tsx`: "Load Template" button at top → modal with own templates + community tab
- Investor dashboard: "My Templates" section
- `/templates` — public community template browser (no auth required, promotes discovery)

**Effort:** Low–Medium (2–3 days)

---

### Feature 7 — Startup Public Profile & Verified Badge

**Why:** Completing milestones on cascrow should be a credibility signal startups can use externally. A verified public profile (opt-in) becomes a proof of reliability — like a Trustpilot for milestone execution. This also drives organic discovery for investors.

**What it does:**
- Startup opt-in: "Make my profile public" toggle in profile settings
- Public page at `/startup/[username]` shows:
  - Company name, description, website
  - "Cascrow Verified" badge (earned after first completed milestone)
  - Completion stats: X milestones completed, Y total RLUSD received, average proof approval rate
  - NFT certificates for each completed milestone (embedded cards)
  - Timeline of public audit events (XRPL links)
- `Cascrow Verified` badge: minted as non-transferable NFT on XRPL mainnet (same infrastructure as completion NFTs)
- Badge is downloadable as SVG for use on pitch decks / LinkedIn

**DB Changes:**
```prisma
// Add to User:
publicProfile    Boolean @default(false)
publicUsername   String? @unique
bio              String?
companyWebsite   String?
linkedinUrl      String?
verifiedBadgeNftId String? // XRPL NFT ID for the verified badge
```

**New API Routes:**
- `GET /api/startup/[username]` — public profile data (no auth required)
- `POST /api/startup/badge/mint` — trigger verified badge NFT mint (called automatically after first completion)
- `GET /api/startup/badge/[username]` — badge SVG download

**New Page:** `/startup/[username]` — public profile (no auth, SEO-indexable)

**Effort:** Medium (3 days)

---

### Feature 8 — Mobile-Optimised Proof Upload

**Why:** Startups are on the move. The proof upload flow currently assumes desktop (file picker, PDF drag & drop). On mobile, the experience is poor. Since proof upload is the most frequent startup action, it needs to work seamlessly on iPhone/Android.

**What it does:**
- `/contract/[id]` on mobile: compact milestone cards, large tap targets
- Proof upload: native file picker that opens camera roll or Files app directly
- Camera capture shortcut: "Take a photo of your document" triggers `<input capture="environment">`
- GitHub proof submission: mobile-friendly URL input with clipboard paste button
- Upload progress indicator (currently missing on mobile)
- After upload: large "Submitted — AI is reviewing" confirmation card

**Changes:**
- Refactor `proof-upload.tsx` for mobile: `input type="file" accept="application/pdf,image/*" capture="environment"`
- `contract/[id]/page.tsx`: add `viewport` meta, ensure milestone timeline scrolls properly on small screens
- CSS: replace hover states with active states where appropriate, min touch target 44px
- Test on Safari iOS (WebKit has stricter file input behaviour)

**No DB changes needed.**

**Effort:** Low (1–2 days)

---

### Feature 9 — Regulatory Change Alerts (Enterprise)

**Why:** CSRD/ESRS regulations are actively evolving. A company that set up attestations for ESRS E1 (Climate) last year may find their data sources or goal formulations no longer satisfy the updated standard. cascrow should notify them proactively.

**What it does:**
- Weekly cron monitors EUR-Lex RSS feed and EFRAG (European Financial Reporting Advisory Group) news feed for CSRD/ESRS/GRI updates
- AI classifies each update: which ESRS topic it affects (E1–S4, G1), severity (minor clarification / major change)
- If an enterprise user has active attestations tagged to the affected ESRS topic:
  - Email notification: "ESRS E1 update may affect your Climate attestation — here's what changed"
  - In-app banner in the attestation detail page
- AI generates a 3-bullet "what this means for your attestation" summary

**DB Changes:**
```prisma
model RegulatoryAlert {
  id           String   @id @default(cuid())
  source       String   // "EUR-LEX" | "EFRAG" | "GRI"
  title        String
  url          String
  affectedTags Json     // ["ESRS_E1", "ESRS_S1"]
  severity     String   // "MINOR" | "MAJOR"
  aiSummary    String   @db.Text
  publishedAt  DateTime
  createdAt    DateTime @default(now())

  @@index([publishedAt])
}
```

**New Cron Route:** `/api/cron/regulatory-alerts` — weekly, Monday 08:00 UTC

```typescript
// Pseudocode
fetch EUR-Lex CSRD RSS + EFRAG news RSS
for each new item (not already in DB):
  AI classify: affectedTags, severity, summary
  save RegulatoryAlert
  for each enterprise user with attestation tagged to affectedTags:
    send alert email
    create in-app notification
```

**vercel.json addition:**
```json
{ "path": "/api/cron/regulatory-alerts", "schedule": "0 8 * * 1" }
```

**Effort:** Medium (2–3 days)

---

### Feature 10 — Confidential Attestation Mode

**Why:** Some goals are commercially sensitive. A company might not want competitors to read their revenue targets or expansion plans on-chain. Currently, the full goal description is stored in the public blockchain memo.

**What it does:**
- When creating an attestation, owner can toggle "Confidential mode"
- In confidential mode:
  - Goal title and description are **encrypted** (AES-256-GCM) in the DB, key derived from a company-controlled passphrase
  - On-chain memo contains only the **SHA-256 hash** of the plaintext goal + a timestamp
  - The certificate shows "Verified (Confidential)" — no goal text, just the hash and verdict
  - Authorised auditors can enter the passphrase to decrypt and view the full goal
- Anyone can verify the hash independently: `sha256(goalTitle + goalDescription + salt)` matches on-chain

**Why this is audit-grade:**
The hash was committed to the blockchain *before* verification. After verification, changing the goal text would change its hash and break the on-chain anchor. The commitment is tamper-evident even without revealing the content.

**DB Changes:**
```prisma
// Add to Contract / Milestone:
isConfidential     Boolean @default(false)
encryptedGoal      String? @db.Text  // AES-256-GCM encrypted JSON
goalHash           String?           // sha256(plaintext) — also written on-chain
```

**New Utility:** `src/lib/confidential.ts`
```typescript
function encryptGoal(plaintext: string, passphrase: string): string
function decryptGoal(ciphertext: string, passphrase: string): string
function hashGoal(title: string, description: string, salt: string): string
```

**Modified:** `runner.service.ts` — if `isConfidential`, decrypt goal before passing to AI verifier, do not log plaintext.

**New API Route:**
- `POST /api/enterprise/attestations/[id]/decrypt` — auditor submits passphrase, gets plaintext back (server-side decrypt, never exposes key)

**UI:**
- Attestation creation: toggle "Confidential" → passphrase input field + confirmation
- Certificate page: shows "Confidential — SHA-256: abc123..." with copy button
- Auditor view: "Enter passphrase to reveal goal" input

**Effort:** Medium (3 days)

---

### Feature 11 — Audit Firm Partner Portal

**Why:** Big 4 firms (KPMG, Deloitte, PWC, EY) each have dozens of enterprise clients. Today an auditor would need a separate cascrow account per client. A partner portal lets one auditor login manage all client attestations in one place.

**What it does:**
- New account type: "Auditor Partner" — created on invite by cascrow admin
- Auditor sees a dashboard listing all clients that have granted them access
- Per client: all attestation workspaces in read-only mode, ability to trigger an independent re-run (existing Feature IV from Phase 2)
- Client grants access by entering the auditor's registered email in their settings
- All auditor actions (views, re-runs) are logged to the audit trail
- Auditor can export a client's full attestation history as PDF or CSV

**DB Changes:**
```prisma
model AuditorPartner {
  id        String   @id @default(cuid())
  userId    String   @unique
  firmName  String
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id])
  clients   AuditorClientAccess[]
}

model AuditorClientAccess {
  id          String          @id @default(cuid())
  auditorId   String
  clientId    String          // enterprise user being audited
  grantedAt   DateTime        @default(now())
  revokedAt   DateTime?
  auditor     AuditorPartner  @relation(fields: [auditorId], references: [id])
  client      User            @relation(fields: [clientId], references: [id])

  @@unique([auditorId, clientId])
}
```

**New Pages:**
- `/auditor` — auditor partner dashboard (client list)
- `/auditor/[clientId]` — client's attestation workspace in read-only mode

**New API Routes:**
- `POST /api/enterprise/auditor-access` — grant access to an auditor (by email)
- `DELETE /api/enterprise/auditor-access/[auditorId]` — revoke access
- `GET /api/auditor/clients` — auditor's client list
- `GET /api/auditor/clients/[clientId]/attestations` — read-only attestation data

**Effort:** Medium (3–4 days)

---

## Phase 9 — Monetisation (Requires Registered Company)

> **⚠️ Legal requirement:** All features in this phase involve collecting money from users, processing payments, or pooling third-party funds. Under German law, this requires:
> - At minimum: a registered **Gewerbeanmeldung** (Gewerbe registration) and a business bank account
> - For Fiat Onramp and Investor Syndicate: potentially a **ZAG licence** (Zahlungsdiensteaufsichtsgesetz — Payment Services Act) or partnership with a licensed payment institution
> - For Protocol Fee collection: USt-ID (VAT ID) and proper invoicing
> - For Yield on Escrow: KAGB assessment (Kapitalanlagegesetzbuch — Investment Fund law) to confirm it does not constitute a collective investment scheme
>
> **Do not ship any Phase 9 feature in production before incorporating.** Building and testing in development/staging is fine.

---

### Feature 12 — In-App Billing (Stripe Subscriptions)

**Why:** Without a billing system, cascrow has no revenue. Stripe handles subscriptions, invoicing, and VAT automatically. The product is ready to charge — it just needs the plumbing.

**Proposed pricing tiers:**
| Tier | Price | Limits |
|------|-------|--------|
| Free | €0/month | 2 attestations, 1 team member, no API access |
| Pro | €99/month | 20 attestations, 5 team members, API access |
| Enterprise | €499/month | Unlimited attestations, unlimited members, SSO, multi-entity |
| Escrow | Free to use | 0.5% protocol fee on milestone release (Phase 14) |

**What it does:**
- Plan selection on register / upgrade prompt in dashboard
- Stripe Checkout for new subscriptions
- Stripe Customer Portal for managing/cancelling subscriptions
- Webhooks: `customer.subscription.updated/deleted` → update `User.plan` in DB
- Feature gates: enforce tier limits in API routes (check `user.plan` before creating attestation, adding team member, etc.)
- Invoices available in Settings → Billing

**DB Changes:**
```prisma
// Add to User:
stripeCustomerId     String? @unique
stripePriceId        String?
stripeSubscriptionId String?
plan                 String  @default("free") // "free" | "pro" | "enterprise"
planExpiresAt        DateTime?
```

**New API Routes:**
- `POST /api/billing/checkout` — create Stripe Checkout session
- `POST /api/billing/portal` — create Stripe Customer Portal session
- `POST /api/webhooks/stripe` — handle Stripe webhook events

**Effort:** Medium (3–4 days, plus Stripe onboarding which requires registered company + bank account)

**Requires incorporation:** Yes — Stripe requires a registered business entity for payouts. Test mode works without registration.

---

### Feature 13 — RLUSD Fiat Onramp (MoonPay / Transak)

**Why:** The biggest friction point for new escrow users is acquiring RLUSD. Users must currently navigate to an exchange, buy RLUSD, and transfer it to MetaMask. An in-app onramp (credit card → RLUSD directly into MetaMask) removes this barrier entirely.

**What it does:**
- In the "Fund Escrow" step (currently step 1 of 2), a "Buy RLUSD" button opens an embedded MoonPay or Transak widget
- User enters credit card details, confirms amount, RLUSD arrives in their MetaMask wallet within minutes
- The existing approve → fund flow then proceeds normally

**Approach:**
MoonPay and Transak both support RLUSD (or can be configured for ERC-20 tokens on the XRPL EVM). Both offer an embeddable widget SDK.

Recommended: **Transak** for MVP — lower fees, supports more EVM chains, simpler API key setup.

```typescript
// Transak widget init (client-side)
const transak = new transakSDK({
  apiKey: process.env.NEXT_PUBLIC_TRANSAK_API_KEY,
  environment: 'PRODUCTION',
  cryptoCurrencyCode: 'RLUSD',
  network: 'XRPL_EVM',
  walletAddress: userWalletAddress,
  fiatAmount: milestoneAmountUSD,
  fiatCurrency: 'EUR',
})
transak.init()
```

**UI:** Replace existing `<BuyRlusdModal>` with embedded Transak widget.

**Requires incorporation:** Yes — Transak and MoonPay require KYB (Know Your Business) onboarding with a registered company, business bank account, and AML policy document.

---

### Feature 14 — Protocol Fee (0.5% on Escrow Release)

**Why:** The platform currently releases 100% of escrowed RLUSD to the startup upon verification. A 0.5% protocol fee is the core revenue model for the escrow product. At $1M in monthly volume, this is $5,000/month with zero marginal cost.

**Smart Contract Change:**
`MilestoneFundEscrow.sol` must be updated to deduct 0.5% and send it to a platform treasury address before releasing to the startup.

```solidity
function releaseMilestone(uint256 milestoneId, bytes32 fulfillment) external onlyPlatform {
    Milestone storage m = milestones[milestoneId];
    uint256 fee = m.amount * 50 / 10000; // 0.5%
    uint256 payout = m.amount - fee;
    rlusd.transfer(treasuryAddress, fee);
    rlusd.transfer(m.startup, payout);
    // ...existing logic
}
```

New env var: `EVM_TREASURY_ADDRESS` — the wallet that receives fees.

**Fee display:** Show the fee clearly in the "Fund Escrow" UI: "Cascrow fee: 0.5% (€X) — deducted on release." Transparency required for trust.

**Requires incorporation:** Yes — collecting fees from third parties constitutes commercial revenue. Requires Gewerbe registration, proper invoicing, VAT handling.

**Note:** Smart contract redeploy required. All existing contracts continue to work on the old contract address — only new contracts use the fee-enabled version.

---

### Feature 15 — Investor Syndicate / Co-Invest

**Why:** Large deals (€500k+) are hard to fund alone. Syndicates allow multiple angels to pool capital for one startup deal. Each investor funds their tranche independently; the startup receives the full amount once all tranches are funded.

**What it does:**
- Lead investor creates a syndicate: sets total amount + minimum / maximum tranche per co-investor
- Co-investors join via invite link, each fund their tranche via MetaMask
- Each tranche is a separate EVM escrow entry, but they are logically grouped
- AI verification runs once on behalf of the whole syndicate
- On release: each investor's tranche is released proportionally
- Each co-investor receives their own NFT certificate (with their tranche amount)

**Smart Contract Change:**
Either (a) deploy one `MilestoneFundEscrow` per tranche with a `syndicateId` grouper, or (b) modify the contract to accept multiple funders per milestone. Option (a) is simpler and safer.

**DB Changes:**
```prisma
model Syndicate {
  id           String   @id @default(cuid())
  leadId       String
  contractId   String   @unique
  totalAmount  Float
  minTranche   Float
  maxTranche   Float
  status       String   @default("OPEN") // "OPEN" | "FUNDED" | "COMPLETED"
  createdAt    DateTime @default(now())
  tranches     SyndicateTranche[]
}

model SyndicateTranche {
  id          String    @id @default(cuid())
  syndicateId String
  investorId  String
  amount      Float
  evmTxHash   String?
  status      String    @default("PENDING") // "PENDING" | "FUNDED" | "RELEASED"
  nftId       String?
}
```

**Requires incorporation:** Yes — pooling third-party funds, even via smart contract, may require assessment under the German KAGB (Kapitalanlagegesetzbuch). Legal advice required before launch.

---

### Feature 16 — Yield on Locked Escrow Funds

> **Status:** Not yet feasible. This section documents the design and the conditions under which it becomes buildable.

**The idea:**
While RLUSD is locked in escrow (typically 30–180 days), it sits idle. If that capital could generate yield, it creates a win-win: investor earns a return during the lock-up; startup has a performance incentive (yield goes to startup on completion, back to investor on cancellation).

**Why it's not currently feasible:**

1. **No DeFi on XRPL EVM Testnet.** The escrow runs on XRPL EVM Sidechain (Chain ID 1449000), which is still a testnet. There are no stable, audited yield protocols deployed there (no Aave, no Compound, no Yearn).

2. **No bridging infrastructure.** The RLUSD sits on the EVM sidechain. Routing it to native XRPL (where AMM liquidity exists) and back requires a trustless bridge. No official Ripple bridge exists for this yet.

3. **Regulatory risk.** Pooling user funds and actively generating yield on them is likely to be classified as a collective investment scheme under EU law (AIFMD / German KAGB). This requires a fund manager licence — significantly more complex than a Gewerbe registration.

**How it could work in the future:**

*Prerequisite A — XRPL EVM Mainnet + mature DeFi ecosystem:*
When XRPL EVM launches on mainnet and DeFi protocols are deployed (Aave-style lending, AMM), the escrow contract could automatically deposit RLUSD into a lending pool after `createMilestone` and withdraw before `releaseMilestone`.

```solidity
// Modified createMilestone (future)
function createMilestone(...) external {
    rlusd.transferFrom(investor, address(this), amount);
    rlusd.approve(lendingPool, amount);
    lendingPool.deposit(rlusdAddress, amount, address(this), 0);
    // store aToken balance, not raw RLUSD
}

function releaseMilestone(...) external onlyPlatform {
    uint256 proceeds = lendingPool.withdraw(rlusdAddress, storedAmount, address(this));
    uint256 yield = proceeds - storedAmount;
    uint256 fee = storedAmount * 50 / 10000; // 0.5% protocol fee
    rlusd.transfer(treasuryAddress, fee);
    rlusd.transfer(startup, storedAmount - fee + yield); // startup gets yield on success
    // on cancel: yield stays with investor
}
```

*Prerequisite B — Ripple native yield product:*
Ripple has signalled intent to offer RLUSD yield products. If they provide an API or on-chain interface, the escrow contract could delegate to Ripple's own yield mechanism — the simplest and most compliant path, since Ripple handles the regulatory wrapper.

*Prerequisite C — Legal structure:*
A licensed entity (or partnership with a licensed financial institution) must hold the yield-generating function. The platform cannot do this as a sole trader.

**Realistic timeline:** Not before 2027. Watch for: (1) XRPL EVM Mainnet launch, (2) first RLUSD lending pool deployment, (3) Ripple yield API announcement.

---

## Implementation Order Summary

```
Immediate (no incorporation needed):
  1. Connector Health Monitoring      — 2 days   — prevents failed attestations
  2. Mobile Proof Upload              — 1 day    — quick win, high usage
  3. Contract Templates               — 3 days   — investor time saver
  4. Slack / Teams Integration        — 4 days   — enterprise table stakes
  5. Regulatory Change Alerts         — 3 days   — CSRD market differentiator

Medium-term (no incorporation needed):
  6. SSO / SAML                       — 4 days   — prerequisite for enterprise sales
  7. Multi-Entity / Group Structure   — 7 days   — CSRD group reporting
  8. Deal Room                        — 5 days   — improves investor conversion
  9. Confidential Attestation         — 3 days   — privacy-sensitive enterprise clients
 10. Startup Public Profile + Badge   — 3 days   — drives organic discovery
 11. Audit Firm Partner Portal        — 4 days   — Big 4 channel partnership

After incorporation:
 12. In-App Billing (Stripe)          — 4 days   — core revenue stream
 13. Protocol Fee (0.5%)              — 2 days   — escrow revenue (smart contract redeploy)
 14. RLUSD Fiat Onramp               — 3 days   — removes biggest adoption barrier
 15. Investor Syndicate               — 7 days   — large deal enablement
 16. Yield on Escrow                  — TBD      — not feasible until 2027+
```

---

*Last updated: 2026-04-24*
