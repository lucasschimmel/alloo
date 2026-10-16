import type { ReactNode } from "react";

/** Router-independent document structure; each app supplies its own router content. */
export function ApplicationDocument({
  head,
  children,
  scripts,
}: {
  head: ReactNode;
  children: ReactNode;
  scripts: ReactNode;
}) {
  return (
    <html lang="fr">
      <head>{head}</head>
      <body>
        {children}
        {scripts}
      </body>
    </html>
  );
}

export function MissingPage({ home }: { home: ReactNode }) {
  return (
    <main className="center-page">
      <h1>Cette page n’existe pas.</h1>
      {home}
    </main>
  );
}

export function PageError({ reset }: { reset: () => void }) {
  return (
    <main className="center-page">
      <h1>Un problème est survenu.</h1>
      <p>Vos données restent enregistrées. Essayez de recharger cette page.</p>
      <button type="button" onClick={reset}>
        Réessayer
      </button>
    </main>
  );
}

export function documentHead(css: string, installable = false) {
  return {
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Alloo — Juste discuter." },
    ],
    links: [
      { rel: "stylesheet", href: css },
      { rel: "icon", href: "/icon.svg" },
      { rel: "apple-touch-icon", href: "/icon-192.png" },
      ...(installable ? [{ rel: "manifest", href: "/manifest.webmanifest" }] : []),
    ],
  };
}
