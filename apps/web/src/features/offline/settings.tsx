import { api } from "@alloo/backend/api";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import {
  activateBrowserPush,
  bindWorker,
  disableBrowserPush,
  pushSupported,
  workerEnabled,
} from "./browser-push";
import { useOffline } from "./provider";
export function OfflineSettings() {
  const { store, items, refresh } = useOffline();
  const publicKey = useQuery(api.push.configuration, {});
  const register = useMutation(api.push.register),
    unregister = useMutation(api.push.unregister);
  const [enabled, setEnabled] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (pushSupported())
      void navigator.serviceWorker
        .getRegistration("/")
        .then(async (registration) => {
          setEnabled(
            !!registration &&
              !!(await registration.pushManager.getSubscription()) &&
              (await workerEnabled(registration, store)),
          );
        })
        .catch(() => setError("Impossible de vérifier les notifications de cet appareil."));
  }, [store]);
  async function toggle() {
    setBusy(true);
    setError("");
    try {
      if (enabled) {
        const registration = await navigator.serviceWorker.getRegistration("/");
        const subscription = await registration?.pushManager.getSubscription();
        await disableBrowserPush();
        setEnabled(false);
        if (subscription) await unregister({ endpoint: subscription.endpoint });
      } else {
        if (!publicKey || (await Notification.requestPermission()) !== "granted")
          throw new Error("DENIED");
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        const registration = await navigator.serviceWorker.ready;
        await activateBrowserPush(
          registration,
          publicKey,
          async (subscription, binding) => {
            const keys = subscription.toJSON().keys;
            if (!keys) throw new Error("INVALID_SUBSCRIPTION");
            await store.valid();
            await register({
              endpoint: subscription.endpoint,
              p256dh: keys.p256dh,
              auth: keys.auth,
              binding,
              expectedUserId: store.owner,
            });
          },
          (binding) => bindWorker(registration, store, binding),
        );
        setEnabled(true);
      }
    } catch {
      setError(
        "Activation impossible. Vérifiez l’autorisation du navigateur et votre connexion, puis réessayez.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="stack">
      <h3>Notifications et envois</h3>
      <p className="small muted">
        Notifications discrètes, sans contenu de message. Sur iPhone, ajoutez Alloo à l’écran
        d’accueil pour les activer.
      </p>
      <button
        type="button"
        disabled={busy || !pushSupported() || (!publicKey && !enabled)}
        onClick={() => void toggle()}
      >
        {enabled ? "Désactiver les notifications" : "Activer les notifications"}
      </button>
      {!pushSupported() && (
        <p className="notice-inline">
          Les notifications push ne sont pas prises en charge par ce navigateur.
        </p>
      )}
      {pushSupported() && publicKey === null && (
        <p className="notice-inline">
          Les notifications push ne sont pas encore configurées sur ce serveur.
        </p>
      )}
      <p className="small muted">
        Brouillons et envois restent 7 jours sur cet appareil, jusqu’à la déconnexion. Les pièces
        jointes sont conservées après mise en file. Gardez Alloo ouvert pour reprendre les envois.
      </p>
      <p role="status">{items.length} envoi(s) en attente sur cet appareil</p>
      {items.map((item) => (
        <div className="failed-send" key={item.operationId}>
          <span>
            {item.error ? "Échec" : "En attente"} : {item.body.slice(0, 60) || item.file?.name}
          </span>
          <button
            type="button"
            disabled={!item.error || busy}
            onClick={() =>
              void store
                .retry(item.operationId)
                .then(refresh)
                .catch(() => setError("Reprise impossible."))
            }
          >
            Réessayer
          </button>
          <button
            type="button"
            disabled={item.leaseUntil > Date.now() || busy}
            onClick={() =>
              void store
                .remove(item.operationId)
                .then(refresh)
                .catch(() => setError("Retrait impossible."))
            }
          >
            Retirer
          </button>
        </div>
      ))}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </section>
  );
}
