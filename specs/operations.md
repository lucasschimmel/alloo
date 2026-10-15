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

`bun run build` produces `dist/client` and the server entry. `bun run preview` is a local verification server, not the production hosting decision. Cloudflare Workers remains the candidate from the original specification; add its supported adapter and execute a real runtime smoke test before adoption. Do not serve only the client assets and assume public SSR/server behavior survived.

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
