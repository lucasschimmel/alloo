import { useVirtualizer } from "@tanstack/react-virtual";
import { useConvex, useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ArrowDown, ArrowLeft, MoreHorizontal, Phone, Video } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { dateLabel, lastSeenLabel, sameDay } from "../../../shared/message-label";
import { LIMITS } from "../../../shared/policy";
import { Avatar } from "../../components/ui/avatar";
import { Modal } from "../../components/ui/modal";
import { explain } from "../../lib/errors";
import { useCalls } from "../calls/call-provider";
import { MessageComposer, type Pending } from "./message-composer";
import { type Message, MessageItem } from "./message-item";

type Details = NonNullable<FunctionReturnType<typeof api.conversations.details>>;
export function Timeline({
  detail,
  userId,
  onBack,
  onInfo,
  notify,
  typing,
}: {
  detail: Details;
  userId: Id<"users">;
  onBack: () => void;
  onInfo: () => void;
  notify: (s: string) => void;
  typing: (value: boolean) => void;
}) {
  const id = detail._id,
    client = useConvex(),
    { start } = useCalls();
  const { results, status, loadMore } = usePaginatedQuery(
    api.messages.list,
    { id },
    { initialNumItems: LIMITS.page },
  );
  const messages = [...results].reverse(),
    pins = useQuery(api.messages.pins, { id }),
    presence = useQuery(api.presence.list, { id }),
    send = useMutation(api.messages.send),
    markRead = useMutation(api.messages.markRead);
  const [draft, setDraft] = useState(""),
    [reply, setReply] = useState<Message | null>(null),
    [failed, setFailed] = useState<Pending[]>([]),
    [busy, setBusy] = useState(false),
    [atBottom, setAtBottom] = useState(true),
    [anchor, setAnchor] = useState<Message | null>(null),
    [person, setPerson] = useState<Message["author"] | null>(null),
    [now, setNow] = useState(Date.now());
  const scroll = useRef<HTMLDivElement>(null),
    following = useRef(true),
    lastCount = useRef(0),
    prepend = useRef<{ height: number; top: number } | null>(null),
    lastRead = useRef<string | undefined>(undefined);
  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => scroll.current,
    estimateSize: () => 105,
    getItemKey: (index) => messages[index]._id,
    overscan: 8,
  });
  const peer = detail.members.find((m) => m.userId !== userId),
    title = detail.kind === "dm" ? (peer?.name ?? "Conversation") : detail.title;
  const latest = messages.at(-1);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useLayoutEffect(() => {
    if (!scroll.current) return;
    if (prepend.current && messages.length > lastCount.current) {
      scroll.current.scrollTop += scroll.current.scrollHeight - prepend.current.height;
      prepend.current = null;
    } else if (following.current && messages.length)
      virtualizer.scrollToIndex(messages.length - 1, { align: "end" });
    lastCount.current = messages.length;
  }, [messages.length, virtualizer]);
  useEffect(() => {
    function update() {
      if (
        latest &&
        atBottom &&
        document.visibilityState === "visible" &&
        lastRead.current !== latest._id
      ) {
        lastRead.current = latest._id;
        void markRead({ messageId: latest._id }).catch((e) => {
          lastRead.current = undefined;
          notify(explain(e));
        });
      }
    }
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, [latest, atBottom, markRead, notify]);
  async function submit(item?: Pending) {
    if (busy) return;
    const pending = item ?? {
      body: draft.trim(),
      operationId: crypto.randomUUID(),
      replyId: reply?._id,
    };
    if (!pending.body) return;
    if (!item) {
      setDraft("");
      setReply(null);
      typing(false);
    }
    setBusy(true);
    try {
      await send({ id, ...pending });
      setFailed((rows) => rows.filter((x) => x.operationId !== pending.operationId));
      following.current = true;
      setAtBottom(true);
    } catch (e) {
      if (!item) setFailed((rows) => [...rows, pending]);
      notify(explain(e));
    } finally {
      setBusy(false);
    }
  }
  async function jump(messageId: Id<"messages">) {
    const index = messages.findIndex((m) => m._id === messageId);
    if (index >= 0) {
      following.current = false;
      setAtBottom(false);
      virtualizer.scrollToIndex(index, { align: "center" });
      return;
    }
    try {
      const target = await client.query(api.messages.anchor, { messageId });
      if (target) setAnchor(target);
      else notify("Ce message n’est plus disponible.");
    } catch (e) {
      notify(explain(e));
    }
  }
  const typingPeople =
    presence?.filter((p) => p.userId !== userId && p.typingUntil > now && p.expiresAt > now) ?? [];
  const online = presence?.some((p) => p.userId !== userId && p.expiresAt > now);
  return (
    <>
      <header className="conversation-header">
        <button
          type="button"
          className="icon-button mobile-back"
          aria-label="Retour aux conversations"
          onClick={onBack}
        >
          <ArrowLeft size={19} />
        </button>
        <Avatar name={title} userId={detail.kind === "dm" ? peer?.userId : undefined} />
        <div className="conversation-heading">
          <h1>{title}</h1>
          <p>
            {detail.kind === "group"
              ? `${detail.members.length} membres`
              : online
                ? "En ligne"
                : lastSeenLabel(presence?.find((p) => p.userId === peer?.userId)?.lastSeenAt)}
          </p>
        </div>
        <div className="header-actions">
          {detail.kind === "dm" && (
            <>
              <button
                type="button"
                className="icon-button"
                aria-label="Appel audio"
                onClick={() => void start(id, "audio")}
              >
                <Phone size={18} />
              </button>
              <button
                type="button"
                className="icon-button"
                aria-label="Appel vidéo"
                onClick={() => void start(id, "video")}
              >
                <Video size={19} />
              </button>
            </>
          )}
          <button
            type="button"
            className="icon-button"
            aria-label="Informations de la conversation"
            onClick={onInfo}
          >
            <MoreHorizontal size={22} />
          </button>
        </div>
      </header>
      {!!pins?.length && (
        <div className="context-strip">
          <span>📌</span>
          <div className="pins-list">
            {pins.map((p) => (
              <button key={p._id} type="button" onClick={() => void jump(p._id)}>
                {p.body}
              </button>
            ))}
          </div>
        </div>
      )}
      <div
        ref={scroll}
        className="timeline"
        onScroll={() => {
          const el = scroll.current;
          if (el) {
            const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 90;
            following.current = bottom;
            setAtBottom(bottom);
          }
        }}
      >
        {status === "CanLoadMore" && (
          <button
            type="button"
            className="load-more"
            onClick={() => {
              if (scroll.current)
                prepend.current = {
                  height: scroll.current.scrollHeight,
                  top: scroll.current.scrollTop,
                };
              loadMore(LIMITS.page);
            }}
          >
            Messages précédents
          </button>
        )}
        {status === "LoadingFirstPage" && <p className="muted small">Chargement des messages…</p>}
        {status === "Exhausted" && !messages.length && (
          <div className="empty-chat">
            <h2>Tout commence par un Alloo.</h2>
            <p>Envoyez le premier message.</p>
          </div>
        )}
        <div style={{ height: virtualizer.getTotalSize(), width: "100%", position: "relative" }}>
          {virtualizer.getVirtualItems().map((row) => {
            const m = messages[row.index];
            return (
              <div
                key={row.key}
                ref={virtualizer.measureElement}
                data-index={row.index}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${row.start}px)`,
                }}
              >
                {(!messages[row.index - 1] ||
                  !sameDay(messages[row.index - 1]._creationTime, m._creationTime)) && (
                  <div className="date-separator">
                    <time dateTime={new Date(m._creationTime).toISOString()}>
                      {dateLabel(m._creationTime)}
                    </time>
                  </div>
                )}
                <MessageItem
                  grouped={
                    m.kind === "text" &&
                    messages[row.index - 1]?.kind === "text" &&
                    messages[row.index - 1]?.userId === m.userId &&
                    sameDay(messages[row.index - 1]._creationTime, m._creationTime) &&
                    m._creationTime - messages[row.index - 1]._creationTime < 300_000
                  }
                  message={m}
                  userId={userId}
                  canPin={detail.kind === "dm" || detail.role === "admin"}
                  onReply={setReply}
                  onAnchor={(messageId) => void jump(messageId)}
                  notify={notify}
                  onProfile={setPerson}
                  read={detail.members.some(
                    (p) => p.userId !== userId && p.readAt >= m._creationTime,
                  )}
                />
              </div>
            );
          })}
        </div>
      </div>
      {!atBottom && (
        <div className="context-strip">
          <span>Vous consultez l’historique</span>
          <button
            type="button"
            onClick={() => {
              following.current = true;
              setAtBottom(true);
              virtualizer.scrollToIndex(messages.length - 1, { align: "end" });
            }}
          >
            <ArrowDown size={13} /> Derniers messages
          </button>
        </div>
      )}
      <MessageComposer
        draft={draft}
        setDraft={setDraft}
        reply={reply}
        failed={failed}
        busy={busy}
        typing={typing}
        typingLabel={
          typingPeople.length
            ? `${typingPeople.map((p) => detail.members.find((m) => m.userId === p.userId)?.name ?? "Quelqu’un").join(", ")} écrit…`
            : ""
        }
        kind={detail.kind}
        title={title}
        onSubmit={submit}
        onCancelReply={() => setReply(null)}
        onRemoveFailed={(operationId) =>
          setFailed((rows) => rows.filter((x) => x.operationId !== operationId))
        }
      />
      <Modal
        open={!!person}
        onClose={() => setPerson(null)}
        title={`Profil de ${person?.name ?? ""}`}
        description={person?.username ? `@${person.username}` : ""}
      >
        {person && (
          <div className="stack">
            <Avatar name={person.name} userId={person.userId} />
            <p>{person.bio || "Cette personne n’a pas encore ajouté de présentation."}</p>
            {detail.members.find((m) => m.userId === person.userId)?.role === "admin" && (
              <strong>Administrateur</strong>
            )}
            <p>
              {presence?.some((p) => p.userId === person.userId && p.expiresAt > now)
                ? "En ligne"
                : lastSeenLabel(presence?.find((p) => p.userId === person.userId)?.lastSeenAt)}
            </p>
          </div>
        )}
      </Modal>
      <Modal
        open={!!anchor}
        onClose={() => setAnchor(null)}
        title="Message dans l’historique"
        description="Ce message se situe en dehors de la portion actuellement chargée."
      >
        {anchor && (
          <MessageItem
            message={anchor}
            userId={userId}
            canPin={detail.kind === "dm" || detail.role === "admin"}
            onReply={(m) => {
              setReply(m);
              setAnchor(null);
            }}
            onAnchor={(messageId) => void jump(messageId)}
            notify={notify}
            onProfile={setPerson}
            read={false}
          />
        )}
      </Modal>
    </>
  );
}
