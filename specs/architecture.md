# Architecture

## Proposed structure

```text
src/routes/                    URL, layout, public metadata and composition
src/features/auth/             account and session UI
src/features/profile/          onboarding and profile editing
src/features/conversations/    navigation, membership, invitations
src/features/messages/         timeline, composer, anchors, reactions
src/features/calls/            actor, media adapter, presentation
src/components/ui/             shared accessible visual primitives
src/lib/                       narrow technical integrations
shared/                        pure domain rules genuinely used on both sides
convex/                        schema, public endpoints, internal services/jobs
tests/                         connected E2E and cross-domain scenarios
specs/                         product and architecture contracts
```

Do not create empty packages or a generic repository/DI framework. Route files compose features; domain operations live behind named contracts. Only deliberate cross-feature APIs may be imported. Shared modules must be browser-safe and contain no server authority or environment configuration.

## Rendering and identity

Public `/`, legal and support pages render publicly. Authentication/onboarding and `/app/*` resolve client auth before querying private data. Private route subtrees disable SSR. UI guards are navigation aids; Convex functions are the security boundary.

Initialize one authenticated client per browser application. Account change tears down subscriptions, call actors, pending UI operations and account-scoped caches before showing the next account. Do not fetch private data in a shared server cache or instantiate a global server-side user client.

No browser-only API access at module import time. Theme initialization is small, CSP-compatible, validates stored values and falls back to system preference. Public rendering must not introduce a light/dark hydration flash.

## Data flow

View -> domain hook -> Convex query/mutation -> validated domain operation -> transaction.
External effects use actions with explicit idempotency and retry policies; scheduled jobs process bounded batches. Start server functions are reserved for real frontend-serving needs, not a duplicate CRUD backend.

Queries return minimal authorized projections and bounded pages. Separate stable profile reads from ephemeral presence. Index queries by the access pattern, and avoid scanning complete memberships or call history to locate current state.

## Failure contracts

Domain failures have typed categories: unauthenticated, forbidden, invalid input, rate limited, conflict, expired, temporarily unavailable. Display safe actionable messages and correlation IDs, never raw provider failures. Retrying must preserve operation identity and cannot revive a canceled call.

Cross-service effects cannot be made atomic merely by placing them in a Convex action. Uploads, notification delivery and external jobs need pending/completed states, compensating cleanup and reconciliation.
