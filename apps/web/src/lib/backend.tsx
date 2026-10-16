import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { type ReactNode, useState } from "react";

export function Backend({ children }: { children: ReactNode }) {
  const [client] = useState(() => {
    const url = import.meta.env.VITE_CONVEX_URL;
    return url ? new ConvexReactClient(url) : null;
  });
  if (!client)
    return (
      <main className="center-page">
        <a className="wordmark" href="/">
          Alloo
        </a>
        <h1>Alloo est presque prêt.</h1>
        <p>Le service de connexion n’est pas encore configuré sur cette installation.</p>
        <p className="muted">
          Administrateur : configurez le déploiement Convex et VITE_CONVEX_URL, puis relancez
          l’application.
        </p>
        <a className="button" href="/">
          Retour à l’accueil
        </a>
      </main>
    );
  return <ConvexAuthProvider client={client}>{children}</ConvexAuthProvider>;
}
