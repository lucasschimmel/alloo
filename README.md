# Alloo V2

A quiet, French-first messenger rebuilt with TanStack Start, React and Convex Auth.

## Run locally

Requires Bun 1.4.2 and Node.js 24 or newer. Install the pinned dependencies:

```sh
bun install --frozen-lockfile
```

Start an **isolated anonymous local Convex backend** and keep it running. PowerShell:

```powershell
$env:CONVEX_AGENT_MODE = 'anonymous'
bunx convex dev --typecheck disable --tail-logs disable
```

After Convex has created the local deployment configuration, open another terminal:

```powershell
$env:CONVEX_AGENT_MODE = 'anonymous'
bun scripts/setup-local-auth.ts
bunx convex env set ALLOO_DEV_DIRECT_CALLS true
bun run dev
```

Open **http://127.0.0.1:3000**. Create an account with a password of at least 12 characters, then choose a unique username. Use two browser profiles to try messages and calls. The local auth script rotates local signing keys and invalidates existing local sessions; run it at initial setup or deliberate rotation, not on every restart. It refuses non-local deployments and never prints key values.

The CLI writes ignored local configuration. Do not copy V1 environment files or point this rebuild at the V1 production deployment. The development flags only apply with a loopback `SITE_URL`. Direct local calls use host ICE candidates and are **not** a substitute for TURN on the internet.

## Available

- Email/password account, onboarding, profile editing and validated avatar replacement.
- User discovery, private conversations, groups, direct member addition, membership events and reusable invitation links/QR codes.
- Reactive messages, paginated virtual history, replies, pins, reactions, hide-for-me and read receipts.
- Session-based presence and typing; live system/light/dark themes and responsive layouts.
- Audio/video calls, microphone/camera toggles, screen-sharing control, server expiration and call history.
- Blocking, reports, restricted operator queue, profile/message export and account anonymization/access revocation.
- Public landing, privacy/support pages and install manifest/icons. Opt-in Web Push; no offline application cache.

Google/GitHub and email verification/recovery are configured integrations: buttons appear only when configured. Translation uses the browser's on-device Translator capability and clearly reports unsupported browsers. See [implementation status](specs/implementation-status.md) for verified coverage and limitations.

## Commands

| Command | Purpose |
|---|---|
| `bun run dev` | Development frontend, port 3000 or `PORT` |
| `bun run convex` | Backend watcher using the selected deployment |
| `bun run verify` | Biome, TypeScript, domain tests and production build |
| `bun run test:e2e` | Public browser contract; connected scenarios require flags below |
| `bun scripts/check-critical-mutations.ts` | Twenty-four selected security/lifecycle fault injections |
| `bun run build` / `bun run preview` | Compile / locally preview production output |
| `bun audit` | Dependency vulnerability database check |

Connected browser tests create disposable accounts in the selected backend. Use **only** the isolated local backend:

```powershell
bunx playwright install chromium
$env:E2E_CONNECTED = '1'
$env:E2E_MEDIA = '1'
bun run test:e2e
```

Restart the preview process after each rebuild to reload its SSR asset manifest. For the compiled frontend, start `bun run preview --port 4173` and set `E2E_BASE_URL=http://127.0.0.1:4173`. Chromium uses synthetic camera/microphone devices while real WebRTC transports media between independent browser contexts. This does not certify physical devices or cross-network TURN.

## Structure

`src/routes` owns public routing and the client-only private entry; `src/features` owns auth, conversations, messages, profile and calls. `src/components/ui` contains shared accessible primitives. `convex` owns authorization, transactions, realtime queries, actions and scheduled cleanup. `shared` holds limits and image decoding. `specs` contains the product contracts, decisions and release gates.

Native Convex subscriptions are the single server-state cache. There is no extra REST backend, session store or duplicated message store. Public pages render on the server; authenticated data stays out of SSR.

## Before public release

Follow [operations](specs/operations.md). Cloudflare Workers is configured and locally tested. Configure production OAuth/email/TURN, choose the public origin, define the operator/contact and retention policy, and test restore and browser/device compatibility. `bun run deploy:dry-run` checks packaging; `bun run deploy` enforces `release:check` before publishing. This repository is a working local V2; it is not a production deployment or an end-to-end encryption implementation.

The previous code and local settings are preserved outside the repository; see [V1 recovery](specs/rebuild-and-recovery.md).

See [the latest V2 audit](specs/final-v2-audit.md) for confirmed findings, corrections and remaining external launch gates. Blocking is capped at 200 people per account to preserve bounded group admission checks.

### Expanded messaging

Private attachments (one file/message, up to 10 MiB), paginated text search within a conversation, author editing and delete-for-all are implemented. Files require authentication on every download and are never served by a permanent public URL. See [messaging expansion](specs/messaging-expansion.md) for supported extensions, expiry, quotas and deployment order. Files are download-only and are not antivirus-scanned.


### Durable drafts, outbox and notifications

Drafts persist on the current device. The outbox includes attachments, resumes while Alloo is open and connected, and protects retries against duplicates/account changes. Logout clears local drafts and pending sends. See [offline/push](specs/offline-push-implementation.md).

Web Push is opt-in in account settings; each conversation can be muted. Notifications hide contents and sender names. Configure the three VAPID settings in Convex before activation; the release guard checks their presence. Real provider/mobile validation remains required. The worker does not cache private history or provide an offline application shell.
