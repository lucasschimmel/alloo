import { useConvexAuth, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { Workspace } from "../conversations/workspace";
import { clearBrowserAccount } from "../offline/browser-push";
import { OfflineProvider } from "../offline/provider";
import { ProfileEditor } from "../profile/profile-editor";
import { SignIn } from "./sign-in";

export function AuthGate() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const [cleanupError, setCleanupError] = useState("");
  useEffect(() => {
    if (!isLoading && !isAuthenticated)
      void clearBrowserAccount().catch(() =>
        setCleanupError(
          "Le stockage local n’a pas pu être effacé. Effacez les données du site sur cet appareil partagé.",
        ),
      );
  }, [isLoading, isAuthenticated]);
  if (cleanupError)
    return (
      <main className="center-page" role="alert">
        {cleanupError}
      </main>
    );
  if (isLoading)
    return (
      <main className="center-page" aria-busy="true">
        Connexion à Alloo…
      </main>
    );
  if (isAuthenticated) return <SignedIn />;
  return <SignIn />;
}
function SignedIn() {
  const me = useQuery(api.profiles.me, {});
  const [cleanupError, setCleanupError] = useState("");
  const deleted = me?.profile?.deleted,
    userId = me?.userId;
  useEffect(() => {
    if (deleted && userId)
      void clearBrowserAccount(userId).catch(() =>
        setCleanupError(
          "Les données locales n’ont pas pu être effacées. Effacez les données du site sur cet appareil.",
        ),
      );
  }, [deleted, userId]);

  if (me === undefined)
    return (
      <main className="center-page" aria-busy="true">
        Votre espace se prépare…
      </main>
    );
  if (!me) return <SignIn />;
  if (me.profile?.deleted)
    return (
      <main className="center-page">
        <h1>Votre compte est supprimé.</h1>
        {cleanupError && <p role="alert">{cleanupError}</p>}
        <a href="/">Retour à l’accueil</a>
      </main>
    );
  if (!me.profile)
    return (
      <main className="auth-page">
        <a className="wordmark" href="/">
          Alloo.
        </a>
        <section className="auth-card">
          <h1>Faisons les présentations.</h1>
          <p className="muted">Choisissez le nom que vos proches verront.</p>
          <ProfileEditor profile={null} onDone={() => {}} />
        </section>
      </main>
    );
  return (
    <OfflineProvider key={me.userId} userId={me.userId}>
      <Workspace profile={me.profile} />
    </OfflineProvider>
  );
}
