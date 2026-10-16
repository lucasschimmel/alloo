# Production audit — 2026-10-16

Baseline: 51269f5. Authorized scope: full V2 audit, priority corrections and tests; Cloudflare Workers selected by the owner. No remote deployment was performed. Implementation is sequential because schema, authorization and UI contracts overlap. FABER performs a fresh read-only review.

## Contract and strategy

| ID | Acceptance | Evidence |
|---|---|---|
| PROD-UPLOAD | Malformed/duplicate PNG headers and oversized decompression fail before decoder allocation | T-PROD-UPLOAD |
| PROD-BLOCK | New group membership respects blocks between every participant | T-PROD-BLOCK |
| PROD-SESSION | Public call views never expose tab ownership identifiers | T-PROD-SESSION |
| PROD-RETRY | Idempotency includes reply identity | T-PROD-RETRY |
| PROD-CALL | An accepted call cannot heartbeat indefinitely without media/SDP | T-PROD-CALL |
| PROD-WORKER | SSR and private flows run in the Workers runtime, with reproducible packaging | Production build, Wrangler dry run, connected Playwright |

GAUNTLET strategy: reproduce server defects with convex-test and parser defects with small adversarial fixtures; use fake clocks for call deadlines. Reuse access helpers, endCall, existing sanitizer and browser scenarios. Maintain the full regression suite. Targeted fault injection is evidence for selected boundaries, not a whole-repository mutation score.

## Corrected findings

- Confirmed blocker: pngjs accepted a second IHDR after the application checked only the first; interlaced decoding had an unbounded inflate path. Strict chunk preflight and bounded decompression now precede decoding; browser-normalized non-interlaced images remain supported.
- Confirmed major: initial group creation did not check blocks between invitees.
- Confirmed ownership gap: call views leaked the identifiers used for per-tab ownership. Participant authentication still applied; this was not a cross-account access bypass.
- Confirmed correctness gap: retrying a message with a different reply silently returned the previous message.
- Confirmed lifecycle gap: accepted calls receiving no SDP could keep their lease indefinitely.
- Refuted candidate: message-anchor lookup on removal is an imperative query with an error handler, not a crashing reactive subscription; preserved its authorization behavior.

## External release requirements

The owner confirms maintenance supported by Ship Labs, but no domain or support address yet. Do not invent legal publisher identity, retention policy or contact information. A workers.dev HTTPS origin can be chosen later; it must match Convex SITE_URL and OAuth redirects.

Production Convex, email sender, OAuth applications, TURN, operator IDs, backup/restore drill and cross-network/device checks remain external release gates. Local tests cannot certify them.

- Account deletion ends live calls immediately and clears sidebar access before scheduled cleanup; blocking ends live calls and acceptance rechecks blocking (T-PROD-DELETE / T-PROD-BLOCK).
- Caller ownership is enforced during ringing, not only after acceptance (T-PROD-SESSION).
- Release configuration is tied to the exact Convex deployment embedded in the frontend (T-PROD-RELEASE).
- Group checks use one bounded index range per participant. New explicit operational limit: 200 blocks/account; oversized legacy histories fail closed, and removals remain available subject to the normal rate limit. A 100-member group is covered by an integration test. This preserves a <=20,100 block-document scan budget below the [Convex transaction limits](https://docs.convex.dev/production/state/limits).

## Audit coverage and limitations

Reviewed authentication/configuration, authorization, group admission, messaging/idempotency, uploads/decoder allocation, account revocation, calls/signaling, external email/TURN boundaries, public routes/headers, runtime packaging and CI. Existing tests retain recovery issuance, moderation, avatar isolation, call lease, translation cleanup and navigation coverage.

This is a source audit plus local executable verification, not an exhaustive penetration test or production certification. Gitleaks and Semgrep are unavailable; no complete secret-history/SAST scan is claimed. No remote CI run, real OAuth/email/TURN delivery, backup restore, load campaign, full accessibility audit or legal compliance certification was performed. Stored-message/operational-record retention, broader personal-data export and recent-session reauthentication remain explicit release-policy work rather than silently claimed features.

The existing CSP provides framing/object/base restrictions; it is not a nonce-based strict script CSP. Performance artifact sizes and successful local tests are not production LCP/INP measurements.

## Final verification and release verdict

- `bun run verify`: Biome, strict TypeScript, 69 tests across 10 files, and the client/Worker production build passed.
- Connected Playwright against the freshly built local Workers runtime: 3 scenarios passed, including real local Convex accounts, uploads, group membership and browser audio/video calls with synthetic devices.
- Targeted fault injection: all 13 selected faults killed; no full mutation-coverage claim.
- `wrangler deploy --dry-run`: packaging passed; approximately 351.84 KiB gzip Worker upload and 18 client assets. No remote upload.
- `bun audit`: 327 packages checked, no known vulnerabilities reported at execution.
- CycloneDX production SBOM: 113 components, generated from an isolated frozen-lockfile install. The original node_modules tree contained extraneous packages, so it was not used as the SBOM source. Local artifact: `.claude/crafts/alloo-production/sbom.cdx.json`; no license-compliance certification implied.
- Fresh FABER review drove parser, group-policy, transaction-budget and deployment-binding corrections; the scoped re-review passed.

The build still emits a CSS sourcemap warning from Vite; production packaging and browser execution passed. Remote CI and production performance remain unverified.

**Verdict:** confirmed technical blockers identified in this audit are corrected and covered by regression tests. Public launch is still conditional on the external release requirements and unresolved data-retention/account-policy decisions above. Configuration presence checks do not replace real provider and recovery tests.

## Sources

- [Cloudflare TanStack Start integration](https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/) checked 2026-10-16.
- Installed pngjs parser and synchronous inflate implementation inspected directly; safe bounded reproduction confirmed duplicate-header behavior.

