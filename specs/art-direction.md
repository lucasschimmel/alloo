# Art direction

## Identity to preserve

The V1 source describes a **quiet product**: neutral near-white surfaces, one restrained blue, hairline separators, minimal elevation. Conversation content is the focus. No decorative gradients, glow, textures or oversized marketing UI inside the messenger.

The wordmark is `Alloo`, bold Figtree with tight tracking, in the primary blue. The source wordmark sizes are 20/24/30px. Retain the name and typographic treatment rather than inventing a new emblem. Existing launcher SVGs are preserved as source in [visual-reference.md](visual-reference.md).

Typography: self-hosted Figtree, one family for body and headings; weight and tracking establish hierarchy. Geist Mono was loaded in V1 but should only be retained for an actual monospace use. Check font licenses and subset/weight requirements before shipping.

## Core tokens captured from V1

| Role | Light | Dark |
|---|---|---|
| Background | `oklch(0.975 0.002 255)` | `oklch(0.185 0.008 260)` |
| Foreground | `oklch(0.21 0.017 260)` | `oklch(0.955 0.003 260)` |
| Conversation canvas | `oklch(0.968 0.003 255)` | `oklch(0.165 0.008 260)` |
| Surface | `oklch(1 0 0)` | `oklch(0.212 0.009 260)` |
| Primary | `oklch(0.55 0.21 262)` | `oklch(0.62 0.19 262)` |
| Muted text | `oklch(0.53 0.017 260)` | `oklch(0.7 0.013 260)` |
| Border | `oklch(0.922 0.005 255)` | `oklch(1 0 0 / 10%)` |
| Incoming bubble | White | `oklch(0.25 0.01 260)` |

Base radius: 12px. Message radius: 18px. Elevation belongs to floating menus, dialogs and toasts, not rows, bubbles or panels. Blue is reserved for own messages, send, wordmark, links and active states. Online green is a status, not a second decorative accent.

These values are preservation references, not a contrast certification. Adjust semantic tokens when measured accessibility requires it and document any visible change.

## Layout and interaction contract

- Desktop: conversation navigation beside the active conversation; stable header, scrollable timeline, anchored composer. Details are a secondary panel/dialog.
- Mobile: single primary pane, predictable back navigation, keyboard-aware composer, safe-area padding, no horizontal overflow at 320px.
- Messages: clear sender grouping, readable timestamps, distinct pending/failed state, accessible reaction and message actions. Do not hide essential actions behind hover alone.
- History: prepend without jumping; preserve position when reading older messages; offer a new-message affordance rather than forced scrolling.
- Calls: incoming prompt, cancellable preparation, connecting/active/reconnecting states, obvious hangup and media permissions. Audio calls expand when an actual video/share track appears.
- Forms: persistent labels, inline errors linked to inputs, visible submitting state, focus on actionable failures.
- Required states: loading, empty, disconnected, denied, expired invitation, unavailable media, failed upload, unsupported translation and retry.

## Accessibility and voice

Target WCAG 2.2 AA with measured contrast, visible focus, keyboard navigation, focus restoration and screen-reader labels. Provide at least 44px touch targets where practical. Honor reduced motion; no entrance animation for every recycled message row. Announcements must not read the entire history on pagination.

French copy is direct and calm, using familiar product vocabulary. Avoid claiming encryption, permanent free access or universal browser support. Preserve the tagline but make public feature claims match the shipped release.

Visual parity must be checked using the recoverable V1 and representative desktop/mobile light/dark screenshots. No rendered screenshot comparison was performed during this specification-only reset.
