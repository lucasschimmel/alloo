# Final V2 audit — 2026-10-16

Baseline d81cd5b. Scope: audit current V2, correct confirmed defects, test regressions and list concrete launch requirements. Cloudflare Workers remains the selected host. The owner has not selected a domain; Ship Labs supports maintenance, which does not establish the legal publisher identity. No production deployment or secrets inspection was performed.

## Verdict

The application is suitable for controlled staging validation after the code fixes below. Public production is not signed off: local configuration intentionally fails the release gate, real providers/devices and recovery have not been certified, and public support/privacy information remains unfinished. Passing tests are evidence for covered behavior, not a proof that no defects remain.

## Confirmed and corrected findings

| Finding | Before | Correction and evidence |
|---|---|---|
| FINAL-REPLY (major) | Deleting/hiding a selected reply removed its visual strip but left the durable reply ID. The next send failed permanently and blocked later FIFO sends. | Clear only after an authoritative unavailable/deleted query result, preserving valid drafts while loading. Expanded T-MSG-BROWSER failed against baseline and passes after correction. |
| FINAL-DELETE (major) | Deletion before onboarding created no tombstone. A caller could immediately create a profile while asynchronous cleanup ran. | Insert a deleted profile even when onboarding never completed. T-FINAL-DELETE first reproduced successful recreation, then verifies ACCOUNT_DELETED. |
| FINAL-BUDGET (major) | Thirty sidebar conversations each read 100 full messages. Valid 4,000-character CJK bodies alone could total 36 MB, above the documented 16 MiB transaction limit. | Eight memberships per page with maximumRowsRead, including reactive endCursor expansion. Preserve the 100-message visibility window. T-FINAL-BUDGET paginates all 17 populated histories without gaps and bounds body bytes below 12 MiB/page. This is a deterministic query-budget regression, not a production load benchmark. |
| FINAL-LOCAL (privacy/lifecycle) | Remote account deletion unmounted the workspace without erasing that device's saved drafts/outbox. | Deleted-profile state clears the matching local owner. A late cleanup cannot erase another account or disable its push binding. Matching old notifications are closed. Unit ownership regression and separate-browser deletion test. |
| FINAL-REACTIVE (reliability) | Mounted push/call/operator queries could throw after account deletion before their UI unmounted. | Reactive reads return empty/null for deleted identities while mutations still reject. T-FINAL-REACTIVE covers settings/call reads; browser deletion runs with account settings open. |

## Audit coverage

| Area | Reviewed/verified | Remaining limitation |
|---|---|---|
| Architecture and maintainability | Feature modules, shared policies, generated Convex API, single reactive server cache; uploads/outbox/push separated | Large UI coordinators and test suite files remain; no unnecessary rewrite undertaken |
| Auth and permissions | Actor/member/admin checks, deleted-account behavior, expected-account sends, operator allowlist, session ownership | Real OAuth redirects, verified email/reset delivery and cross-device expiry need staging |
| Messaging and files | Send idempotency after edit/delete, private downloads, byte caps, quotas, hidden messages, search, reply cleanup, attachment expiry | Download-only files, no antivirus or previews; not end-to-end encrypted |
| Offline/push | Durable drafts/outbox, owner generation, leases, bounded retry/FIFO, worker binding/dedup, late cleanup | Open-app reconnect only; no offline shell; live push remains mocked in tests |
| Calls | Ownership, timeout/reconnect, signaling cleanup, synthetic real WebRTC browser regressions | Physical devices, TURN-only networks, mobile suspension and screen-picker behavior remain unverified |
| Data lifecycle | Account tombstones, bounded cleanup, group purge, linked-file retention, upload grace period | Full personal-data export/retention policy remains incomplete; backup restore not rehearsed |
| UI | Existing desktop/mobile browser scenarios, navigation, settings, messaging and account deletion | Chromium emulation is not Safari/iPhone testing; full accessibility and field performance are not certified |
| Deployment/operations | Built Worker, dry-run packaging, health endpoint, release checks, CI definition | Remote CI execution, real deployment, alerts and recovery exercise not demonstrated |
| Dependencies/security | Bun advisory audit; source signature/sink checks; adversarial authorization review | Gitleaks/Semgrep unavailable; no full-history secret scan or exhaustive penetration test |

## Required production work, in order

1. **Provision the actual environments.** Separate staging and production Convex deployments and an authenticated Cloudflare Workers project. Choose the public HTTPS origin; a workers.dev address is sufficient, so a custom domain is not a prerequisite.
2. **Align public configuration.** Set ALLOO_PUBLIC_ORIGIN and VITE_CONVEX_URL at build time, VITE_SUPPORT_EMAIL to a monitored inbox, and Convex SITE_URL to the exact frontend origin. The release guard compares both frontend/backend identities. Configure Convex Auth signing material (JWT_PRIVATE_KEY/JWKS) using the provider setup; never expose it in frontend variables.
3. **Configure and exercise authentication/email.** AUTH_RESEND_KEY, AUTH_EMAIL_FROM with a verified sender; Google/GitHub OAuth IDs and secrets plus correct callback origins. The current release guard requires both providers. Verify signup, email verification, expired/replayed codes, password reset, logout and revoked sessions with real providers.
4. **Configure and exercise calls.** TURN_URLS and TURN_SHARED_SECRET for the implemented ephemeral TURN credentials. Test audio/video between physical devices on different networks, relay-only conditions, permission denial, disconnect/reconnect and mobile backgrounding.
5. **Configure and exercise push.** VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and a valid VAPID_SUBJECT contact. Test explicit enable/disable, mute, duplicates, read/deleted/blocked messages, logout/account change and click routing. Test Chromium/Firefox/Safari and installed iOS support. Key presence alone is not delivery proof.
6. **Disable test bypasses.** ALLOO_DEV_AUTH and ALLOO_DEV_DIRECT_CALLS must not be true in production.
7. **Provide public operating information.** Decide the actual publisher, support contact, retention/deletion rules and treatment of retained message/report/reaction records. Replace development privacy text. The current profile/authored-message export is not a complete personal-data export package. Choose operator account IDs (ALLOO_OPERATOR_IDS) and an abuse-response process.
8. **Prove operations.** Configure monitoring and actionable alerts for Worker/backend failures, email/push failures, TURN and spend. Rehearse backup restore in isolation and frontend/backend rollback. Record deployed revision, recovery results and ownership.
9. **Run the release acceptance matrix.** Execute CI on the remote host, staging browser/device/accessibility checks and a measured history/load test. Then run release:check, build and deploy; do not bypass a failing gate.

## Configuration actually observed

The local readiness endpoint reports backend http://127.0.0.1:3210 and SITE_URL http://127.0.0.1:3000. Missing local provider settings: Resend key/from, Google/GitHub IDs and secrets, TURN URLs/shared secret, operator IDs and all three VAPID settings. Both development bypass flags are enabled locally. Auth signing material is present (values were not read).

The release command fails before querying a production deployment: ALLOO_PUBLIC_ORIGIN, a production VITE_CONVEX_URL and VITE_SUPPORT_EMAIL are absent/invalid in the calling release environment. This proves the current setup is not release-configured; it does not claim access to, or knowledge of, a separate remote production account.

## Product limits that are not launch bugs

Group calls, native apps, E2EE and passkeys/2FA remain separate product work. Drafts/outbox are device-local and may be evicted by the browser; automatic sending requires an open authenticated app. One attachment per message, up to 10 MiB, with no malware scanning. Sidebar unread/preview derives from the latest 100 messages. These limits must be communicated accurately; none is silently claimed as implemented.

## Evidence and sources

Executed on 2026-10-16 against the final code:

- Biome lint/format and strict TypeScript: passed.
- Vitest/convex-test: 111 tests across 16 files passed.
- Playwright: all six connected scenarios passed against compiled local Workers and the real isolated Convex backend; includes synthetic WebRTC audio/video, files, offline replay and remote deletion with settings open. Mobile messaging capture inspected without overflow.
- Selected fault injection: all 24 faults detected, with a passing baseline. One earlier baseline attempt failed without retained diagnostic output; the same isolated fixture passed on inspection (111 tests), and the complete serial rerun passed. Its original cause is not established.
- Production build and Wrangler deployment dry-run: passed. No remote deployment performed.
- Bun dependency audit: no known vulnerabilities reported across 345 packages; no dependency added.
- Fresh FABER re-review: all five corrective criteria passed with no remaining confirmed finding in that scope.
- Release readiness: intentionally blocked by missing/invalid public origin, production backend URL and support email. Provider/device/recovery gates above remain open.

Traceability: FINAL-REPLY → T-MSG-BROWSER in tests/e2e/app.spec.ts; FINAL-DELETE/BUDGET/REACTIVE → matching T-FINAL tests in convex/production.test.ts; FINAL-LOCAL → src/features/offline/offline.test.ts and the remote-deletion E2E. These IDs were checked directly against executed tests; the stock trace-spec script only recognizes numeric AC IDs and was not used to claim coverage for these finding IDs.

 Production build retains the existing CSS-plugin sourcemap warning; runtime tests pass independently of that debugging-artifact warning.

- [Convex transaction limits](https://docs.convex.dev/production/state/limits), checked 2026-10-16.
- [Convex pagination](https://docs.convex.dev/database/pagination), including read limits on reactive pagination.
- Local source, regression tests, build output and readiness response; no secret values collected.
