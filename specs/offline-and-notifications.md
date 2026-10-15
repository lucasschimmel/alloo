# Offline and notifications

## Increment 1: installable identity

Ship a valid manifest, suitable raster/maskable icons, HTTPS and platform-tested launch behavior. A service worker is not a universal requirement for installation. Installation does not imply offline messages, background calls or push.

## Increment 2: shell and drafts

Add a service worker only after Start/Cloudflare deployment tests. Cache versioned public assets; exclude auth callbacks, private API responses and private media. Define update prompts, activation compatibility and old-cache cleanup. Do not force-reload an active call or unsent composer.

Persist drafts only in account-scoped storage with a defined logout/deletion policy. IndexedDB is persistence, not an encryption boundary. Shared-device behavior must be visible to users.

## Increment 3: durable outbox

Each message has a client operation ID scoped to sender; server mutation is idempotent. Suggested states: queued, sending, acknowledged, failed, canceled. IDs need not be UUIDv7; client time is never authoritative order.

Define reconciliation after reload, exponential bounded retry, duplicate tab ownership, edits to unsent messages and failures after membership revocation. Expired auth pauses sends; switching accounts cannot send the previous user's queue. Attachments need coordinated upload state. Do not assume background sync is supported or guaranteed.

## Increment 4: push and mute

Request notification permission after an explicit user action. Store device subscriptions with ownership/revocation, remove expired endpoints and isolate account changes. Default payloads reveal no message body. Conversation mute, deduplication, click routing and foreground suppression are required.

Web Push needs backend dispatch, service worker handling and platform-specific testing. Notification delivery is best-effort; it is not guaranteed incoming-call wakeup on mobile. Badging is optional enhancement. No call reliability claim may depend on a suspended browser staying active.

All four increments have independent acceptance gates. Only increment 1 is core parity; later increments require explicit scheduling.
