import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/privacy")({
  component: () => (
    <main className="document-page">
      <a className="wordmark" href="/">
        Alloo
      </a>
      <h1>Vos échanges restent vos échanges.</h1>
      <p>
        Alloo utilise Convex pour stocker les comptes et les conversations. Les membres autorisés
        d’une conversation peuvent lire ses messages. Les messages ne sont pas chiffrés de bout en
        bout.
      </p>
      <h2>Ce que nous conservons</h2>
      <p>
        Votre profil, vos messages, les membres de vos groupes et les informations nécessaires à vos
        appels. Les flux audio et vidéo utilisent WebRTC ; ils peuvent transiter par un relais TURN.
      </p>
      <h2>Vos choix</h2>
      <p>
        Vous pouvez masquer un message pour vous, bloquer une personne, exporter vos données et
        demander la suppression de votre compte dans les réglages.
      </p>
      <p>
        Aucun suivi publicitaire ni enregistrement de session n’est activé. La traduction,
        lorsqu’elle est disponible, est exécutée par votre navigateur.
      </p>
      <p className="notice">
        Version de développement : l’identité de l’éditeur, le contact de support et les durées de
        conservation doivent être renseignés avant l’ouverture publique.
      </p>
      <a href="/app">Revenir à Alloo</a>
    </main>
  ),
});
