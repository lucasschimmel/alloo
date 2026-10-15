# Calls and media

## Scope and ownership

One-to-one audio/video with screen sharing. Convex owns authorization, call records and signaling. WebRTC transports media. XState owns client transitions; one media adapter owns peer connections, tracks, event listeners and output elements.

States: idle -> preparing -> outgoing/incoming ringing -> connecting -> active -> ending -> ended. Failure and cancellation can interrupt any nonterminal state. Reconnection is bounded and explicit. Server states need not mirror every presentation state.

Reserve a call attempt before the first asynchronous operation. Each attempt has a generation/identity; callbacks from an old attempt cannot modify or destroy a new one. getUserMedia cannot be assumed cancellable: late successful streams must be stopped explicitly.

## Server invariants

- Only current authorized conversation members participate; only the invited recipient accepts.
- Atomic availability checks prevent simultaneous live calls across conversations for the same user.
- Ring expiry is scheduled server-side; active calls have a server lease renewed by required participants.
- Baseline timing candidates: 30-second ringing, 15-second heartbeat, 60-second active lease. These are configurable and must be tested against background-tab/mobile throttling before release.
- Terminal transitions are idempotent and create at most one history event.
- Signals have size/count/rate limits, authorized recipients, ordering/dedupe semantics and TTL cleanup.
- TURN credentials are authenticated, short-lived, quota-limited and never logged.
- Multi-tab acceptance has one winning session; losing tabs stop their media immediately.

## Client invariants

Hangup frees microphone/camera/screen tracks synchronously with the local transition, before waiting for network acknowledgement. Server reconciliation is independent. Unmount, logout, permission failure and stale callbacks use the same idempotent teardown.

Use perfect negotiation with serialized signaling and bounded ICE recovery. Deliver remote audio through exactly one output path. Bind video streams on element mount, including camera OFF/ON. Display received screen/video tracks even when the original call was audio-only. Native screen-share termination updates presentation and server state.

Permission prompts have explanation, denial recovery and a cancel path. Autoplay failure requires an explicit resume control. Browser screen/audio capture support varies; do not promise unsupported combinations.

## Transport decision gate

Native WebRTC is the first prototype, not an unconditional commitment. Test two authenticated sessions, real TURN relay-only traffic, network changes, delayed permissions, abrupt closure and mobile backgrounding. If reliable behavior requires disproportionate maintenance, evaluate LiveKit before building the full call UI. Group calls require a separate SFU/media-platform decision; no home-grown SFU.

See T-CALL and T-MEDIA in [quality-and-performance.md](quality-and-performance.md).
