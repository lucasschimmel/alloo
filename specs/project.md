# Project

## Product

Alloo is a minimalist browser-first messenger for people who want private conversations and small groups without the complexity of a workplace platform or social network.

Brand promise: **« Juste discuter. Rien d'autre. »**

Primary journeys: sign in, find someone or accept an invitation, exchange messages, and start a reliable one-to-one call. Desktop and mobile web are first-class. French is the first UI language; structured system messages must remain localizable.

## Rebuild purpose

Replace the Next.js implementation with an intentionally organized TanStack Start application. Preserve the visual identity and useful functionality while fixing authorization, upload integrity, call lifecycle races, unbounded reads, and missing connected-browser verification.

A framework replacement alone does not prove a speed, security or scalability improvement. The V2 must demonstrate these properties through the gates in [quality-and-performance.md](quality-and-performance.md).

## Release scope

- **Foundation:** auth integration, public page, design system, deployment proof, timeline and call prototypes.
- **Core parity:** accounts, profiles, DM/groups, invitations, message interactions, presence, read receipts, one-to-one calls and screen sharing.
- **Public-release requirements:** account recovery, abuse controls, file safety, privacy/support pages, account deletion/export, operating procedures and connected E2E tests.
- **Later increments:** message attachments/search/editing, push, persistent offline sending and native mobile. None should delay proving the core architecture.

V1 describes itself as pre-launch. No public-user migration is assumed, but existing Convex development data and OAuth configuration still exist independently of this repository. Do not reset them automatically.

## Product constraints

No phone number requirement. No stories, bots, advertising feed, channels, billing system or enterprise workspace model in the first release. Do not publish an unconditional free-forever promise before a cost model exists.

Private means access-controlled conversations in the baseline. It does not mean end-to-end encrypted messages. If E2EE becomes a launch requirement, stop before implementing message storage and redesign that contract.

## Completion

The rebuild is complete only when every release feature has an acceptance test, the browser and backend work together in an isolated deployment, accessibility and real-device media checks pass, and deployment/rollback/support procedures are usable by the operator.
