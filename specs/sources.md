# Sources and evidence

Research date: 2026-10-15. This dossier combines current-session verification with the earlier same-day V2 research. Documentation and registry metadata do not establish integration success or benchmark results.

## Local evidence

- V1 HEAD before reset: `c91222a` on `develop`.
- V1 working-tree audit: `AUDIT-2026-10-15.txt`, now in the external backup.
- Prior research: `V2-STACK.txt`, now in the external backup; longer research record also exists in the user's research vault.
- User-supplied Sonnet proposal: evaluated in [decisions.md](decisions.md); not treated as authoritative factual evidence.
- Visual source: V1 app/landing CSS, root layout, wordmark and launcher SVGs; capture in [visual-reference.md](visual-reference.md).
- V1 had partially implemented uncommitted hardening. The last recorded check was 231 unit/backend tests and typecheck passing, not a complete lint/build/E2E/release gate. This does not validate V2.

## Primary references

- [TanStack Start overview](https://tanstack.com/start/latest/docs/framework/react/overview)
- [Start migration from release candidate](https://tanstack.com/start/latest/docs/framework/react/migrate-from-release-candidate)
- [Selective SSR](https://tanstack.com/start/latest/docs/framework/react/guide/selective-ssr)
- [Convex with TanStack Start](https://docs.convex.dev/client/tanstack/tanstack-start)
- [Convex with TanStack Query](https://docs.convex.dev/client/tanstack/tanstack-query)
- [Convex Auth](https://docs.convex.dev/auth/convex-auth): retained by decision, beta status is a maintenance consideration.
- [Convex Auth setup](https://labs.convex.dev/auth/setup)
- [React Compiler](https://react.dev/learn/react-compiler/introduction)
- [TanStack Virtual chat](https://tanstack.com/virtual/latest/docs/chat)
- [TanStack Form validation](https://tanstack.com/form/latest/docs/framework/react/guides/validation)
- [XState actors](https://stately.ai/docs/actors)
- [WebRTC perfect negotiation](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Perfect_negotiation)
- [LiveKit deployment](https://docs.livekit.io/transport/self-hosting/deployment/)
- [Cloudflare Start guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/)
- [Convex file uploads](https://docs.convex.dev/file-storage/upload-files)
- [R2 pricing](https://developers.cloudflare.com/r2/pricing/): free direct egress does not remove storage/operation costs.
- [PWA installability](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable): a service worker is not a universal installation requirement.
- [Base UI accessibility](https://base-ui.com/react/overview/accessibility)

R2 pricing, PWA installability and Convex Auth were re-opened during this reset. Other entries were consulted in the earlier same-day research and must be rechecked at implementation. Start and Convex integration pages previously disagreed on RC/stable wording; use the framework maintainer's release status and verify the actual integration.

No benchmark, pricing simulation, full license review, rendered visual comparison or V2 executable prototype has been completed. Avoid copying exact package versions into a future manifest without resolving and testing the whole set.
