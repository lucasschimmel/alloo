import { createRootRoute, HeadContent, Link, Outlet, Scripts } from "@tanstack/react-router";
import css from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Alloo — Juste discuter." },
    ],
    links: [
      { rel: "stylesheet", href: css },
      { rel: "icon", href: "/icon.svg" },
      { rel: "apple-touch-icon", href: "/icon-192.png" },
    ],
  }),
  component: Root,
  notFoundComponent: () => (
    <main className="center-page">
      <h1>Cette page n’existe pas.</h1>
      <Link to="/">Retour à Alloo</Link>
    </main>
  ),
  errorComponent: ({ reset }) => (
    <main className="center-page">
      <h1>Un problème est survenu.</h1>
      <p>Vos données restent enregistrées. Essayez de recharger cette page.</p>
      <button type="button" onClick={reset}>
        Réessayer
      </button>
    </main>
  ),
});
function Root() {
  return (
    <html lang="fr">
      <head>
        <HeadContent />
      </head>
      <body>
        <Outlet />
        <Scripts />
      </body>
    </html>
  );
}
