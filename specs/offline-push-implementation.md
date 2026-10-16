# Durable messaging and push contract

Baseline b46de62. Authorized CRAFTS feature work; existing stack/DA retained. Sequential implementation because auth lifetimes, composer and storage contracts overlap. GAUNTLET defines behavioral tests; FABER reviews independently.

ASSUMED: drafts and outbox are device-local, not cross-device sync; TTL 7 days, at most 100 drafts/100 queued messages and 50 MiB queued attachments. Draft text/reply persist; attachments persist once queued. Outbox drains only in an open authenticated application, including other conversations; no background credentials or offline private-history cache. Explicit logout/account deletion clears local data and disables this browser's push. Membership revocation yields a permanent visible failure, never endless retries. A confirmed in-flight server commit cannot be recalled by local cancellation.

Push is opt-in, generic by default (no text/author/file name), conversation-mutable, message-deduplicated, best-effort. Delivery rechecks membership, deletion, hiding, blocks and read state. Only known browser push service hosts are eligible; no arbitrary endpoint fetches. Expired endpoints are pruned; transient failures have bounded retries. No mobile call wakeup guarantee. Service worker has no private API caching and never persists auth credentials.

| Criterion | Acceptance | Test |
|---|---|---|
| AC-01 | Draft restores after navigation/reload, account-scoped and cleared on logout; failures surfaced | T-AC-01 T-OFF-DRAFT |
| AC-02 | Durable outbox persists before clearing composer; bounded storage; original operation ID survives retry/ack loss | T-AC-02 T-OFF-QUEUE |
| AC-03 | Multi-tab claims, backoff, permission failures and account switch cannot duplicate or cross-send | T-AC-03 T-OFF-LIFETIME |
| AC-04 | Explicit push subscription ownership, endpoint validation, mute/unsubscribe and account revocation | T-AC-04 T-PUSH-ACCESS |
| AC-05 | Generic delivery, dedup, current eligibility, bounded retries and 404/410 pruning | T-AC-05 T-PUSH-DELIVERY |
| AC-06 | Worker drops wrong-account notifications, suppresses focused conversation and routes clicks safely | T-AC-06 T-PUSH-WORKER |
| AC-07 | Real browser draft reload, offline file/text queue, reconnect delivery and logout cleanup | T-AC-07 T-OFF-BROWSER |

Reuse: messages.send plus immutable messageFingerprint for retries; membership/access helpers and existing storage upload/download; Workspace owns authenticated lifetime; MessageComposer exposes draft/outbox state. Browser persistence, drain runner and push transport separated for deterministic tests. No second server-state cache.

Validation: native IndexedDB behavior with fake-indexeddb, storage/runner tests with delayed acknowledgements and account changes, convex-test authorization/delivery tests, VM worker tests, connected Playwright with network loss. Provider transport tests are mocks until VAPID/real endpoint configuration; do not claim live delivery.


## Reconciliation and review decisions

Persist the complete request, including uploaded attachment ID, before sending. Resolve the server receipt before considering upload expiry: never retry an acknowledged original operation with a new attachment identity. Queue requests use an immutable auth snapshot, bounded HTTP timeout and server-side expected-account check.

Local transactions verify owner plus generation. Logout invalidates that generation and clears data before browser unsubscribe. Canceling a claim cannot recreate it through a late success/failure; other entries remain drainable. Per-conversation FIFO blocks later sends behind unresolved earlier ones. Removal of an active send is disabled; a committed message cannot be recalled by clearing local data.

Push retries reuse the browser endpoint after partial activation. The durable worker binding checks the current local account generation; activation checks that binding, not just the browser subscription. Recheck before display and close newly displayed notifications if logout completes during display. Dedup survives worker restarts, bounded to 2,000 IDs/one day; later duplicates may appear.

Security: native audit reports no dependency vulnerabilities. New licenses: idb ISC, web-push MPL-2.0 (unmodified library), fake-indexeddb Apache-2.0, @types/web-push MIT. Preserve notices when distributing software. Gitleaks/Semgrep unavailable: signature/sink scans and manual authorization review are degraded checks, not full SAST or pentest certification. No production deployment, real VAPID delivery or physical mobile certification performed.


## Verification

- 107 Vitest/convex-test tests pass, including 23 new offline/push tests.
- All five connected Playwright scenarios pass on the compiled local Cloudflare Worker, with synthetic audio/video enabled. Seven acceptance criteria traced to tests. Browser coverage verifies draft reload, offline file/text queue, tab closure/reopen, a single delivery, worker registration and logout deletion.
- Biome, strict TypeScript, Convex code generation and production Cloudflare build pass.
- All 21 selected injected critical faults are detected (four new account/push boundaries); this is scoped mutation testing, not whole-repository mutation coverage.
- FABER independently reviewed the plan and code, then rechecked the three final lifecycle fixes: no remaining confirmed major in that reviewed scope.
- Bun audit: no vulnerabilities across 345 packages. Signature scan found no secret signatures. The sink scan matched only the safe emoji regular-expression exec call.
- Known tooling limitation: the existing CSS plugin emits a sourcemap warning during production build. No remote deployment performed.
