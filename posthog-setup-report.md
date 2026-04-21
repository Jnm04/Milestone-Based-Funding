<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into the Cascrow project. The integration covers both client-side and server-side tracking across the full user lifecycle — from signup through contract creation, escrow funding, proof submission, AI verification, and funds release.

**Changes made:**

- `instrumentation-client.ts` (new) — PostHog client-side initialization using the Next.js 15.3+ pattern with EU host, reverse proxy, exception capture, and debug mode in development.
- `src/lib/posthog-server.ts` (new) — Singleton server-side PostHog client (`posthog-node`) used by all API routes.
- `next.config.ts` — Added `/ingest/*` reverse proxy rewrites (EU assets + events), `skipTrailingSlashRedirect: true`, and `connect-src` CSP entries for `eu.i.posthog.com` and `eu-assets.i.posthog.com`.
- `src/app/login/page.tsx` — `posthog.identify(userId, { role })` + `user_logged_in` capture on successful sign-in.
- `src/app/register/page.tsx` — `posthog.identify(userId, { role })` + `user_signed_up` capture on successful registration.
- `src/app/api/auth/register/route.ts` — Server-side `user_registered` event.
- `src/app/api/contracts/route.ts` — Server-side `contract_created` event with milestone count and total amount.
- `src/app/api/contracts/join/route.ts` — Server-side `contract_joined` event.
- `src/app/api/escrow/confirm/route.ts` — Server-side `escrow_funded` event with amount and tx hash.
- `src/app/api/proof/upload/route.ts` — Server-side `proof_submitted` event with file category and extraction status.
- `src/app/api/verify/route.ts` — Server-side `milestone_verified` and `milestone_rejected` events with AI confidence score.
- `src/app/api/escrow/finish/route.ts` — Server-side `funds_released` event with amount and tx hash.

| Event | Description | File |
|---|---|---|
| `user_signed_up` | User completed registration form (client-side) | `src/app/register/page.tsx` |
| `user_logged_in` | User signed in — triggers identify() (client-side) | `src/app/login/page.tsx` |
| `user_registered` | New user account created in DB (server-side) | `src/app/api/auth/register/route.ts` |
| `contract_created` | Investor created a new milestone contract | `src/app/api/contracts/route.ts` |
| `contract_joined` | Startup accepted a contract via invite code | `src/app/api/contracts/join/route.ts` |
| `escrow_funded` | Escrow funding confirmed on-chain — key conversion | `src/app/api/escrow/confirm/route.ts` |
| `proof_submitted` | Startup uploaded a milestone completion proof | `src/app/api/proof/upload/route.ts` |
| `milestone_verified` | AI majority-voted YES on the proof | `src/app/api/verify/route.ts` |
| `milestone_rejected` | AI majority-voted NO on the proof | `src/app/api/verify/route.ts` |
| `funds_released` | RLUSD funds released to startup wallet | `src/app/api/escrow/finish/route.ts` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- **Dashboard — Analytics basics**: https://eu.posthog.com/project/163737/dashboard/635208
- **New signups over time**: https://eu.posthog.com/project/163737/insights/tNiFySbZ
- **Contract creation to escrow funding funnel**: https://eu.posthog.com/project/163737/insights/qEuMIOUy
- **Milestone outcome breakdown**: https://eu.posthog.com/project/163737/insights/qlMcq7qg
- **Proof submission to funds released funnel**: https://eu.posthog.com/project/163737/insights/8M6pbOtz
- **Weekly active users**: https://eu.posthog.com/project/163737/insights/DXyjuhog

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
