import { useAuthToken } from "@convex-dev/auth/react";
import { ConvexHttpClient } from "convex/browser";
import { useConvexConnectionState, useQuery } from "convex/react";
import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { OFFLINE } from "../../../shared/offline";
import { fetchAttachment } from "../messages/attachment-transfer";
import { drainOne } from "./runner";
import { type LocalStore, openLocalStore, type Queued } from "./store";

const Context = createContext<{
  store: LocalStore;
  items: Queued[];
  refresh: () => Promise<void>;
} | null>(null);
export function useOffline() {
  const context = useContext(Context);
  if (!context) throw new Error("OFFLINE_PROVIDER_MISSING");
  return context;
}
export function OfflineProvider({
  userId,
  children,
}: {
  userId: Id<"users">;
  children: ReactNode;
}) {
  const [store, setStore] = useState<LocalStore | null>(null),
    [items, setItems] = useState<Queued[]>([]),
    [error, setError] = useState("");
  const token = useAuthToken(),
    endpoint = useQuery(api.attachmentRecords.endpoint, {}),
    connection = useConvexConnectionState();
  const processing = useRef(false);
  useEffect(() => {
    let disposed = false;
    let opened: LocalStore | undefined;
    void openLocalStore(import.meta.env.VITE_CONVEX_URL, userId)
      .then((value) => {
        opened = value;
        if (disposed) value.close();
        else setStore(value);
      })
      .catch(() =>
        setError(
          "Le stockage local est indisponible. Autorisez le stockage du site puis rechargez Alloo.",
        ),
      );
    return () => {
      disposed = true;
      opened?.close();
    };
  }, [userId]);
  async function refresh() {
    if (store) setItems(await store.list());
  }
  useEffect(() => {
    if (!store) return;
    const controller = new AbortController();
    async function tick() {
      if (!store || processing.current || controller.signal.aborted) return;
      processing.current = true;
      try {
        setItems(await store.list());
        if (!navigator.onLine || !connection.isWebSocketConnected || !token || !endpoint) return;
        const client = new ConvexHttpClient(import.meta.env.VITE_CONVEX_URL, {
          fetch: (input, init) =>
            fetch(input, {
              ...init,
              signal: AbortSignal.any([controller.signal, AbortSignal.timeout(OFFLINE.requestMs)]),
            }),
          logger: false,
        });
        client.setAuth(token);
        const args = (item: Queued) => ({
          id: item.id,
          expectedUserId: userId,
          operationId: item.operationId,
          body: item.body,
          replyId: item.replyId,
          attachmentId: item.attachmentId,
        });
        for (let i = 0; i < 10 && !controller.signal.aborted; i++) {
          const worked = await drainOne(
            store,
            {
              receipt: (item) => client.query(api.messages.receipt, args(item)),
              upload: async (item) => {
                if (!item.file) throw new Error("INVALID_ATTACHMENT");
                const result = await fetchAttachment(
                  endpoint,
                  token,
                  { conversation: item.id, name: item.file.name },
                  item.file,
                  AbortSignal.any([controller.signal, AbortSignal.timeout(OFFLINE.requestMs)]),
                );
                if (!result.uploaded) throw new Error("INVALID_ATTACHMENT");
                return result.uploaded.id;
              },
              send: (item) => client.mutation(api.messages.send, args(item)),
            },
            controller.signal,
          );
          if (!worked) break;
          if (!controller.signal.aborted) setItems(await store.list());
        }
      } catch (error) {
        if (!controller.signal.aborted)
          setError(
            error instanceof Error && error.message.includes("LOCAL_ACCOUNT_CHANGED")
              ? "Le compte actif a changé. Rechargez Alloo."
              : "Le stockage local n’est plus disponible. Vos envois sont suspendus.",
          );
        controller.abort();
      } finally {
        processing.current = false;
      }
    }
    void tick();
    const timer = setInterval(() => void tick(), OFFLINE.pollMs);
    const reset = (event: Event) => {
      if (!(event instanceof CustomEvent) || !event.detail || event.detail === userId)
        controller.abort();
    };
    window.addEventListener("alloo-local-reset", reset);
    window.addEventListener("online", tick);
    return () => {
      controller.abort();
      clearInterval(timer);
      window.removeEventListener("online", tick);
      window.removeEventListener("alloo-local-reset", reset);
    };
  }, [store, token, endpoint, userId, connection.isWebSocketConnected]);
  if (!store)
    return (
      <main className="center-page">
        <p role="status">{error || "Préparation de vos brouillons…"}</p>
      </main>
    );
  return (
    <Context.Provider value={{ store, items, refresh }}>
      {error && (
        <div role="alert" className="connection-banner">
          {error}
        </div>
      )}
      {children}
    </Context.Provider>
  );
}
