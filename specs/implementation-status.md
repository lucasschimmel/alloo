# Implementation and evidence — 2026-10-15

This document records the implemented state. Other specification files remain the target contract; a passing subset does not certify every original acceptance criterion.

## Feature traceability

| Contract | Implementation / evidence | Remaining validation or scope difference |
|---|---|---|
| F01 / T-AUTH | Convex Auth; real signup, refresh and logout browser flow; anonymous mutation denial | Google/GitHub credentials and real redirects; expiry/account-switch stress |
| F02 / T-PROFILE | Onboarding; unique username; private authenticated avatar delivery; real image upload browser test; decoder rejection tests | OAuth photo fallback intentionally omitted; uploaded images are normalized to PNG |
| F03 / T-DM | Prefix discovery; canonical DM pair and self-DM tests | Discovery searches username prefixes, not every profile field |
| F04 / T-GROUP | Create, rename, promote/demote/remove/leave; administrator succession tested | Adding through invitations; structured membership system events not implemented |
| F05 / T-INVITE | Expiring rotating links, QR; revocation domain test and real join browser flow | Real OAuth continuation awaits configured providers |
| F06 / T-MESSAGE | Reactive persisted messages, stable operation IDs, retry collision test; two real accounts exchange messages | Pending state is the send control, not an optimistic bubble; no persistent offline outbox |
| F07 / T-ANCHOR | Replies and indexed pins; authorized anchor query resolves old targets in a modal | Deep history scroll/performance campaign pending |
| F08 / T-REACTION | Allowlist, per-person/total limits and toggle tests; realtime reaction browser test | Load testing at configured caps pending |
| F09 / T-VISIBILITY | Per-user filtering across messages, quote previews, pins, sidebar/unread; tested isolation | Sidebar examines the latest 100 messages; hiding all yields an empty preview, not a full-history scan |
| F10 / T-READ | Visible-tab/bottom-aware client cursor and monotonic backend test | Browser focus race / long-list audit pending |
| F11 / T-PRESENCE | Per-session heartbeat, client-time expiry, periodic cleanup | Dedicated multi-tab expiry browser test pending |
| F12 / T-CALL | XState, native WebRTC, session ownership, server leases, one terminal history event; real two-browser video test | Real TURN, restricted networks, mobile devices and reconnect campaign pending |
| F13 / T-MEDIA | Device toggles, audio-call screen sender, native-stop callback, single screen-picker guard, late-media cleanup tests | Screen picker and native stop not browser-certified yet |
| F14 / T-TRANSLATE | Optional on-device English-to-French translation, original retained and explicit failure | Requires a compatible installed browser model; language selection deferred |
| F15 / T-UI | French, responsive, semantic theme tokens, accessible dialogs, reduced motion; desktop/mobile captures | System preference sampled on load; theme toggle is light/dark; full accessibility audit pending |
| F16 / T-PUBLIC | SSR landing, privacy/support, manifest and SVG/192/512 icons; public browser contract | Actual installation on Safari/Android pending; no service worker/offline claim |
| F17 / T-RECOVERY | Email verification/reset UI, 15-minute OTPs, neutral reset response, issuance quotas before replacement; quota tests | Real Resend delivery, replay/expiry integration and production sender needed |
| F18 / T-ABUSE | Blocking gates DM/calls/invites; report capture; allowlisted operator queue; access tests | Configure actual operators and response process before public launch |
| F19 / T-ACCOUNT | Profile/authored-message export; delete confirmation, tombstone, bounded membership/session/login-account cleanup; tested access revocation | Export is not a complete legal data-access package; no recent-session reauthentication; residual pseudonymous operational rows and retained messages require explicit retention policy |
| F20 / T-OPS | Runbook, CI definition, defensive response headers and generic errors | No remote hosting deployment, CI-host run, recovery drill, telemetry/SLOs or final legal/contact policy |
| F21–F24 | Explicitly deferred | Attachments/search/edit-for-all, offline queue/push, group calls/native/E2EE/passkeys |

## Executed checks

- Biome recommended rules and formatting: passed with no warnings at the final code gate.
- Strict TypeScript and production client/server build: passed.
- Vitest / convex-test: 22 tests passed (domain authorization/lifecycle, uploads, late media acquisition).
- Playwright: three suites passed against the compiled frontend with the real anonymous local Convex backend: public/responsive, group/invite/avatar, account/message/reaction/video/logout.
- Four selected fault injections were killed: disabled block check, disabled call-session ownership, duplicate terminal call event, and allowed self-DM. This is targeted fault injection, **not** a full mutation score.
- Dependency audit: no known vulnerabilities reported by Bun at execution. This is a database snapshot, not proof of absence.
- FABER independent review found and drove fixes for losing-tab hangup, late heartbeat failure, overlapping screen pickers and email issuance abuse. The targeted re-review passed.

Gitleaks, Semgrep and Knip were unavailable/not run; no full-history secret scan, exhaustive dead-code analysis, full mutation campaign or production pentest is claimed. Generated code and browser artifacts are excluded from lint; accessibility motion overrides carry narrowly scoped comments. React StrictMode remains enabled and the call actor is recreated per effect lifetime.

## Implementation decisions

Native forms are sufficient for the present forms; TanStack Form/Zod are not installed merely to match a proposed list. React Compiler remains deferred until its current Vite integration is separately verified. Base UI, Lucide, XState and Virtual each serve a concrete responsibility. No alternative auth system, duplicate cache, Astro app, workspace orchestration or analytics package was added.

Avatar decoding uses bounded pure-JavaScript PNG/JPEG decoders in a Convex Node action because the native Sharp package did not load in the local Convex analysis runtime. The browser accepts JPEG/PNG/WebP, resizes to 256px and sends PNG; the server independently decodes/re-encodes, strips metadata and rejects excessive bytes/dimensions. An hourly storage reconciliation removes unreferenced avatar objects older than one hour.

Build snapshot: main client entry approximately 107 kB gzip; private app chunk approximately 85 kB gzip; CSS approximately 6.3 kB gzip. These are artifact sizes, not LCP/INP or a comparison proving Start faster than Next.js. Release requires actual performance measurements on target devices.
