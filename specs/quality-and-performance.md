# Quality and performance

## Planned acceptance tests

The matrix below is the target acceptance contract. Consult [implementation status](implementation-status.md) and the [latest audit](final-v2-audit.md) for executed coverage and outstanding checks; not every criterion is fully certified. T-FUTURE is a deferred-scope gate, not a passing placeholder.

| ID | Required behavior and evidence |
|---|---|
| T-AUTH | Real password/OAuth integration, refresh/deep link/invite continuation, expiry, logout/account switch without cross-user data |
| T-PROFILE | Concurrent username uniqueness; anonymous/forged/oversized/corrupt image denied; owner isolation, failed publish and old-file cleanup |
| T-DM | Concurrent creation yields one canonical pair; self-DM and forbidden discovery rejected |
| T-GROUP | Role matrix, capacity boundary, last-admin leave/remove, concurrent membership edits |
| T-INVITE | Expired/revoked/rotated link denied, repeat join harmless, login continuation works |
| T-MESSAGE | Two users exchange ordered messages, retry dedupes, failed send preserves newer draft, removed member denied |
| T-ANCHOR | Load a reply/pin outside the current page; inaccessible/deleted/hidden target does not leak |
| T-REACTION | Concurrent toggle, unique representation, per-user and total bounds |
| T-VISIBILITY | Hidden message absent from timeline, preview, unread, quote and pin projections for that user |
| T-READ | Hidden tab and older-history viewport do not advance read cursor; stale updates cannot move cursor backward |
| T-PRESENCE | Expiry with no new traffic, crash recovery, two tabs with one hidden/closed |
| T-CALL | Fake-clock server expiry/lease, unauthorized accept, busy peer, simultaneous start, two-tab answer, one terminal history event |
| T-MEDIA | Deferred media after cancel, double start, immediate offline hangup, single audio output, camera remount, audio-call screen share, native stop |
| T-TRANSLATE | Supported/unsupported API, download/failure state, original retained, no unintended server request |
| T-UI | Keyboard/focus/screen-reader checks, measured contrast, reduced motion, 320px and desktop, light/dark, theme reload |
| T-PUBLIC | Real built public routes, metadata, legal/support links, manifest/icons, no claims for deferred features |
| T-RECOVERY | Email verification and reset expire, resist replay and avoid account enumeration |
| T-ABUSE | Block policy enforced server-side, quota races, report privacy and operator access |
| T-ACCOUNT | Revocation and cache cleanup, authorized export, bounded idempotent deletion and admin succession |
| T-OPS | Production-runtime smoke test, alert path, rollback and isolated backup restore rehearsal |
| T-OFFLINE | When scheduled: reload/retry dedupe, account isolation, revoked membership, worker updates and private-cache exclusion |
| T-FUTURE | Deferred features require their own reviewed criteria before implementation |

## Test layers

Pure policies and state transitions: Vitest, with property-based tests for ordering/dedupe where useful. Convex transactions/permissions/jobs: convex-test including adversarial inputs and concurrency. Browser resource ownership: Testing Library and controlled media promises. Connected flows: Playwright with separate authenticated contexts and a real isolated Convex backend.

Mocked media tests verify orchestration, not actual transport. Add real two-device audio/video, TURN-only, packet loss/network change and iPhone Safari checks. Chromium mobile emulation is not an iPhone test. Run Chromium, Firefox and WebKit automated coverage where supported; document capability-specific exclusions.

## Performance evidence

Before claiming improvement, record hardware, browser, connection, dataset and production build. Measure cold/warm build and HMR, compressed per-route JS/CSS, first usable conversation, send acknowledgement p50/p95, query/subscription counts, memory, scroll stability and call setup success/latency.

Timeline gate: synthetic history of 10,000 variable-height messages, bounded loaded pages and bounded mounted DOM, prepend with stable anchor, late image sizing, reactions and distant target navigation. This is a test scenario, not a capacity guarantee.

Provisional public-page targets: LCP <= 2.5s, INP <= 200ms, CLS <= 0.1 at the 75th percentile when field data exists; prelaunch lab runs use documented mobile/network profiles and are not field percentiles. Set realistic bundle and chat/call latency budgets after the first measured prototype; block unexplained regressions against that baseline.

## Gates

CI: frozen install, formatting/lint, generated API consistency, strict types, unit/integration tests, production build, connected E2E and dependency/secret checks. Critical auth/upload/call invariants need negative tests; aggregate coverage cannot substitute for them. Use targeted mutation tests to check that removing a guard fails its tests.

The branch now contains a runnable application and unit/integration/browser suites. Their passing results do not replace the remaining provider, device, performance and operational release gates.
