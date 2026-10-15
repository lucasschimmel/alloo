import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/invite/$code")({ component: Invitation });
function Invitation() {
  const { code } = Route.useParams();
  return (
    <main className="center-page">
      <a href="/" className="wordmark">
        Alloo.
      </a>
      <h1>On vous a gardé une place.</h1>
      <p>
        Connectez-vous pour rejoindre cette conversation. La validité de l’invitation sera vérifiée
        à votre arrivée.
      </p>
      <a className="button primary" href={`/app?invite=${encodeURIComponent(code)}`}>
        Rejoindre sur Alloo
      </a>
    </main>
  );
}
