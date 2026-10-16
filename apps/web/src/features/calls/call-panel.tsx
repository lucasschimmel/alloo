import { Dialog } from "@base-ui/react/dialog";
import { Mic, MicOff, MonitorUp, Phone, PhoneOff, Video, VideoOff } from "lucide-react";
import { Avatar } from "../../components/ui/avatar";
import { explain } from "../../lib/errors";
import { CallTimer } from "./call-feedback";
import { MediaVideo } from "./media-video";
import type { useCallSession } from "./use-call-session";

// Keep the complete accessible call dialog together; session and media effects live in separate modules.
export function CallPanel({
  session,
  notify,
}: {
  session: ReturnType<typeof useCallSession>;
  notify: (text: string) => void;
}) {
  const { incoming, call, phase, remote, local, person, sound, begin, end, peer, decline } =
    session;
  return (
    <>
      {incoming && (
        <section className="incoming-call" aria-label="Appel entrant">
          <Avatar name={incoming.peer.name} userId={incoming.peer.userId} />
          <h2>{incoming.peer.name} vous appelle.</h2>
          {sound.blocked && (
            <button type="button" onClick={sound.enable}>
              Activer la sonnerie
            </button>
          )}
          <p>Un appel {incoming.kind === "audio" ? "audio" : "vidéo"} vous attend.</p>
          <div className="settings-actions">
            <button
              className="primary"
              type="button"
              onClick={() => void begin(incoming.conversationId, incoming.kind, incoming._id)}
            >
              <Phone size={16} /> Répondre
            </button>
            <button type="button" className="danger" onClick={() => decline(incoming._id)}>
              Refuser
            </button>
          </div>
        </section>
      )}
      {phase !== "idle" && (
        <Dialog.Root
          open
          onOpenChange={(open) => {
            if (!open) end();
          }}
        >
          <Dialog.Portal>
            <Dialog.Popup className="call-panel" aria-label="Appel en cours">
              <Dialog.Title className="sr-only">Appel en cours</Dialog.Title>
              <div className="call-top">
                <span className="wordmark">{person?.name ?? "Alloo"}</span>
                {call?.startedAt && <CallTimer startedAt={call.startedAt} />}
                {sound.blocked && (
                  <button type="button" onClick={sound.enable}>
                    Activer la sonnerie
                  </button>
                )}
                <p role="status">
                  {phase === "preparing"
                    ? "Préparation du microphone…"
                    : phase === "ringing"
                      ? "En attente de votre correspondant…"
                      : phase === "reconnecting"
                        ? "Connexion interrompue · reconnexion en cours…"
                        : phase === "connecting"
                          ? "Connexion…"
                          : "Vous êtes en ligne"}
                </p>
              </div>
              <div className="call-stage">
                {remote ? (
                  <MediaVideo
                    stream={remote}
                    muted={false}
                    className={!remote.getVideoTracks().length ? "audio-only-media" : undefined}
                  />
                ) : (
                  <div className="empty-chat">
                    <Phone size={45} />
                    <h2>Un instant pour se retrouver.</h2>
                  </div>
                )}
                {remote && !remote.getVideoTracks().length && (
                  <div className="audio-call-identity">
                    <Avatar name={person?.name ?? "Correspondant"} userId={person?.userId} />
                    <h2>{person?.name}</h2>
                    <p>
                      {local?.getAudioTracks()[0]?.enabled
                        ? "Microphone activé"
                        : "Microphone coupé"}
                    </p>
                  </div>
                )}
                {!!local?.getVideoTracks().length && (
                  <MediaVideo stream={local} muted className="local-video" />
                )}
              </div>
              <div className="call-controls">
                <button
                  type="button"
                  aria-label="Activer ou couper le microphone"
                  aria-pressed={local?.getAudioTracks()[0]?.enabled ?? false}
                  onClick={() => peer?.toggleMicrophone()}
                >
                  {local?.getAudioTracks()[0]?.enabled ? <Mic /> : <MicOff />}
                </button>
                {local?.getVideoTracks().length !== 0 && (
                  <button
                    type="button"
                    aria-label="Activer ou couper la caméra"
                    onClick={() => peer?.toggleCamera()}
                  >
                    {local?.getVideoTracks()[0]?.enabled ? <Video /> : <VideoOff />}
                  </button>
                )}
                <button
                  type="button"
                  aria-label="Partager ou arrêter le partage d’écran"
                  aria-pressed={peer?.sharing ?? false}
                  onClick={() => void peer?.toggleScreen().catch((e) => notify(explain(e)))}
                >
                  <MonitorUp />
                </button>
                <button
                  type="button"
                  className="hangup"
                  aria-label="Raccrocher"
                  onClick={() => end()}
                >
                  <PhoneOff />
                </button>
              </div>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </>
  );
}
