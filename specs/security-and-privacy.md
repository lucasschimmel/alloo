# Security and privacy

## Trust model

The browser, route guards, upload metadata, IDs and user-supplied timestamps are untrusted. Convex derives the actor from the authenticated session and checks membership/role for every read and mutation. Public responses must not expose email, provider identifiers or session fields through profile decoration.

Require transactional quotas for expensive operations: account/discovery abuse, DM/group creation, invites, sends, reactions, typing, calls, signals, TURN issuance and uploads. Quotas and payload limits live in named configuration with explicit tests. Turnstile is optional additional friction, not authorization.

## Upload contract

1. Authenticate, verify purpose and reserve quota in a transaction.
2. Create an owner-bound pending upload record with an expiry.
3. Receive through a size-bounded server path or a constrained direct-upload path.
4. Verify actual object size and allowed MIME; inspect signature and perform real image decoding in a compatible runtime. Limit dimensions/pixel count and strip unnecessary metadata when re-encoding.
5. Publish only validated variants. Bind the file to its owner and intended entity transactionally.
6. Delete replaced objects and reconcile abandoned/failed uploads through bounded jobs.

Initial avatars: JPEG/PNG/WebP, maximum input 5 MiB (preserved baseline; configurable). SVG and arbitrary active content are not accepted as uploaded avatars. Magic-byte validation alone is insufficient. Define decoder/runtime and pixel limits before implementing upload publication.

An unguessable public file URL is not private delivery. Default uploaded media to authenticated access; any publicly accessible avatar policy requires an explicit product decision. Cache-Control and CDN rules must reflect privacy. External OAuth images require a controlled source policy; importing arbitrary URLs introduces SSRF risk and needs egress restrictions.

## Sessions and client security

Test logout, expiration, refresh, revoked access and account switching. Clear private client state, media and account-scoped persistence. Validate redirect destinations to prevent open redirects. Provide recovery and verification before opening password accounts publicly.

Escape text, restrict links to safe schemes, avoid HTML rendering of message contents, and define CSP / referrer / permissions policies compatible with OAuth, Convex and WebRTC. No real credentials in examples, repository, logs or specs.

## Privacy and abuse

Baseline messages are not E2EE. Transport encryption and provider controls do not change that. Do not advertise Signal-like confidentiality. E2EE is an architecture gate if selected later: multi-device keys, verification, recovery, backups, attachments, group membership changes, search and reporting all require redesign and specialist review.

Local translation must stay local unless the user explicitly requests a disclosed remote fallback. No silent message transfer to a model provider.

No product analytics or session replay by default. Error telemetry excludes message text, emails, session values, SDP, private media URLs and push payloads. Use minimized operational identifiers and documented retention. Provide block/report handling, support, export and deletion before public release.

Security review includes dependency advisories, license suitability, secret scanning and authorization-negative tests. A previous clean regex scan is not a comprehensive security audit.

## Message attachments (implemented expansion)

The image decoding contract above remains specific to avatars. Message files use a separate opaque download-only path: authenticated streaming with actual 10 MiB byte cap, extension allowlist, transactional quota and owner/conversation-bound records. No MIME trust, inline rendering, decoder or antivirus claim. The response forces octet-stream attachment, sandbox, nosniff and no-store; membership and visibility are rechecked per download. Detailed lifecycle, quotas and rollback constraints are in [messaging-expansion.md](messaging-expansion.md).
