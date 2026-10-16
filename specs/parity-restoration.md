# V1 parity restoration contract

Scope: restore the audited V1 capabilities while preserving V2 authorization, upload validation, idempotency and bounded operations. User authorized implementation, tests and routine design decisions. No new stack or production deployment.

Execution is sequential: group lifecycle/access → messaging/navigation → call lifecycle → independent review. Shared schema and frontend types prevent independent implementation swarms.

| Contract | Acceptance / failure behavior | Tests |
|---|---|---|
| AC-01 Groups | Empty groups cannot be resurrected; bounded cleanup removes history and invitations, including account deletion | T-AC-01 / T-GROUP-CLOSE |
| AC-02 Revocation | Removed members receive no private data and return to the inbox without a global error | T-AC-02 / T-ACCESS-LOSS |
| AC-03 Membership | Admins can add existing people, within caps and blocking rules; changes create structured events | T-AC-03 / T-GROUP-ADD |
| AC-04 Invitations | Reopening preserves the current link; renewal/revocation is explicit and admin-only | T-AC-04 / T-INVITE-REUSE |
| AC-05 Navigation | Conversation URLs survive refresh, browser back/forward and authentication; invalid IDs fail gracefully | T-AC-05 / T-NAVIGATION |
| AC-06 Messages | Emoji selection, copy, date separators, author grouping and last-seen are restored | T-AC-06 / T-MESSAGE-PARITY |
| AC-07 Translation | Detect source and use browser language; keep original; report unsupported/uncertain/same-language cases; release resources | T-AC-07 / T-TRANSLATE |
| AC-08 Calls | Disconnection triggers reconnect state and bounded failure; recovery cancels timeout; teardown cancels callbacks | T-AC-08 / T-RECONNECT |
| AC-09 Call presentation | Caller identity, ringing sound, duration and structured history distinguish canceled/declined/missed/completed | T-AC-09 / T-CALL-PARITY |
| AC-10 OAuth avatars | Valid provider photo fallback; private uploaded images win; deleted profiles reveal no photo | T-AC-10 / T-PROFILE-FALLBACK |
| AC-11 Themes and profiles | Live system mode, explicit override, message-author profile modal | T-AC-11 / T-UI |

Assumptions: new members can read existing group history, as in V1. Existing production configuration gates remain. Modern browser translation remains capability-dependent, with no server fallback. Performance superiority requires measurement, not a framework claim.

Reuse map: access.ts owns membership checks; conversations.ts owns group mutations; messages.ts owns visibility; ConversationInfo reuses profile search/Avatar/Modal; Workspace owns route selection; Peer owns media resources; endCall owns terminal history. New helpers are extracted only for shared behavior or deterministic boundary tests.

Test strategy (GAUNTLET): convex-test integration tests for authorization/lifecycle; Vitest fake clocks for reconnect and model cleanup; real local-backend Playwright for exclusion, link reuse, membership, navigation, reactions/copy and calls. Mocked AI APIs only certify integration, not model quality. Preserve the existing suite. Add targeted fault injections; do not advertise them as full mutation coverage.

API references checked 2026-10-15: [TanStack search state](https://tanstack.com/router/latest/docs/guide/search-params), [Chrome language detection](https://developer.chrome.com/docs/ai/language-detection), [Chrome translation](https://developer.chrome.com/docs/ai/translator-api).

## Verification outcome

Implementation restored the audited regression set plus the OAuth-avatar fallback, profile dialogs and composer sizing/counter found in the additional V1 source pass. No claim of universal superiority or production-network certification is made. The 53 unit/integration tests and three connected browser scenarios pass; nine selected injected faults were detected.

Independent review findings were fixed: other-member blocking during direct addition, last-member deletion before asynchronous cleanup, and structured events during account cleanup. Remaining release limitations are tracked in implementation-status.md.

A final consecutive-call check exposed intermittent connection setup. The peer negotiation lock was narrowed to local SDP creation, incoming offers now await local media, and prior-call queues are detached on teardown. A deterministic regression test fails when the old transport-held lock is restored. Reference: [WebRTC perfect negotiation](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Perfect_negotiation).
