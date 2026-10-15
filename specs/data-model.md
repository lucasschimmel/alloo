# Data model and invariants

This is a logical contract. Exact Convex schemas and index definitions must be validated during implementation.

| Entity | Important fields / access pattern | Invariant |
|---|---|---|
| Auth tables | Convex Auth-managed identity/session fields | No bespoke password/session implementation |
| Profiles | user ID, normalized username, display name, bio, avatar reference | Atomic username uniqueness; public projection excludes private identity fields |
| Conversations | kind, canonical DM pair key, title, lifecycle state | One DM per unordered pair; self-DM rejected |
| Memberships | conversation, user, role, joinedAt, read cursor | Unique pair; group retains an admin while active |
| Messages | conversation, sender, server ordering key, client operation ID, kind, body/reply reference | One document per message; dedupe by authenticated sender + operation ID |
| Reactions | message, user, emoji | Unique tuple; capped aggregate and per-user volume |
| Pins | conversation, message, actor | Same authorization policy in display and mutation |
| Hidden messages | user, message | User-specific visibility affects all projections consistently |
| Invites | conversation, random opaque identifier, expiry, revocation | Current membership policy and capacity checked transactionally at join |
| Presence sessions | user, session, heartbeat/expiry | Closing one session does not close the others |
| Calls / participants | conversation, initiator, recipient, state, deadlines, session owner | At most one live call per user; only recipient accepts |
| Signals | call, sender, recipient, sequence, expiry | Participant-only access; bounded size/count and idempotent consumption |
| Upload registry | owner, purpose, backend object ID, status, validated metadata | Client cannot attach arbitrary storage IDs |
| Blocks / reports | actor, target, scoped reason/status | Access-controlled operator workflow; no public report contents |
| Jobs / deletion progress | resource, cursor, status, attempts | Bounded retries and resumable cleanup |

## Index and pagination requirements

Messages: conversation plus stable server order. Memberships: user/conversation and conversation/user. DM lookup: canonical pair. Calls: participant plus active state; never walk historical calls for availability. Invites: opaque lookup. Reactions/hidden records: parent and user-specific access patterns.

Where Convex indexes do not enforce uniqueness automatically, enforce it through transactional lookup and insertion and test concurrent attempts. A schema comment is not a uniqueness guarantee.

Client UUIDs identify retries, not authoritative chronology. Read cursors are monotonic and bounded by messages the server can verify belong to the conversation. Tie-breaking must be deterministic; do not count unread by collecting full histories. Establish capped/displayed unread semantics and account for hidden messages.

## Visibility and lifecycle

All related resources inherit conversation permissions. A quote or pin must not leak a message that its viewer cannot access. A global last-message projection alone cannot satisfy user-specific hiding; derive an authorized visible preview or maintain bounded user-specific projections.

Do not put all messages, membership, signals or reactions into a growing conversation document. Scheduled purge budgets count child writes as well as parents, use cursors, and tolerate retries. Mark deletion state before removing children, deny new writes, then clean derived projections and objects.

Account deletion must define treatment of shared messages, group administration, authored reports, storage, OAuth sessions and retained security records. Retention durations require a published policy before release; no arbitrary indefinite retention by default.
