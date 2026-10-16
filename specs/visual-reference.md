# Preserved V1 visual source

Captured 2026-10-15 before the V2 rebuild. Reference only: these snippets are not a V2 implementation. The CSS includes framework-specific wiring that must not be copied blindly. See art-direction.md for the design contract. No screenshot validation has been performed.

## apps/app/src/app/globals.css

```
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";

@custom-variant dark (&:is(.dark *));

/* ══════════════════════════════════════════════════════════════════════════
   Alloo — design tokens
   Direction: quiet product. Neutral near-white surfaces, one blue used
   sparingly, hairline separators, restrained elevation. No gradients, no
   textures, no decorative glow — the interface is the content plus the least
   chrome that makes it readable. See apps/app/DESIGN.md.
   ══════════════════════════════════════════════════════════════════════════ */

@theme inline {
    --font-heading: var(--font-sans);
    --font-sans: var(--font-sans);

    /* shadcn contract */
    --color-sidebar-ring: var(--sidebar-ring);
    --color-sidebar-border: var(--sidebar-border);
    --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
    --color-sidebar-accent: var(--sidebar-accent);
    --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
    --color-sidebar-primary: var(--sidebar-primary);
    --color-sidebar-foreground: var(--sidebar-foreground);
    --color-sidebar: var(--sidebar);
    --color-ring: var(--ring);
    --color-input: var(--input);
    --color-border: var(--border);
    --color-destructive: var(--destructive);
    --color-accent-foreground: var(--accent-foreground);
    --color-accent: var(--accent);
    --color-muted-foreground: var(--muted-foreground);
    --color-muted: var(--muted);
    --color-secondary-foreground: var(--secondary-foreground);
    --color-secondary: var(--secondary);
    --color-primary-foreground: var(--primary-foreground);
    --color-primary: var(--primary);
    --color-popover-foreground: var(--popover-foreground);
    --color-popover: var(--popover);
    --color-card-foreground: var(--card-foreground);
    --color-card: var(--card);
    --color-foreground: var(--foreground);
    --color-background: var(--background);

    /* Alloo surfaces */
    --color-canvas: var(--canvas);
    --color-surface: var(--surface);
    --color-surface-sunken: var(--surface-sunken);
    --color-bubble-in: var(--bubble-in);
    --color-primary-subtle: var(--primary-subtle);
    --color-online: var(--online);

    --radius-sm: calc(var(--radius) * 0.66);
    --radius-md: calc(var(--radius) * 0.83);
    --radius-lg: var(--radius);
    --radius-xl: calc(var(--radius) * 1.33);
    --radius-2xl: calc(var(--radius) * 1.66);
    --radius-3xl: calc(var(--radius) * 2);
    --radius-4xl: calc(var(--radius) * 2.66);
    --radius-bubble: 1.125rem;

    --shadow-e1: var(--elevation-1);
    --shadow-e2: var(--elevation-2);
    --shadow-e3: var(--elevation-3);
}

:root {
    --radius: 0.75rem;

    --background: oklch(0.975 0.002 255);
    --foreground: oklch(0.21 0.017 260);
    /* Conversation canvas — one step below the panels, nothing more. */
    --canvas: oklch(0.968 0.003 255);
    --surface: oklch(1 0 0);
    --surface-sunken: oklch(0.958 0.004 255);
    --card: oklch(1 0 0);
    --card-foreground: oklch(0.21 0.017 260);
    --popover: oklch(1 0 0);
    --popover-foreground: oklch(0.21 0.017 260);

    /* The blue. Used for: own messages, the send button, the wordmark,
       active states, links. Nothing else. */
    --primary: oklch(0.55 0.21 262);
    --primary-foreground: oklch(1 0 0);
    --primary-subtle: oklch(0.955 0.022 260);

    --online: oklch(0.68 0.16 152);

    --secondary: oklch(0.958 0.004 255);
    --secondary-foreground: oklch(0.28 0.02 260);
    --muted: oklch(0.958 0.004 255);
    --muted-foreground: oklch(0.53 0.017 260);
    --accent: oklch(0.945 0.006 255);
    --accent-foreground: oklch(0.21 0.017 260);
    --destructive: oklch(0.58 0.21 25);
    --border: oklch(0.922 0.005 255);
    --input: oklch(0.9 0.006 255);
    --ring: oklch(0.55 0.21 262);

    --bubble-in: oklch(1 0 0);

    /* Elevation is for things that float above the page — menus, dialogs,
       toasts. Never for bubbles, rows or panels. */
    --elevation-1: 0 1px 2px oklch(0.21 0.017 260 / 0.06);
    --elevation-2: 0 2px 6px oklch(0.21 0.017 260 / 0.08),
        0 1px 2px oklch(0.21 0.017 260 / 0.04);
    --elevation-3: 0 8px 28px -8px oklch(0.21 0.017 260 / 0.18),
        0 2px 6px oklch(0.21 0.017 260 / 0.06);

    --sidebar: oklch(1 0 0);
    --sidebar-foreground: oklch(0.21 0.017 260);
    --sidebar-primary: oklch(0.55 0.21 262);
    --sidebar-primary-foreground: oklch(1 0 0);
    --sidebar-accent: oklch(0.958 0.004 255);
    --sidebar-accent-foreground: oklch(0.21 0.017 260);
    --sidebar-border: oklch(0.922 0.005 255);
    --sidebar-ring: oklch(0.55 0.21 262);
}

.dark {
    --background: oklch(0.185 0.008 260);
    --foreground: oklch(0.955 0.003 260);
    --canvas: oklch(0.165 0.008 260);
    --surface: oklch(0.212 0.009 260);
    --surface-sunken: oklch(0.245 0.01 260);
    --card: oklch(0.212 0.009 260);
    --card-foreground: oklch(0.955 0.003 260);
    --popover: oklch(0.235 0.01 260);
    --popover-foreground: oklch(0.955 0.003 260);

    --primary: oklch(0.62 0.19 262);
    --primary-foreground: oklch(1 0 0);
    --primary-subtle: oklch(0.28 0.045 262);

    --online: oklch(0.72 0.16 152);

    --secondary: oklch(0.25 0.01 260);
    --secondary-foreground: oklch(0.955 0.003 260);
    --muted: oklch(0.25 0.01 260);
    --muted-foreground: oklch(0.7 0.013 260);
    --accent: oklch(0.28 0.012 260);
    --accent-foreground: oklch(0.955 0.003 260);
    --destructive: oklch(0.68 0.19 24);
    --border: oklch(1 0 0 / 10%);
    --input: oklch(1 0 0 / 14%);
    --ring: oklch(0.62 0.19 262);

    --bubble-in: oklch(0.25 0.01 260);

    --elevation-1: 0 1px 2px oklch(0 0 0 / 0.4);
    --elevation-2: 0 2px 6px oklch(0 0 0 / 0.45), 0 1px 2px oklch(0 0 0 / 0.3);
    --elevation-3: 0 8px 28px -8px oklch(0 0 0 / 0.7), 0 2px 6px oklch(0 0 0 / 0.4);

    --sidebar: oklch(0.212 0.009 260);
    --sidebar-foreground: oklch(0.955 0.003 260);
    --sidebar-primary: oklch(0.62 0.19 262);
    --sidebar-primary-foreground: oklch(1 0 0);
    --sidebar-accent: oklch(0.25 0.01 260);
    --sidebar-accent-foreground: oklch(0.955 0.003 260);
    --sidebar-border: oklch(1 0 0 / 10%);
    --sidebar-ring: oklch(0.62 0.19 262);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
    }
  body {
    @apply bg-background text-foreground;
    }
  html {
    @apply font-sans;
    }
  html, body {
    height: 100%;
    }
  button, [role="button"] {
    cursor: pointer;
    touch-action: manipulation;
    }
}

@layer utilities {
  .pb-safe {
    padding-bottom: env(safe-area-inset-bottom);
  }
  .pt-safe {
    padding-top: env(safe-area-inset-top);
  }
}

/* Slim, theme-aware scrollbars for chat panes */
@media (pointer: fine) {
  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  ::-webkit-scrollbar-track {
    background: transparent;
  }
  ::-webkit-scrollbar-thumb {
    background: color-mix(in oklch, var(--muted-foreground) 22%, transparent);
    border-radius: 9999px;
    border: 2px solid transparent;
    background-clip: content-box;
  }
  ::-webkit-scrollbar-thumb:hover {
    background: color-mix(in oklch, var(--muted-foreground) 40%, transparent);
    background-clip: content-box;
  }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

```

## apps/landing/src/app/globals.css

```
@import "tailwindcss";

/* Alloo — same tokens as apps/app (see apps/app/DESIGN.md), trimmed to what
   the landing needs. Neutral surfaces, one blue, no decoration. */
@theme {
	--font-sans: var(--font-figtree), ui-sans-serif, system-ui, sans-serif;

	--color-background: oklch(0.975 0.002 255);
	--color-foreground: oklch(0.21 0.017 260);
	--color-card: oklch(1 0 0);
	--color-surface-sunken: oklch(0.958 0.004 255);
	--color-primary: oklch(0.55 0.21 262);
	--color-primary-foreground: oklch(1 0 0);
	--color-muted-foreground: oklch(0.53 0.017 260);
	--color-border: oklch(0.922 0.005 255);
	--color-online: oklch(0.68 0.16 152);

	--radius-brand: 1rem;
	--radius-bubble: 1.125rem;
}

@media (prefers-color-scheme: dark) {
	@theme {
		--color-background: oklch(0.185 0.008 260);
		--color-foreground: oklch(0.955 0.003 260);
		--color-card: oklch(0.212 0.009 260);
		--color-surface-sunken: oklch(0.25 0.01 260);
		--color-primary: oklch(0.62 0.19 262);
		--color-primary-foreground: oklch(1 0 0);
		--color-muted-foreground: oklch(0.7 0.013 260);
		--color-border: oklch(1 0 0 / 10%);
		--color-online: oklch(0.72 0.16 152);
	}
}

@layer base {
	* {
		border-color: var(--color-border);
	}

	body {
		background-color: var(--color-background);
		color: var(--color-foreground);
		-webkit-font-smoothing: antialiased;
	}
}

/* Entrance animation — disabled for users who ask for reduced motion. */
@keyframes rise {
	from {
		opacity: 0;
		transform: translateY(1rem);
	}
	to {
		opacity: 1;
		transform: none;
	}
}

@layer utilities {
	.animate-rise {
		animation: rise 0.7s cubic-bezier(0.22, 1, 0.36, 1) both;
	}

	@media (prefers-reduced-motion: reduce) {
		.animate-rise {
			animation: none;
		}
	}
}

```

## apps/app/src/components/brand/logo.tsx

```
import { cn } from "@/lib/utils";

const sizes = {
	sm: "text-xl",
	md: "text-2xl",
	lg: "text-3xl",
} as const;

/**
 * The wordmark is the brand. No mark, no badge, no gradient — just the name
 * set tight in the product blue.
 */
export function Logo({
	size = "sm",
	className,
}: {
	size?: keyof typeof sizes;
	className?: string;
}) {
	return (
		<span
			className={cn(
				"font-bold tracking-tight text-primary",
				sizes[size],
				className,
			)}
		>
			Alloo
		</span>
	);
}

```

## apps/app/public/icon.svg

```
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img">
	<title>Alloo</title>
	<rect width="512" height="512" rx="112" fill="#3b5bf5" />
	<!-- The bubble and its three dots are one evenodd path, so the blue shows
	     through the dots instead of being repainted over it. -->
	<g transform="translate(76 88) scale(15)">
		<path
			fill="#ffffff"
			fill-rule="evenodd"
			clip-rule="evenodd"
			d="M12 4c-4.42 0-8 2.91-8 6.5 0 2 1.11 3.79 2.86 4.98v2.6c0 .64.72 1.01 1.24.64l2.3-1.64c.52.08 1.06.12 1.6.12 4.42 0 8-2.91 8-6.7C20 6.91 16.42 4 12 4ZM7.35 10.5a1.25 1.25 0 1 0 2.5 0 1.25 1.25 0 0 0-2.5 0Zm3.4 0a1.25 1.25 0 1 0 2.5 0 1.25 1.25 0 0 0-2.5 0Zm3.4 0a1.25 1.25 0 1 0 2.5 0 1.25 1.25 0 0 0-2.5 0Z"
		/>
	</g>
</svg>

```

## apps/app/public/icon-maskable.svg

```
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img">
	<title>Alloo</title>
	<!-- Maskable: artwork kept inside the 80% safe zone so OS masks never clip it. -->
	<rect width="512" height="512" fill="#3b5bf5" />
	<g transform="translate(124 136) scale(11)">
		<path
			fill="#ffffff"
			fill-rule="evenodd"
			clip-rule="evenodd"
			d="M12 4c-4.42 0-8 2.91-8 6.5 0 2 1.11 3.79 2.86 4.98v2.6c0 .64.72 1.01 1.24.64l2.3-1.64c.52.08 1.06.12 1.6.12 4.42 0 8-2.91 8-6.7C20 6.91 16.42 4 12 4ZM7.35 10.5a1.25 1.25 0 1 0 2.5 0 1.25 1.25 0 0 0-2.5 0Zm3.4 0a1.25 1.25 0 1 0 2.5 0 1.25 1.25 0 0 0-2.5 0Zm3.4 0a1.25 1.25 0 1 0 2.5 0 1.25 1.25 0 0 0-2.5 0Z"
		/>
	</g>
</svg>

```
