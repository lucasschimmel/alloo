# Alloo V2 specification index

Prepared 2026-10-15 from the V1 source, technical audit, previous stack research, user decisions, and the supplied Sonnet proposal.

## Authority and status

These documents define the product contract. The [latest V2 audit](final-v2-audit.md) records corrected defects and the concrete production checklist. See [implementation status](implementation-status.md) for the implemented features, executed tests and remaining release gates, and [operations](operations.md) for configuration. A test identifier alone does not imply complete acceptance coverage.

User decisions override proposals. A decision marked **selected** is the implementation default; **candidate** requires a prototype; **deferred** is outside the first release. Unresolved product choices are collected in [decisions.md](decisions.md). Change a requirement and its test contract together.

See [monorepo architecture](monorepo.md) for the current apps/packages layout.

See [architecture audit](architecture-audit.md) for enforced dependencies, module extraction and the latest maintainability verification.

## Reading order

1. [Project](project.md): purpose, audience, scope, release policy.
2. [Features](features.md): V1 inventory, V2 scope and acceptance contracts.
3. [Art direction](art-direction.md): visual identity, layouts, interaction, accessibility.
4. [Stack](stack.md): selected technologies and alternatives.
5. [Architecture](architecture.md): boundaries, routes, sessions and data flow.
6. [Data model](data-model.md): invariants, permissions, indexes and deletion.
7. [Security and privacy](security-and-privacy.md): abuse controls, uploads and privacy.
8. [Calls](calls.md): lifecycle, transport, ownership and failure handling.
9. [Offline and notifications](offline-and-notifications.md): staged progressive enhancement.
10. [Quality and performance](quality-and-performance.md): test matrix and measurable gates.
11. [Delivery](delivery.md): implementation sequence and operating requirements.
12. [Decisions](decisions.md): review of the supplied proposal and remaining choices.
13. [Sources](sources.md): evidence, dates and limitations.
14. [Rebuild and recovery](rebuild-and-recovery.md): preserved V1 and safe recovery.
15. [Visual reference](visual-reference.md): captured V1 tokens and icon source.

16. [Messaging expansion](messaging-expansion.md): attachments, search, editing and deletion contracts.

## Working rules

- Build one vertical slice at a time, starting with authenticated deployment and the risky prototypes.
- Keep public documentation in English and the initial product UI in French.
- Preserve the DA; do not preserve accidental V1 behavior identified as a defect.
- Do not silently expand scope to Better Auth, a native mobile app, E2EE, a second frontend, or a media platform.
- Read current official APIs at scaffold time. A list of published versions is not a verified lockfile.
- Do not claim privacy properties, performance gains, or browser support that have not been tested.

