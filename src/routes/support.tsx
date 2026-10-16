import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/support")({
  component: () => (
    <main className="document-page">
      <a className="wordmark" href="/">
        Alloo
      </a>
      <h1>Un coup de main ?</h1>
      <p>La maintenance d’Alloo est soutenue par Ship Labs.</p>
      <h2>Un appel ne démarre pas</h2>
      <p>
        Autorisez le microphone et la caméra dans votre navigateur. Vérifiez votre connexion, puis
        réessayez. Le partage d’écran dépend des capacités de votre appareil.
      </p>
      <h2>Un message n’est pas parti</h2>
      <p>
        Le message reste indiqué en échec : vous pouvez le renvoyer sans écraser votre nouveau
        brouillon.
      </p>
      <h2>Une personne vous dérange</h2>
      <p>
        Ouvrez les informations de la conversation pour la bloquer ou la signaler. Le blocage ne
        masque pas les messages des groupes partagés.
      </p>
      {import.meta.env.VITE_SUPPORT_EMAIL ? (
        <p>
          Contact :{" "}
          <a href={`mailto:${import.meta.env.VITE_SUPPORT_EMAIL}`}>
            {import.meta.env.VITE_SUPPORT_EMAIL}
          </a>
        </p>
      ) : (
        <p className="notice">
          Cette installation est en développement. Pour une assistance, contactez la personne qui
          vous a donné accès à Alloo.
        </p>
      )}
      <a href="/app">Ouvrir Alloo</a>
    </main>
  ),
});
