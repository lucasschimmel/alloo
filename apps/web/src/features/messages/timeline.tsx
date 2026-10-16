import { api } from "@alloo/backend/api";
import type { Id } from "@alloo/backend/dataModel";
import { attachmentName } from "@alloo/shared/attachments";
import { LIMITS } from "@alloo/shared/policy";
import { usePaginatedQuery, useQuery } from "convex/react";
import { ArrowDown } from "lucide-react";
import { useEffect, useState } from "react";
import { Modal } from "../../components/ui/modal";
import { explain } from "../../lib/errors";
import type { ConversationDetails } from "../conversations/types";
import type { Queued } from "../offline/store";
import { useDurableComposer } from "../offline/use-composer";
import { ConversationHeader } from "./conversation-header";
import { MessageComposer } from "./message-composer";
import { MessageHistory } from "./message-history";
import { type Message, MessageItem } from "./message-item";
import { MessageProfile } from "./message-profile";
import { MessageSearch } from "./message-search";
import { useMessageScroll } from "./use-message-scroll";

// Compose conversation data and durable sending; viewport effects and presentation have their own modules.
export function Timeline({
  detail,
  userId,
  onBack,
  onInfo,
  notify,
  typing,
}: {
  detail: ConversationDetails;
  userId: Id<"users">;
  onBack: () => void;
  onInfo: () => void;
  notify: (s: string) => void;
  typing: (value: boolean) => void;
}) {
  const id = detail._id;
  const { results, status, loadMore } = usePaginatedQuery(
    api.messages.list,
    { id },
    { initialNumItems: LIMITS.page },
  );
  const messages = [...results].reverse(),
    pins = useQuery(api.messages.pins, { id }),
    presence = useQuery(api.presence.list, { id });
  const durable = useDurableComposer(id, notify);
  const { file, setFile, draft, setDraft, replyId, setReply, failed, busy } = durable;
  const [searching, setSearching] = useState(false);
  const [anchorId, setAnchor] = useState<Id<"messages"> | null>(null),
    [person, setPerson] = useState<Message["author"] | null>(null),
    [now, setNow] = useState(Date.now());
  const reply = useQuery(api.messages.anchor, replyId ? { messageId: replyId } : "skip");
  useEffect(() => {
    // Wait for the authoritative result; loading must not erase a valid restored reply.
    if (replyId && reply !== undefined && (!reply || reply.deletedAt !== undefined)) setReply(null);
  }, [replyId, reply, setReply]);
  const anchor = useQuery(api.messages.anchor, anchorId ? { messageId: anchorId } : "skip");
  const { scroll, following, prepend, virtualizer, atBottom, setAtBottom } = useMessageScroll(
    messages,
    notify,
  );
  const peer = detail.members.find((m) => m.userId !== userId),
    title = detail.kind === "dm" ? (peer?.name ?? "Conversation") : detail.title;
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  async function submit(item?: Queued) {
    try {
      await durable.submit(item);
      typing(false);
      following.current = true;
      setAtBottom(true);
    } catch {
      notify("Impossible de reprendre cet envoi.");
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
    setAnchor(messageId);
  }
  const typingPeople =
    presence?.filter((p) => p.userId !== userId && p.typingUntil > now && p.expiresAt > now) ?? [];
  const online = presence?.some((p) => p.userId !== userId && p.expiresAt > now);
  return (
    <>
      <ConversationHeader
        detail={detail}
        title={title}
        peerId={peer?.userId}
        online={online}
        lastSeen={presence?.find((p) => p.userId === peer?.userId)?.lastSeenAt}
        onBack={onBack}
        onInfo={onInfo}
        onSearch={() => setSearching(true)}
        notify={notify}
      />
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
        <MessageHistory
          messages={messages}
          virtualizer={virtualizer}
          canPin={detail.kind === "dm" || detail.role === "admin"}
          members={detail.members}
          userId={userId}
          onReply={setReply}
          onAnchor={(messageId) => void jump(messageId)}
          onProfile={setPerson}
          notify={notify}
        />
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
      {searching && (
        <MessageSearch
          id={id}
          onClose={() => setSearching(false)}
          onSelect={(messageId) => {
            setSearching(false);
            setAnchor(messageId);
          }}
        />
      )}
      <MessageComposer
        file={file}
        setFile={(next) => {
          if (!next) {
            setFile(null);
            return;
          }
          try {
            attachmentName(next.name);
            if (!next.size || next.size > LIMITS.attachmentBytes)
              throw new Error("INVALID_ATTACHMENT");
            setFile(next);
          } catch (error) {
            notify(explain(error));
          }
        }}
        draft={draft}
        setDraft={setDraft}
        reply={reply?.deletedAt === undefined ? (reply ?? null) : null}
        failed={failed}
        busy={busy || !durable.ready}
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
        onRemoveFailed={(operationId) => {
          void durable.cancel(operationId).catch(() => notify("Impossible de retirer cet envoi."));
        }}
      />
      <MessageProfile
        person={person}
        onClose={() => setPerson(null)}
        isAdmin={detail.members.find((m) => m.userId === person?.userId)?.role === "admin"}
        online={presence?.some((p) => p.userId === person?.userId && p.expiresAt > now) ?? false}
        lastSeen={presence?.find((p) => p.userId === person?.userId)?.lastSeenAt}
      />
      <Modal
        open={!!anchorId}
        onClose={() => setAnchor(null)}
        title="Message dans l’historique"
        description="Ce message se situe en dehors de la portion actuellement chargée."
      >
        {anchorId && !anchor && <p>Ce message n’est plus disponible.</p>}
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
