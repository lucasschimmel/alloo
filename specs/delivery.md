# Delivery plan

## Ordered milestones

| Milestone | Deliverable | Exit gate |
|---|---|---|
| M0 | Review specifications and privacy boundaries | Convex Auth and preserved DA locked; E2EE/private-media assumptions recorded |
| M1 | Minimal Start + Convex Auth + deployment prototype | Password/OAuth, direct private URL, refresh/logout/account switch, actual target runtime smoke test |
| M2 | Design primitives and timeline prototype | Visual review, keyboard support, 10k-message anchor/virtualization test and baseline metrics |
| M3 | Call transport/ownership prototype | Delayed permissions, offline hangup, lease expiry, TURN-only and two-device proof; decide native vs LiveKit |
| M4 | Profiles, owned avatars, DM/groups and invites | Permission/quota/concurrency tests and connected onboarding/join flow |
| M5 | Complete messaging parity | Replies/pins/reactions/hiding/read/presence and failure handling verified together |
| M6 | Production call UI and progressive enhancements | Actor/media contract integrated; responsive states and browser fallbacks verified |
| M7 | Public-release hardening | Recovery, block/report, export/deletion, policies, monitoring, deployment/restore/rollback |
| M8 | Optional increments | Attachments/search, outbox/push or mobile only through separately reviewed scope |

Prototype code is retained only if it meets the production boundaries. Do not rebuild all screens before proving auth, timeline and call integration.

## Environment and deployment

Use distinct development, CI/preview and production Convex environments. Preview clients must never write production data. Configure provider callback allowlists and environment variables for each target; keep secrets outside Git and keep client-exposed variables explicitly public.

Cloudflare Workers is a candidate, not a deployment already configured. Confirm rendering, assets, direct links, auth callbacks and security headers in workerd. Do not assume Bun or Node-only image processing is available there; choose a supported processing environment.

Frontend and backend releases need compatible contracts. Prefer additive schema changes before removing fields; document migration and rollback. Do not reset a remote Convex deployment because the local repository was reset.

## Operating readiness

- Filtered error reporting, structured failure categories and alert ownership.
- Metrics for auth errors, failed sends, call connection success, TURN traffic, storage growth and rejected uploads.
- Cost model using expected active users, message reads/writes/subscriptions, media sizes, retention and TURN minutes. No claim of near-zero hosting cost.
- Backup/export policy and restoration rehearsal into an isolated environment; frontend rollback alone does not roll back data.
- Incident and support contact, report handling, retention/deletion policy and documented release checklist.

Do not add product analytics merely to measure technical reliability. Separate necessary operational telemetry from user behavior tracking.
