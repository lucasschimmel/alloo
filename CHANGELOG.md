# Changelog

## 2.0.0 — Unreleased

- Add authenticated message attachments, conversation-scoped indexed search, author edits with revision checks and delete-for-all with file erasure.
- Keep replies/history reactive, preserve retry identity after edits/deletion and extend storage reconciliation to retained attachments.

- Rebuild the V1 Next.js workspace as one TanStack Start application with Convex Auth.
- Implement profiles, private/group conversations, invitations, realtime messaging and native WebRTC calls.
- Add server authorization, bounded operations, safe image decoding, session-owned calls, abuse controls and account cleanup.
- Add domain/browser verification, targeted critical fault injections, a CI workflow and configuration/release documentation.
- Preserve V1 in the external backup described in `specs/rebuild-and-recovery.md`.

This is a locally verified implementation, not a public production release. See `specs/implementation-status.md` for acceptance gaps and external-service gates.
