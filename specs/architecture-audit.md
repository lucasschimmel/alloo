# Architecture and maintainability audit — 2026-10-16

Baseline: 350def9. Scope: workspace dependencies, repeated implementations and mixed-responsibility modules. This is a behavior-preserving refactor, not a new production certification.

## Findings and changes

| Finding | Correction |
|---|---|
| Server codecs and Convex-specific pagination lived in browser-facing shared code | Move image decoding/tests and pagination into backend/src. Shared now depends only on emoji-regex and contains no Node codec or Convex dependency. |
| Wildcard package exports exposed implementation/test paths | Replace shared/UI wildcards with explicit public subpaths. Backend still exposes only generated api and dataModel. |
| No executable package-boundary policy | Add check:architecture to verify and therefore CI, with negative tests for imports, cycles, public exports, production/development ownership and version drift. |
| Two copies of Worker security headers and Vite plugin configuration | One shared/http response policy, tested for redirects/cache/header preservation; one build-only config workspace. |
| Two copies of document/meta/error UI | Router-independent UI document components; each app retains its own router registration. |
| Call provider owned session effects, controls and media rendering | Separate use-call-session, call-panel and media-video; provider composes the session/context in 31 lines. |
| Conversation workspace combined sidebar, theme, presence and routing | Sidebar owns pagination/filtering; hooks own theme/presence; workspace composes routing and dialogs. |
| Timeline combined viewport effects, header, virtual rows and composer | Extract use-message-scroll, conversation-header and message-history. Keep durable sending and conversation composition in Timeline. |
| Backend API modules mixed projections and invitation logic | Private message-views/invitations services under backend/src; public endpoint names and validators remain unchanged. Hidden-message lookup is reused by sidebar and message projections. |
| Repeated test setup and oversized browser/style files | Shared backend account fixture and browser signup helper; browser specs split by journey, sidebar CSS split from conversation styles. |

No blanket claim of zero duplication is made. The short framework entry adapters and validators retain their explicit owners. Public icon assets intentionally exist in both independent deployment outputs; the icon generation script keeps them synchronized.

## Dependency direction

| Consumer | Allowed internal packages |
|---|---|
| web | backend public API/types, shared, ui; config in build configuration only |
| landing | shared response policy, ui; config in build configuration only |
| backend | shared |
| shared | none |
| ui | none; React is an explicit peer dependency |
| config | none; frontend build plugins are its responsibility |
| root tooling | shared |

Every direct import must be declared by its owner. Imports into another workspace use public package exports, never relative filesystem traversal. Production modules cannot import development-only dependencies. Versions are pinned and the gate rejects differing declarations across workspaces. Existing production dependency versions were preserved; @babel/parser 8.0.7 was added only to development tooling for syntax-aware import analysis.

## Readability measurements

Line counts describe moved responsibilities, not deleted functionality or a performance score.

| Module | Before | After |
|---|---:|---:|
| calls/call-provider.tsx | 389 | 31 |
| conversations/workspace.tsx | 272 | 131 |
| messages/timeline.tsx | 394 | 255 |
| convex/conversations.ts | 353 | 293 |
| convex/messages.ts | 344 | 306 |
| web/src/server.ts | 33 | 9 |
| web/vite.config.ts | 20 | 7 |

Every inspected handwritten TS/TSX/JS/CSS module, including browser tests, is within the configured 400-line budget. Generated API/routes, dependencies and build artifacts are excluded. Module size is a guardrail; it does not measure function complexity or prove that every remaining module is optimally decomposed.

## Acceptance and evidence

- AC-90 / T-AC-90: centralized HTTP policy preserves redirects, public caching, private no-store responses and health behavior. Tests: packages/shared/src/http.test.ts; built browser public/private header checks.
- AC-91 / T-AC-91: executable dependency boundaries reject invalid imports, private exports, reverse edges/cycles, version drift, dev-only runtime imports and oversized modules. Tests: scripts/architecture/rules.test.ts; actual repository check runs in verify.
- Behavior locks: existing message/edit/delete/file, group/invite, account deletion, themes, synthetic WebRTC and offline browser journeys remain unchanged in purpose. Their assertions were moved into domain-specific spec files.

Executed locally:

- 121 unit/integration tests across 18 files passed, including seven negative architecture tests and two HTTP policy tests.
- All six connected Chromium scenarios passed against compiled Workers and the real isolated local Convex backend.
- All 24 selected critical fault injections were detected after updating moved paths and the isolated fixture copy. This is targeted mutation evidence, not whole-repository mutation coverage.
- Architecture gate, Biome, all workspace TypeScript checks and both production builds passed.
- Both Worker deployment dry-runs and frozen dependency installation passed. Bun advisory audit reported no known vulnerabilities.
- Fresh FABER review found a template-literal blind spot in the first lexical scanner. The AST parser and regression tests fix it; targeted re-review passed.

The syntax-aware checker covers literal import/export/require expressions and inline type imports, plus quoted CSS imports. Computed module loads fail closed pending an explicit rule. It checks package graphs, not all function-call graphs or runtime data flow. No exhaustive dead-code analyzer, full-history secret scanner or production pentest is claimed. The existing CSS sourcemap warning remains. Live provider/device/operations gates from the final V2 audit still apply; nothing was deployed remotely.

## Working on the code

Run bun run check:architecture before introducing a dependency or export, then bun run verify. Keep public Convex names in convex/ and private services in backend/src. Keep framework-independent rules in shared, reusable visuals in ui and Node build plugins in config. A test fixture should remain outside deployed function modules. Add public exports deliberately and preserve negative authorization tests when moving handlers.

Primary references checked: [Babel parser](https://babeljs.io/docs/babel-parser), [Vite shared configuration](https://vite.dev/config/), 2026-10-16.
