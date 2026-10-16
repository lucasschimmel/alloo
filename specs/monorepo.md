# Bun workspace architecture — 2026-10-16

The requested applications/packages layout supersedes the original single-frontend decision. Authentication and domain behavior remain unchanged.

| Workspace | Ownership | Internal dependencies |
|---|---|---|
| apps/landing | Public SSR site, privacy, support; independent Worker | ui |
| apps/web | Messenger, auth UI, invitations, calls, offline queue and service worker | backend API/types, shared, ui |
| packages/backend | Convex schema, functions, authentication and jobs | shared |
| packages/shared | Policies, validation and domain/display contracts | none |
| packages/ui | Semantic CSS, fonts, shared chat/page primitives and reduced motion | none |

Apps never import one another. Imports use explicit `@alloo/*` package exports. Shared code does not depend on generated backend schemas. Data-dependent React components remain with their owning web feature. Each application has a separate TypeScript project so TanStack router registrations cannot collide.

## Commands and routing

Run commands from the repository root. `bun run dev` starts both frontends with labelled output; `bun run convex` starts the backend in a separate terminal. `dev:web` and `dev:landing` start individual apps. `build`, `typecheck`, `lint` and `verify` orchestrate all relevant workspaces. Bun owns the workspace graph and one lockfile; no additional task runner is required.

Development defaults: web http://127.0.0.1:3000/app, landing http://127.0.0.1:3001. Set WEB_PORT/LANDING_PORT and VITE_APP_ORIGIN/VITE_LANDING_ORIGIN together when changing ports. Web keeps `/app`, `/invite/$code`, `/sw.js` and the installation manifest. Web `/`, `/privacy` and `/support` redirect to the landing origin. Landing links explicitly to the web origin. Each Worker exposes `/healthz`.

Production requires HTTPS origins. VITE_APP_ORIGIN must equal ALLOO_PUBLIC_ORIGIN and Convex SITE_URL. VITE_LANDING_ORIGIN identifies the public site. Existing OAuth callbacks, invitations and push stay attached to the web application. Keep the previous web origin when migrating an existing deployment: IndexedDB and push subscriptions cannot transparently move between origins.

Both Vite configs load frontend build variables from the root environment location; Worker dotenv inheritance remains disabled. Never put private values into VITE variables. Root convex.json selects packages/backend/convex; existing local deployment configuration stays at the root. No database migration or auth reset is required.

## Preview and deployment

Build with VITE_APP_ORIGIN=http://127.0.0.1:4173 and VITE_LANDING_ORIGIN=http://127.0.0.1:4174 for compiled browser checks. Start `bun run preview --port 4173` and `bun run preview:landing --port 4174` in separate terminals. Set E2E_BASE_URL/E2E_LANDING_URL to those origins, plus E2E_CONNECTED=1 and E2E_MEDIA=1, then run `bun run test:e2e` against the isolated backend. Restart previews after rebuilding.

Each app owns its Vite/Wrangler config, public assets and dist output. Worker names are alloo-web and alloo-landing; confirm target names and origins before actual publishing. `bun run deploy:dry-run` builds/packages both without publishing. `bun run deploy` enforces production readiness before publishing. CI starts both compiled previews. Inspectors are disabled by default to avoid simultaneous Workers racing for the same inspector port.

The mutation runner copies source trees and resolves @alloo imports into that isolated copy, never through live workspace symlinks. Generated routes/API and nested build directories are excluded from lint.

## Acceptance

- AC-80 / T-AC-80: SSR public content, responsive layout, privacy navigation and cross-origin application link; preserve all existing connected journeys.
- AC-81 / T-AC-81: reject invalid/mismatched split-deployment origins.
- Require all domain/backend tests, per-workspace types, both builds and both Worker packaging dry-runs.

Verified locally: 112 unit/integration tests, six connected browser scenarios, 24 selected faults detected, per-workspace TypeScript and Biome checks, both production builds and both Worker packaging dry-runs. Concurrent development and concurrent compiled previews start successfully. Frozen install and Bun advisory audit pass; no dependency version upgrade or new third-party dependency was introduced. The mobile public-page capture was inspected. A fresh FABER source review found no confirmed remaining migration defect.

The first mutation baseline exposed missing isolated-workspace dependencies; linking installed third-party dependencies while aliasing all local source into the sandbox fixed the harness. The complete rerun detects all 24 faults. The initial parallel preview exposed an inspector-port race, fixed by disabling default inspectors. Both acceptance IDs are traced against snapshots of their executed test source files. The existing CSS sourcemap warning remains.

No remote deployment is implied. Release checks still refuse incomplete production configuration. Live providers, production-origin migration, remote CI and physical-device behavior are not newly certified; the external production gates in the final audit still apply, now with two frontend origins.

Sources: [Bun workspace scripts](https://bun.sh/docs/pm/filter), [Convex configuration](https://docs.convex.dev/config/convex.json), checked 2026-10-16.
