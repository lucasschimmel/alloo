# Stack

## Selected baseline

| Layer | Choice | Reason / condition |
|---|---|---|
| Package manager and scripts | Bun, frozen lockfile in CI | Continue existing tooling; not the Cloudflare production runtime |
| Language | One strict TypeScript version | Select after Start, Convex and test tools typecheck together; TS 7 is a candidate, not a prerequisite |
| Web framework | TanStack Start + Router + Vite | Typed routing, public rendering and client-only private application |
| UI runtime | React and React DOM on identical compatible versions | React Compiler after integration verification |
| Backend | Convex | Transactions, reactive queries, scheduling and identity integration |
| Authentication | Convex Auth | Explicit user decision; password, Google and GitHub initially |
| Server state | Native Convex hooks and pagination | One authenticated Convex client; no mirrored server data in a global store |
| Optional loader cache | TanStack Query + Convex integration | Only where loaders/preloading benefit; explicit subscription lifetime and account reset |
| Styling | Tailwind CSS 4, semantic CSS variables | Preserve current identity |
| Components | Base UI / shadcn, Lucide | Compose and verify accessible components; CLI is a development dependency |
| Forms | TanStack Form + Zod | Complex forms only; native forms remain suitable for trivial inputs |
| Long lists | TanStack Virtual | Prototype dynamic heights, prepend and offscreen anchors before committing |
| Call orchestration | XState 5 | Limited to calls; explicit owner for async operations and media resources |
| Call transport | Native WebRTC 1:1 + production TURN | Native implementation must pass real network tests; LiveKit is the fallback |
| Storage | Convex Storage initially | Owned upload registry, server validation and lifecycle cleanup are mandatory |
| Fonts and images | Self-hosted Figtree WOFF2, responsive image variants | Explicit replacement for next/font and next/image |
| Motion | CSS first; Motion lazily where justified | A package rename does not establish a smaller bundle |
| Tests | Vitest, convex-test, Testing Library, Playwright | Add fast-check / mutation tests for critical invariants where useful |
| Quality | Biome, Knip, dependency and secret scanning | Generated entries explicitly configured; exact versions frozen |
| CI | GitHub Actions | Isolated backend, real auth fixtures, no production mutation |
| Hosting | Cloudflare Workers with static assets, candidate | Real workerd deployment test required before adoption |

## Deliberate simplifications

Two Start applications now serve the public website and messenger, following the user's explicit monorepo request. Bun workspaces orchestrate apps/landing and apps/web with backend/shared/UI packages. No Astro or additional task runner is introduced. See [monorepo architecture](monorepo.md).

Private routes use `ssr: false`; public content uses SSR/prerender where appropriate. Convex Auth remains the sole session authority. No improvised second cookie session or copied Better Auth SSR adapter.

Use React state and URL state for UI. Do not add Zustand on top of the call actor or duplicate Convex messages into Query and another store. Persistent drafts have a separate, account-scoped persistence contract.

## Conditional additions

- **R2:** evaluate for attachments and media economics. Egress-free does not mean free storage, operations or image processing. Keep private objects private; signed upload URLs do not validate contents or grant read authorization.
- **Convex components:** assess rate-limiter and presence first. Add workpool/action-retrier only for actual bounded background workloads; never blindly retry non-idempotent side effects.
- **Lefthook:** preferred candidate for new local hooks; CI remains authoritative. No speed claim without a measurement.
- **Sentry or equivalent:** filtered errors and operational metrics; no message bodies or replay. No PostHog by default.
- **Turnstile:** optional abuse escalation, never a substitute for authorization and quotas.
- **ThumbHash:** optional processed-image placeholder; keep it under the same privacy policy as the media.
- **PWA worker:** staged separately after deployment/cache compatibility is proven.

## Version policy

Do not install every latest package independently. Resolve supported peer ranges, pin the toolchain, generate a lockfile, audit it, then run auth, browser, build and deployed-runtime checks. The 2026-10-15 research snapshot is evidence for selection, not proof of compatibility. See [sources.md](sources.md).

## Implemented selection

The pinned versions are authoritative in package.json and bun.lock. See [implementation status](implementation-status.md) for tested compatibility and deliberate simplifications; hosting and React Compiler remain conditional.

