import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Workspace } from "../conversations/workspace";
import { ProfileEditor } from "../profile/profile-editor";
import { SignIn } from "./sign-in";

export function AuthGate() {
  const { isLoading, isAuthenticated } = useConvexAuth();
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
  return <Workspace key={me.userId} profile={me.profile} />;
}
