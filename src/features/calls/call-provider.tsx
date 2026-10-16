import { Dialog } from "@base-ui/react/dialog";
import { useAction, useMutation, useQuery } from "convex/react";
import { Mic, MicOff, MonitorUp, Phone, PhoneOff, Video, VideoOff } from "lucide-react";
import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from "react";
import { type ActorRefFrom, createActor } from "xstate";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { LIMITS } from "../../../shared/policy";
import { Avatar } from "../../components/ui/avatar";
import { explain } from "../../lib/errors";
import { CallTimer, useCallSound } from "./call-feedback";
import { callMachine } from "./call-machine";
import { Peer } from "./peer";

type CallContextValue = {
  start: (id: Id<"conversations">, kind: "audio" | "video") => Promise<void>;
};
const CallContext = createContext<CallContextValue | null>(null);
export function useCalls() {
  const value = useContext(CallContext);
  if (!value) throw new Error("Call provider missing");
  return value;
}
export function CallProvider({
  userId,
  children,
  notify,
}: {
  userId: Id<"users">;
  children: ReactNode;
  notify: (text: string) => void;
}) {
  const current = useQuery(api.calls.current, {}),
    startMutation = useMutation(api.calls.start),
    acceptMutation = useMutation(api.calls.accept),
    hangupMutation = useMutation(api.calls.hangup),
    heartbeat = useMutation(api.calls.heartbeat),
    sendSignal = useMutation(api.calls.signal),
    consume = useMutation(api.calls.consume),
    configuration = useAction(api.turn.configuration);
  const [callId, setCallId] = useState<Id<"calls"> | null>(null),
    [phase, setPhase] = useState("idle"),
    [remote, setRemote] = useState<MediaStream | null>(null),
    [, rerender] = useState(0);
  const [session] = useState(() => crypto.randomUUID());
  const call = useQuery(api.calls.get, callId ? { id: callId } : "skip"),
    signals = useQuery(api.calls.signals, callId ? { id: callId, session } : "skip");
  const machine = useRef<ActorRefFrom<typeof callMachine> | null>(null);

  const peer = useRef<Peer | null>(null),
    generation = useRef(0),
    ownedId = useRef<Id<"calls"> | null>(null),
    pending = useRef(false),
    processed = useRef(new Set<string>()),
    signalQueue = useRef(Promise.resolve());
  useEffect(() => {
    const actor = createActor(callMachine);
    machine.current = actor;
    actor.start();
    const subscription = actor.subscribe((s) => setPhase(String(s.value)));
    return () => {
      subscription.unsubscribe();
      actor.stop();
      machine.current = null;
    };
  }, []);
  const endRef = useRef<(reason?: "connection-failed") => void>(() => {});
  function end(reason?: "connection-failed") {
    generation.current++;
    pending.current = false;
    peer.current?.close();
    peer.current = null;
    const id = ownedId.current;
    ownedId.current = null;
    setCallId(null);
    setRemote(null);
    processed.current.clear();
    signalQueue.current = Promise.resolve();
    machine.current?.send({ type: "END" });
    if (id) void hangupMutation({ id, session, reason }).catch((e) => notify(explain(e)));
  }
  endRef.current = end;
  useEffect(
    () => () => {
      generation.current++;
      peer.current?.close();
      const id = ownedId.current;
      if (id)
        void hangupMutation({ id, session }).catch(() => {
          /* Local media is already stopped; server lease expires independently. */
        });
    },
    [hangupMutation, session],
  );
  useEffect(() => {
    if (call?.state === "ended") endRef.current();
    if (call?.state === "active") machine.current?.send({ type: "CONNECT" });
  }, [call?.state]);
  useEffect(() => {
    if (call?.state !== "active" || !callId) return;
    const attempt = generation.current;
    const timer = setInterval(() => {
      void heartbeat({ id: callId, session }).catch((e) => {
        if (attempt !== generation.current || ownedId.current !== callId) return;
        notify(explain(e));
        endRef.current();
      });
    }, LIMITS.heartbeatMs);
    return () => clearInterval(timer);
  }, [call?.state, callId, heartbeat, session, notify]);
  useEffect(() => {
    if (!callId || !peer.current) return;
    const manager = peer.current,
      attempt = generation.current;
    for (const signal of signals ?? []) {
      if (processed.current.has(signal._id)) continue;
      processed.current.add(signal._id);
      signalQueue.current = signalQueue.current
        .then(async () => {
          if (attempt !== generation.current) return;
          await manager.receive(signal.body);
          await consume({ id: callId, ids: [signal._id], session });
        })
        .catch((e) => {
          if (attempt === generation.current) {
            notify(explain(e));
            endRef.current();
          }
        });
    }
  }, [signals, callId, consume, notify, session]);
  async function begin(id: Id<"conversations">, kind: "audio" | "video", incomingId?: Id<"calls">) {
    if (pending.current || peer.current) return;
    pending.current = true;
    const attempt = ++generation.current;
    machine.current?.send({ type: "START" });
    try {
      const iceServers = await configuration({});
      if (attempt !== generation.current) return;
      const nextId = incomingId ?? (await startMutation({ conversationId: id, kind, session }));
      if (attempt !== generation.current) {
        if (!incomingId) await hangupMutation({ id: nextId, session });
        return;
      }
      // Win the recipient-session claim before owning or acquiring this call's resources.
      // A losing tab must never hang up the successful tab's call.
      if (incomingId) await acceptMutation({ id: incomingId, session });
      if (attempt !== generation.current) {
        await hangupMutation({ id: nextId, session });
        return;
      }
      ownedId.current = nextId;
      setCallId(nextId);
      const manager = new Peer({
        iceServers,
        polite: !!incomingId,
        signal: (body) => sendSignal({ id: nextId, body, session }),
        changed: () => {
          if (attempt === generation.current) rerender((n) => n + 1);
        },
        remote: (stream) => {
          if (attempt === generation.current) setRemote(stream);
        },
        connected: () => {
          if (attempt === generation.current) machine.current?.send({ type: "CONNECTED" });
        },
        disconnected: () => {
          if (attempt === generation.current) machine.current?.send({ type: "RECONNECT" });
        },
        failed: (e) => {
          if (attempt === generation.current) {
            notify(explain(e));
            endRef.current("connection-failed");
          }
        },
      });
      peer.current = manager;
      await manager.prepare(kind === "video");
      if (attempt !== generation.current) return;
      machine.current?.send({ type: "READY" });
      pending.current = false;
    } catch (e) {
      if (attempt === generation.current) {
        notify(explain(e));
        end();
      }
    }
  }
  const incoming =
    current?.recipientId === userId && current.state === "ringing" && !callId && phase === "idle"
      ? current
      : null;
  const local = peer.current?.local ?? null;
  const sound = useCallSound(
    incoming ? "incoming" : phase === "ringing" && call?.callerId === userId ? "outgoing" : null,
  );
  const person = call?.peer ?? incoming?.peer;
  return (
    <CallContext.Provider value={{ start: (id, kind) => begin(id, kind) }}>
      {children}
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
            <button
              type="button"
              className="danger"
              onClick={() =>
                void hangupMutation({ id: incoming._id }).catch((e) => notify(explain(e)))
              }
            >
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
                  onClick={() => peer.current?.toggleMicrophone()}
                >
                  {local?.getAudioTracks()[0]?.enabled ? <Mic /> : <MicOff />}
                </button>
                {local?.getVideoTracks().length !== 0 && (
                  <button
                    type="button"
                    aria-label="Activer ou couper la caméra"
                    onClick={() => peer.current?.toggleCamera()}
                  >
                    {local?.getVideoTracks()[0]?.enabled ? <Video /> : <VideoOff />}
                  </button>
                )}
                <button
                  type="button"
                  aria-label="Partager ou arrêter le partage d’écran"
                  aria-pressed={peer.current?.sharing ?? false}
                  onClick={() => void peer.current?.toggleScreen().catch((e) => notify(explain(e)))}
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
    </CallContext.Provider>
  );
}
function MediaVideo({
  stream,
  muted,
  className,
}: {
  stream: MediaStream;
  muted: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null),
    [blocked, setBlocked] = useState(false);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    let canceled = false;
    setBlocked(false);
    video.srcObject = stream;
    void video
      .play()
      .then(() => {
        if (!canceled) setBlocked(false);
      })
      .catch(() => {
        if (!canceled) setBlocked(true);
      });
    return () => {
      canceled = true;
      video.srcObject = null;
    };
  }, [stream]);
  return (
    <>
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={muted}
        className={className}
        aria-label={muted ? "Votre caméra" : "Votre correspondant"}
      />
      {blocked && (
        <button
          type="button"
          onClick={() =>
            void ref.current
              ?.play()
              .then(() => setBlocked(false))
              .catch(() => setBlocked(true))
          }
        >
          Activer le son et la vidéo
        </button>
      )}
    </>
  );
}
