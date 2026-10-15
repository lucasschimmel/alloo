# Features and acceptance contracts

V1 status is based on source inspection and the previous audit, not a production verification. The implemented V2 and its remaining gaps are tracked in [implementation-status.md](implementation-status.md).

| ID | Capability | V1 evidence | V2 phase / contract | Planned test |
|---|---|---|---|---|
| F01 | Password, Google, GitHub authentication | Implemented; real OAuth unverified | Core: login, logout, expiry, refresh and account switch; no private cache leakage | T-AUTH |
| F02 | Profile onboarding, username, bio, avatar | Present; avatar policy incomplete | Core: server validation, uniqueness, safe photo replacement and OAuth fallback | T-PROFILE |
| F03 | User discovery and DM creation | Present; self-DM defect | Core: bounded discovery, canonical pair uniqueness, reject self-DM | T-DM |
| F04 | Group creation and administration | Present, up to 100 members | Core: roles, rename, add/remove, leave, last-admin succession; retain cap as configurable baseline | T-GROUP |
| F05 | Invitations and QR | Present | Core: expiry, revocation/rotation, join idempotency, resume after authentication | T-INVITE |
| F06 | Realtime text and paginated history | Present | Core: stable ordering, idempotent sends, explicit pending/failed state | T-MESSAGE |
| F07 | Replies and pinned messages | Present; old targets fail | Core: resolve/load target outside viewport or show explicit unavailable state | T-ANCHOR |
| F08 | Reactions | Present; accumulated volume unbounded | Core: allowlisted representation, per-user and total caps, atomic toggles | T-REACTION |
| F09 | Delete for me | Present; preview mismatch | Core: hide across timeline, sidebar, unread, pins and quote previews for that user | T-VISIBILITY |
| F10 | Read receipts | Present; marks hidden messages read | Core: monotonic cursor for visible messages in a visible active conversation | T-READ |
| F11 | Typing and presence | Present; expiration/multitab defects | Core: per-session leases and expiration without another message; one hidden tab cannot mark all sessions offline | T-PRESENCE |
| F12 | Audio/video 1:1 and call history | Partial reliability | Core: server expiration, one live call per user, immediate local hangup | T-CALL |
| F13 | Screen sharing and device toggles | Present with UI/state defects | Core: audio-call sharing visible; native stop reflected; camera remount works | T-MEDIA |
| F14 | On-device translation | Capability-dependent | Parity enhancement: retain original text, clear unavailable/error state; no silent server fallback | T-TRANSLATE |
| F15 | French UI, themes, responsive layout | Present | Core: system/light/dark preference, keyboard access, mobile safe areas | T-UI |
| F16 | Landing and PWA identity | Present; manifest only | Core: honest feature copy, valid manifest/icons and platform-specific install check | T-PUBLIC |
| F17 | Email verification and recovery | Missing configured flows | Before public release: delivery, expiry, replay prevention and neutral account-discovery responses | T-RECOVERY |
| F18 | Block and report | Missing | Before public release: block new DM/call/invite attempts; explicit shared-group behavior and actionable operator queue | T-ABUSE |
| F19 | Account export/deletion and sessions | Missing | Before public release: reauthentication where appropriate, revocation, bounded deletion, export access control | T-ACCOUNT |
| F20 | Privacy, retention, support and operations | Missing/incomplete | Before public release: policy matches actual processing and tested restore/rollback | T-OPS |
| F21 | Attachments and message search | Missing | Later: approved limits, private media delivery and access-filtered search | T-FUTURE |
| F22 | Editing and deletion for everyone | Missing | Later: decide time window, tombstones, quote/search/update semantics | T-FUTURE |
| F23 | Persistent drafts, offline outbox, push/mute | Missing | Later: account isolation, idempotency, consent, cache cleanup and notification privacy | T-OFFLINE |
| F24 | Group calls, native apps, E2EE, phone/passkeys/2FA | Missing | Deferred; require separate product and architecture decisions | T-FUTURE |

## Behavioral details

Sending a message must not destroy a newer draft if an earlier submission fails. Pending text and the current editor buffer are separate values. The server acknowledges persisted messages; a client optimistic insertion is never labelled delivered before acknowledgement.

Conversation membership is checked for every action, including fetching an anchor, reading a quote, file delivery and signaling. A removed member loses future access immediately. Historical visibility for rejoining members must be explicitly tested; baseline grants the existing group history to current members, unless the product changes that policy before implementation.

DM participants may manage pins equally; group pin management belongs to admins in the baseline. UI permissions derive from the same server policy. Group membership changes appear as structured system events, not stored French sentences.

Block baseline: prevent new direct messages, calls and invitations from the blocked actor. Existing shared-group membership is retained; shared-group content remains visible and reportable. The block UI must explain this limitation. Reporting requires a defined operator process before enabling a public report button.

Deferred functionality must not be advertised as available or implemented through misleading disabled buttons.

