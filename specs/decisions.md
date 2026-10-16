# Decisions and proposal review

## Locked by user

1. Create a fresh rebuild branch and remove the old implementation from its working tree.
2. Preserve Alloo's identity and existing functional intent.
3. Use TanStack Start for the rebuild.
4. Retain Convex Auth for simplicity. The supplied Better Auth recommendation does not supersede this decision.

## Review of the supplied Sonnet proposal

| Proposal | Disposition | Rationale |
|---|---|---|
| Start + Vite, private SPA routes | Selected | Fits browser-first Convex Auth; public rendering remains useful |
| Separate landing | Selected (updated 2026-10-16) | User requested apps/landing ownership; two Start apps share Bun workspaces and UI foundations, without Astro |
| TS 7 everywhere | Candidate | A version mismatch does not prove Next caused it; verify the complete toolchain first |
| Better Auth, phone OTP/passkeys/2FA | Not selected | Conflicts with retained Convex Auth; phone identity is not a confirmed product need |
| R2 for all files | Deferred evaluation | Useful for media economics; adds lifecycle/privacy/integration work; Convex Storage is adequate for initial avatars |
| Fontsource/self-hosted fonts and variants | Selected principle | Replace Next facilities explicitly; package/provider chosen at implementation |
| ThumbHash | Optional | Presentation enhancement, not a reliability prerequisite |
| Motion rename gives smaller bundle | Unproven | Measure actual imported code and lazy boundaries |
| Custom theme initialization | Selected principle | Validate preference, CSP and hydration; no dependency removal solely because of its name |
| SW needed for installation | Corrected | Installability and service workers are separate; offline/push still require real implementations |
| Offline outbox + UUIDv7 | Deferred | Idempotent server operations required now; durable queue later; UUID version is not a delivery guarantee |
| Cloudflare TURN | Candidate provider | Compare actual relay reliability, quotas and cost; no provider purchase/configuration assumed |
| LiveKit for groups | Future option | Also a fallback if native 1:1 fails the reliability gate |
| Convex components for every job | Selective | Integrate only needed components and test guarantees; V1 already had some rate limiting |
| Zustand + Query everywhere | Not selected | Single call actor and single server-state authority reduce competing state owners |
| Server translation fallback | Deferred | Requires privacy disclosure, user intent and cost controls |
| Lefthook | Candidate | CI remains the release authority; hook speed is secondary |
| Capacitor / Expo | Deferred | Native push/calls/background behavior requires a separate app strategy, not a free wrapper |
| E2EE via libsignal/MLS | Product gate, not installed | Not a drop-in security layer; keys, devices, recovery and server features change fundamentally |
| Sentry + PostHog | Filtered errors only by default | No silent analytics/replay; operational latency metrics are possible without content tracking |
| Keep Turbo automatically | Not selected for one app | Add orchestration only when there are independent packages/builds |
| Migrate route by route | Superseded | User explicitly requested a clean rebuild with recoverable V1 reference |

## Defaults and unresolved choices

The specs are executable planning defaults, not proof that every proposal was user-approved.

- **Default:** access-controlled, non-E2EE messaging for initial parity. **Gate:** confirm before message storage if encrypted messaging is required at launch.
- **Default:** private uploaded media. **Gate:** decide whether avatars may be public before CDN/cache publication.
- **Default:** current group members can read group history; shared-group content remains visible after blocking. **Gate:** review before membership/block implementation.
- **Candidate:** Cloudflare deployment, TURN provider, image decoder runtime and error service. **Gate:** M1/M3 and upload prototype.
- **Unresolved:** production retention durations, operational budget, support owner and acceptable call SLOs. **Gate:** public release.
- **Deferred:** remote translation, native mobile, E2EE, phone credentials, group calls, attachments/search, durable offline and push. Schedule explicitly; do not install their dependencies now.

Record future changes as dated decisions with consequences and affected test IDs. No major decision should be inferred from a package install.
