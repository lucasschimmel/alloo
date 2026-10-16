# Implementation and evidence — 2026-10-16

This document records the implemented state. Other specification files remain the target contract; a passing subset does not certify every original acceptance criterion.

## Feature traceability

| Contract | Implementation / evidence | Remaining validation or scope difference |
|---|---|---|
| F01 / T-AUTH | Convex Auth; real signup, refresh and logout browser flow; anonymous mutation denial | Google/GitHub credentials and real redirects; expiry/account-switch stress |
| F02 / T-PROFILE | Onboarding; unique username; private authenticated avatar delivery; real image upload browser test; decoder rejection tests | OAuth photo fallback restored with HTTPS provider allowlist and no-referrer; real provider redirects still require credentials |
| F03 / T-DM | Prefix discovery; canonical DM pair and self-DM tests | Discovery searches username prefixes, not every profile field |
| F04 / T-GROUP | Create, rename, direct add, promote/demote/remove/leave; structured events; last-member closure and bounded purge | Real browser exclusion and re-add tested; tests cover account-cleanup interleaving and other-member blocks |
| F05 / T-INVITE | Expiring rotating links, QR, explicit revoke/copy; existing link survives reopening; real join browser flow | Real OAuth continuation awaits configured providers |
| F06 / T-MESSAGE | Reactive persisted messages, stable operation IDs, retry collision test; two real accounts exchange messages | Pending state is the send control, not an optimistic bubble; no persistent offline outbox |
| F07 / T-ANCHOR | Replies and indexed pins; authorized anchor query resolves old targets in a modal | Deep history scroll/performance campaign pending |
| F08 / T-REACTION | Unicode-validated emoji picker, custom single emoji, per-person/total caps; real browser reaction test | Load testing at configured caps pending |
| F09 / T-VISIBILITY | Per-user filtering across messages, quote previews, pins, sidebar/unread; tested isolation | Sidebar examines the latest 100 messages; hiding all yields an empty preview, not a full-history scan |
| F10 / T-READ | Visible-tab/bottom-aware client cursor and monotonic backend test | Browser focus race / long-list audit pending |
| F11 / T-PRESENCE | Per-session heartbeat, client-time expiry, periodic cleanup and persisted last-seen display | Dedicated multi-tab expiry browser test pending |
| F12 / T-CALL | XState, native WebRTC, session ownership, server leases, typed call history/duration, identity and ringing; real audio/video browser tests | Reconnect/ICE restart deadline covered with fake-clock peer tests; physical networks, TURN and mobile devices remain unverified |
| F13 / T-MEDIA | Device toggles, audio-call screen sender, native-stop callback, single screen-picker guard, late-media cleanup tests | Screen picker and native stop not browser-certified yet |
| F14 / T-TRANSLATE | Optional source-language detection → browser language; original retained, cancellation and model cleanup tested | Requires compatible installed browser models; mocks validate integration, not translation quality |
| F15 / T-UI | French, responsive, semantic theme tokens, accessible dialogs, reduced motion; desktop/mobile captures | Live system/light/dark selection tested; full accessibility audit pending |
| F16 / T-PUBLIC | SSR landing, privacy/support, manifest and SVG/192/512 icons; public browser contract | Actual installation on Safari/Android pending; no service worker/offline claim |
| F17 / T-RECOVERY | Email verification/reset UI, 15-minute OTPs, neutral reset response, issuance quotas before replacement; quota tests | Real Resend delivery, replay/expiry integration and production sender needed |
| F18 / T-ABUSE | Blocking gates DM/calls/invites; report capture; allowlisted operator queue; access tests | Configure actual operators and response process before public launch |
| F19 / T-ACCOUNT | Profile/authored-message export; delete confirmation, tombstone, bounded membership/session/login-account cleanup; tested access revocation | Export is not a complete legal data-access package; no recent-session reauthentication; residual pseudonymous operational rows and retained messages require explicit retention policy |
| F20 / T-OPS | Runbook, CI definition, defensive response headers and generic errors | No remote hosting deployment, CI-host run, recovery drill, telemetry/SLOs or final legal/contact policy |
| F21–F24 | Explicitly deferred | Attachments/search/edit-for-all, offline queue/push, group calls/native/E2EE/passkeys |

## Executed checks

- Biome recommended rules and formatting: passed with no warnings at the final code gate.
- Strict TypeScript and production client/server build: passed.
- Vitest / convex-test: 53 tests passed (authorization/lifecycle, uploads, late media acquisition, parity, provider-avatar policy, translation and reconnect).
- Playwright: three scenarios passed twice consecutively (six executions) against the compiled frontend with the real anonymous local Convex backend: public/responsive, group/invite/avatar/exclusion/re-add, account/message/reaction/copy/profile/navigation/theme/audio/video/ringing/logout. Web Audio creation and teardown are instrumented; physical speaker output is not certified.
- Nine selected fault injections were killed (including group cleanup, pre-cleanup invite revival, ignored media disconnect and hardcoded translation and a transport-held SDP collision lock): disabled block check, disabled call-session ownership, duplicate terminal call event, and allowed self-DM. This is targeted fault injection, **not** a full mutation score.
- Dependency audit: no known vulnerabilities reported by Bun at execution. This is a database snapshot, not proof of absence.
- FABER independent review found and drove fixes for losing-tab hangup, late heartbeat failure, overlapping screen pickers and email issuance abuse. The targeted re-review passed. Parity review additionally found cross-member block bypass, a deleted-last-member invitation race and missing account-deletion group events; all were fixed and tested.

Gitleaks, Semgrep and Knip were unavailable/not run; no full-history secret scan, exhaustive dead-code analysis, full mutation campaign or production pentest is claimed. Generated code and browser artifacts are excluded from lint; accessibility motion overrides carry narrowly scoped comments. React StrictMode remains enabled and the call actor is recreated per effect lifetime.

## Implementation decisions

Native forms are sufficient for the present forms; TanStack Form/Zod are not installed merely to match a proposed list. React Compiler remains deferred until its current Vite integration is separately verified. Base UI, Lucide, XState and Virtual each serve a concrete responsibility. No alternative auth system, duplicate cache, Astro app, workspace orchestration or analytics package was added.

Avatar decoding uses bounded pure-JavaScript PNG/JPEG decoders in a Convex Node action because the native Sharp package did not load in the local Convex analysis runtime. The browser accepts JPEG/PNG/WebP, resizes to 256px and sends PNG; the server independently decodes/re-encodes, strips metadata and rejects excessive bytes/dimensions. An hourly storage reconciliation removes unreferenced avatar objects older than one hour.

Build snapshot after parity restoration: main client entry approximately 87 kB gzip plus a shared router chunk around 24 kB; private app chunk approximately 92 kB gzip; CSS approximately 6.7 kB gzip. These are artifact sizes, not LCP/INP or a comparison proving Start faster than Next.js. Release requires actual performance measurements on target devices.

## Parity restoration

See [the acceptance contract](parity-restoration.md). Conversation selection now uses typed router search state (`/app?conversation=...`) with refresh/back/forward support and graceful invalid/revoked targets. Message tools include copy, emoji reactions, composer emoji insertion, growing input/counter, profile dialogs, calendar separators and author grouping.

The preview server must be restarted after a production rebuild: its loaded SSR manifest otherwise references obsolete asset hashes. One browser run caught this stale-process condition (404 scripts); all three suites passed after restart.

Emoji validation uses the pinned MIT-licensed `emoji-regex` package rather than the newer native `v` regex flag, preserving compatibility with the project's ES2022 target. No authentication or cache replacement was introduced.

Call negotiation now releases its SDP collision lock before transport acknowledgement, waits for local media before answering, and bounds stalled negotiation after receiving SDP. Deterministic tests cover delayed acknowledgements and microphone acquisition; they do not certify every network ordering or bound an unanswered browser permission prompt.
