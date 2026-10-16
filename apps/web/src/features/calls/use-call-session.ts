import { api } from "@alloo/backend/api";
import type { Id } from "@alloo/backend/dataModel";
import { LIMITS } from "@alloo/shared/policy";
import { useAction, useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { type ActorRefFrom, createActor } from "xstate";
import { explain } from "../../lib/errors";
import { useCallSound } from "./call-feedback";
import { callMachine } from "./call-machine";
import { Peer } from "./peer";

// These effects share one generation fence and resource owner for the complete call lifetime.
export function useCallSession(userId: Id<"users">, notify: (text: string) => void) {
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
    if (call?.state === "active") {
      peer.current?.startConnecting();
      machine.current?.send({ type: "CONNECT" });
    }
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
  return {
    incoming,
    call,
    phase,
    remote,
    local,
    person,
    sound,
    begin,
    end,
    peer: peer.current,
    decline: (id: Id<"calls">) => void hangupMutation({ id }).catch((e) => notify(explain(e))),
  };
}
