# Messaging expansion contract

Authorized CRAFTS feature work. Baseline f1614cb. Sequential stories share schema and message contracts; no implementation swarm. Existing stack and DA retained.

ASSUMED: search is scoped to the open conversation; author-only edit/delete without time limit while still a member; one attachment up to 10 MiB per message; files are downloaded as opaque binary with no inline preview or antivirus claim. Pending uploads expire after one hour. Deletion erases body and file, leaves a tombstone, and removes pins/reactions. Editing uses revision checks to avoid overwriting concurrent edits. Previously downloaded files cannot be recalled.

| Criterion | Acceptance | Test |
|---|---|---|
| AC-01 | Author can edit text; nonauthors, removed members and system messages denied; stale revisions rejected | T-AC-01 / T-MSG-EDIT |
| AC-02 | Delete removes text/files from timeline, replies, pins, search and downloads; repeat delete safe | T-AC-02 / T-MSG-DELETE |
| AC-03 | Paginated indexed search scoped to membership and personal visibility; reacts to edits | T-AC-03 / T-MSG-SEARCH |
| AC-04 | Authenticated bounded upload, ownership-bound single-use send, retry identity and expired draft rejection | T-AC-04 / T-MSG-FILE |
| AC-05 | Authenticated download denied after hiding, membership loss or message deletion; orphan/group cleanup preserves live files | T-AC-05 / T-MSG-FILE-ACCESS |
| AC-06 | Browser users can attach/download, search, edit and delete through visible controls | T-AC-06 / T-MSG-BROWSER |

Reuse: messages.decorate/hidden and access.member/readableMember own visibility; messageLabel owns previews/quotes; storage maintenance owns orphan expiry; groupLifecycle owns purge; Modal and MessageItem reused. Attachment records separate binary lifecycle from message text. No new dependencies planned.

GAUNTLET strategy: convex-test integration for transactional permissions and revisions, HTTP tests for actual upload/download boundary and quotas, parser/stream limit tests, connected Playwright for user flows, targeted fault injection for authorization and search scope. FABER fresh plan/code review. No real antivirus, network load or production certification claimed.

References checked 2026-10-16: https://docs.convex.dev/search/text-search and https://docs.convex.dev/file-storage/serve-files. Use an indexed conversation filter and authenticated file serving, not permanent storage URLs.

## Retry and privacy refinement

Identical send retries resolve to the original message ID even after edits/deletion, without restoring content; changed payloads conflict. A SHA-256 request fingerprint preserves immutable retry identity. It is internal, excluded from message/pin/search views, and legacy messages acquire it before their first edit/delete. Reply selection and historical anchors subscribe to current visibility instead of retaining snapshots.

## File transport and lifecycle

One file per message, at most 10 MiB, with optional text. Allowed filename extensions: PNG/JPEG/WebP/GIF, PDF, TXT/CSV, ZIP, DOCX/XLSX/PPTX, MP3/MP4/WebM/OGG/WAV. Extension validation is a product allowlist, not proof of actual format or safety. Files are opaque, never decoded or rendered inline, and served as octet-stream attachments with nosniff, sandbox and no-store. No antivirus claim. Avatar decoding remains a separate, stricter pipeline.

Authenticated HTTP upload counts actual streamed bytes and times out after 60 seconds; quota is 20 attempts/account/hour. Membership is rechecked at storage registration. Drafts expire after one hour; the hourly sweep removes expired records and orphan storage while preserving linked files. Send consumes a draft transactionally for its owner and conversation only. Deletion and group purge erase associated storage. Files already downloaded cannot be revoked. Account deletion retains authored messages/files under the existing conversation retention policy; draft access is immediately denied and drafts expire.

Downloads require current membership, a live linked message, and absence of personal hiding. Access is checked before and after storage I/O. Storage URLs are never returned. Download object URLs are released on replacement/unmount.

## Deployment / rollback

Deploy the Convex schema/functions before the frontend. New fields are optional, so existing messages need no bulk rewrite; the search index backfills existing text. The new table, HTTP routes and search index must be ready before the new client is published. Production SITE_URL is the exact allowed browser origin; local loopback origins are permitted only with the existing explicit development-auth flag and local SITE_URL. CONVEX_SITE_URL is supplied by Convex, not a new user secret.

Do not roll the backend back to the pre-attachment storage sweeper: it would regard attachments as orphaned avatars and delete them. A rollback may revert frontend controls while retaining the attachment-aware backend/sweeper and schema. A full backend rollback requires a dedicated data migration/backup plan first.

## Verification outcome — 2026-10-16

- Biome and strict TypeScript pass; Convex code generation/typecheck and client/Workers builds pass. Existing CSS sourcemap warning remains.
- 84 unit/integration tests pass, including authenticated HTTP upload/download, membership loss, personal hiding, expiration, old-file retention and group purge.
- 4 connected Playwright scenarios pass on the freshly built local Workers runtime. The new scenario verifies exact downloaded bytes, mobile layout at 390px, search, remote edit propagation into a selected reply, and remote deletion propagation into an open history modal and search.
- All 17 selected fault injections are detected, including attachment ownership, hidden-file download, edit authorship and conversation search isolation. This is not exhaustive mutation coverage.
- Fresh FABER review found immutable-retry and fingerprint-exposure issues; both are corrected with regressions. Its narrow rereview found no major remaining issue and a keyboard-readiness gap, now guarded in the submit handler too.
- Bun audit reports no known vulnerabilities among 327 packages. No dependencies added. Gitleaks/Semgrep remain unavailable; no full secret-history scan, SAST certification or antivirus test is claimed. Graph extraction uses the grep fallback.

During development, browser runs exposed a pre-request attachment readiness race and one transient signup failure. Readiness is now gated for both button and keyboard submission; the final four-scenario run passed. These observations do not prove all network faults absent.

No remote deployment, real production provider validation, attachment malware scanning, large-history benchmark or physical-device certification performed. Search uses Convex full-text word/prefix matching, not arbitrary substring search or file-content indexing. Downloads already completed cannot be erased remotely.
