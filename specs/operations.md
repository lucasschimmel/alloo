# Operations and release gates

## Configuration ownership

Frontend: `VITE_CONVEX_URL` is the public backend URL embedded at build time; `PORT` controls the development port. No server credential belongs in a `VITE_*` variable.

Convex deployment configuration, entered via the provider's protected settings:

| Setting | Purpose |
|---|---|
| `SITE_URL` | Exact public application origin; HTTPS for a hosted release |
| `JWT_PRIVATE_KEY`, `JWKS` | Convex Auth signing material; provision/rotate securely, never paste into chat or terminal transcripts |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | Google OAuth application |
| `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET` | GitHub OAuth application |
| `AUTH_RESEND_KEY`, `AUTH_EMAIL_FROM` | Verified sender and email verification/recovery delivery |
| `TURN_URLS`, `TURN_SHARED_SECRET` | Comma-separated relay URLs and compatible TURN REST shared key; client credentials expire after one hour |
| `ALLOO_OPERATOR_IDS` | Comma-separated Convex user IDs authorized to read/resolve reports |
| `ALLOO_DEV_AUTH` | Explicit localhost-only unverified password mode; disable in hosted deployments |
| `ALLOO_DEV_DIRECT_CALLS` | Explicit localhost-only direct ICE testing; disable in hosted deployments |

Set the OAuth callback to the Convex HTTP site's `/api/auth/callback/google` or `/api/auth/callback/github`, respectively. Keep provider redirect origins aligned with `SITE_URL`. The private app is client-only; do not replace its Convex session with an improvised SSR cookie.

See current primary documentation: [Convex Auth](https://labs.convex.dev/auth), [Start server entry](https://tanstack.com/start/latest/docs/framework/react/guide/server-entry-point), [Start hosting](https://tanstack.com/start/latest/docs/framework/react/guide/hosting).

## Hosting

Cloudflare Workers is the selected hosting target. The pinned Cloudflare Vite plugin and Wrangler build `dist/client` plus `dist/server/wrangler.json`. The custom `src/server.ts` preserves response headers and exposes `/healthz` (frontend liveness only, not backend/provider readiness). Local preview uses workerd; the connected browser suite is tested against that compiled runtime. Invocation logging is disabled to avoid recording private conversation URLs; platform error logs remain enabled.

1. Provision an isolated production Convex deployment and configure its secrets/settings through protected provider controls. Deploy the backend before frontend release checks.
2. Select the HTTPS frontend origin (a workers.dev origin is acceptable), then align Convex `SITE_URL` and provider redirects. No domain has been selected yet.
3. Set build variables `ALLOO_PUBLIC_ORIGIN`, `VITE_CONVEX_URL` and `VITE_SUPPORT_EMAIL`. The latter is intentionally public. Do not place server credentials in frontend build variables.
4. `bun run release:check` validates frontend settings, invokes the CLI-selected production backend's internal `deployment:readiness`, and requires exact backend URL and frontend origin matches. It prints missing setting names only. Configuration presence does not prove provider delivery or successful recovery exercises.
5. `bun run deploy:dry-run` packages the Worker without publishing. `bun run deploy` performs the guarded check, rebuilds and publishes using an authenticated Cloudflare account. Neither a remote deployment nor account setup was performed during this audit.

Dotenv inheritance into Worker bindings is explicitly disabled. Convex local development settings stay separate from Worker runtime configuration. CI builds again after the isolated backend creates its public URL, then runs the compiled Worker browser contracts. Restart preview after rebuilding.

Before launch: isolated staging Convex deployment, separate OAuth applications, HTTPS frontend, real email/TURN providers, operators, final privacy/support text, rate/cost monitoring and tested rollback. No deployment was performed by this rebuild.

## Data lifecycle

Avatars: authenticate and reserve quota before decoding; store sanitized pixels; commit profile pointer and remove old object; compensate failed commits. Hourly reconciliation deletes unreferenced objects older than one hour. Storage is currently avatar-only: revise reconciliation before introducing other stored file types.

Presence is a lease, not a durable availability promise. Calls expire on the server, independently of browser timers. Signaling is removed at termination. Deletion immediately tombstones the profile, then batches membership succession, session/refresh cleanup and provider-account/code removal. Messages remain with an anonymized author. Blocks, reports, reactions, hidden-message rows and other operational records can retain pseudonymous IDs; define and implement their retention/export requirements before a public release.

Email issuance uses per-address digest and global quotas before OTP replacement. Verified password login is independent of delivery quotas. Digest counters are purged after a day. The global cap limits spend but may temporarily suspend email issuance under abuse; monitor it before enabling public registration.

## Required release exercises

1. Real Google/GitHub sign-in, signup verification, expired/replayed OTP, password recovery and old-session revocation.
2. Audio/video across different networks using TURN; deny/cancel permissions, switch devices, stop screen sharing natively, close/crash tabs, simultaneous answering, reconnect and mobile foreground/background.
3. Backup/export to a protected location and restore into an isolated deployment. Record schema version, application revision, recovery duration and verification results. Never test a restore on the active deployment.
4. Deploy the previous frontend revision against a compatible schema. Schema changes must use expand/migrate/contract, with rollback compatibility verified before contraction.
5. Browser accessibility and performance checks on target devices; install checks on Android/iOS. Set measurable latency/error/connection success budgets from observed baselines.

## Incident handling

Stop new affected operations through deployment configuration, preserve a minimal redacted timeline, rotate exposed keys at the provider, revoke affected sessions and re-run relevant tests. Never record message bodies, auth material, SDP or ICE payloads in monitoring. Local setup material exposed during this implementation was immediately replaced; it was confined to the anonymous local test backend.

## Bounded abuse policy

Groups remain capped at 100 members. Each account can store up to 200 blocks. Group membership checks read at most 201 block rows per participant (20,100 at the group cap), keeping index ranges and documents below Convex transaction limits. Oversized legacy lists fail closed; unblock remains available subject to the ordinary operation rate limit. Increasing this cap requires a different indexed representation and a revised transaction budget.
