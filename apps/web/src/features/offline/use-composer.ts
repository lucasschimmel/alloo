import type { Id } from "@alloo/backend/dataModel";
import { useEffect, useRef, useState } from "react";
import type { Message } from "../messages/message-item";
import { useOffline } from "./provider";
import type { Draft, Queued } from "./store";
export function useDurableComposer(id: Id<"conversations">, notify: (message: string) => void) {
  const { store, items, refresh } = useOffline();
  const [draft, setText] = useState(""),
    [replyId, setReplyId] = useState<Id<"messages"> | undefined>(),
    [file, setFile] = useState<File | null>(null),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false);
  const current = useRef<Draft>({ id, body: "", at: Date.now(), version: crypto.randomUUID() });
  const saving = useRef(Promise.resolve()),
    submitting = useRef(false);
  useEffect(() => {
    let disposed = false;
    void store
      .draft(id)
      .then((value) => {
        if (disposed) return;
        if (value) {
          current.current = value;
          setText(value.body);
          setReplyId(value.replyId);
        }
        setReady(true);
      })
      .catch(() => notify("Impossible de restaurer le brouillon local."));
    return () => {
      disposed = true;
    };
  }, [store, id, notify]);
  function persist(patch: Partial<Pick<Draft, "body" | "replyId">>) {
    const next = { ...current.current, ...patch, version: crypto.randomUUID(), at: Date.now() };
    current.current = next;
    saving.current = store.saveDraft(next).catch(() => {
      notify("Ce brouillon n’a pas pu être enregistré sur cet appareil.");
    });
  }
  return {
    draft,
    replyId,
    file,
    setFile,
    ready,
    busy,
    failed: items.filter((item) => item.id === id),
    setDraft: (body: string) => {
      setText(body);
      persist({ body });
    },
    setReply: (message: Message | null) => {
      setReplyId(message?._id);
      persist({ replyId: message?._id });
    },
    submit: async (item?: Queued) => {
      if (item) {
        await store.retry(item.operationId);
        await refresh();
        return;
      }
      if (!ready || submitting.current || (!draft.trim() && !file)) return;
      submitting.current = true;
      setBusy(true);
      const captured = current.current,
        capturedFile = file;
      try {
        await saving.current;
        await store.enqueue(
          {
            id,
            body: captured.body.trim(),
            replyId: captured.replyId,
            file: capturedFile ?? undefined,
            operationId: crypto.randomUUID(),
            at: Date.now(),
            attempts: 0,
            nextAt: 0,
            leaseUntil: 0,
          },
          captured.version,
        );
        if (current.current.version === captured.version) {
          current.current = { id, body: "", at: Date.now(), version: crypto.randomUUID() };
          setText("");
          setReplyId(undefined);
        }
        setFile((value) => (value === capturedFile ? null : value));
        await refresh();
      } catch {
        notify(
          "Le message n’a pas pu être mis en file. Vérifiez l’espace disponible sur cet appareil.",
        );
      } finally {
        submitting.current = false;
        setBusy(false);
      }
    },
    cancel: async (operationId: string) => {
      await store.remove(operationId);
      await refresh();
    },
  };
}
