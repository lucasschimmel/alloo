import { Send, X } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import type { Id } from "../../../convex/_generated/dataModel";
import { LIMITS } from "../../../shared/policy";
import { EmojiPicker } from "./emoji-picker";
import type { Message } from "./message-item";
export type Pending = { body: string; operationId: string; replyId?: Id<"messages"> };
export function MessageComposer({
  draft,
  setDraft,
  reply,
  failed,
  busy,
  typing,
  typingLabel,
  kind,
  title,
  onSubmit,
  onRemoveFailed,
  onCancelReply,
}: {
  draft: string;
  setDraft: (value: string) => void;
  reply: Message | null;
  failed: Pending[];
  busy: boolean;
  typing: (value: boolean) => void;
  typingLabel: string;
  kind: "group" | "dm";
  title: string;
  onSubmit: (item?: Pending) => Promise<void>;
  onRemoveFailed: (id: string) => void;
  onCancelReply: () => void;
}) {
  const [emojiOpen, setEmojiOpen] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    if (!input.current) return;
    input.current.style.height = "auto";
    input.current.style.height = draft ? `${Math.min(input.current.scrollHeight, 140)}px` : "auto";
  }, [draft]);
  return (
    <>
      <div className="composer-area">
        {reply && (
          <div className="context-strip">
            <span>
              Réponse à {reply.author.name} : {reply.body.slice(0, 80)}
            </span>
            <button type="button" aria-label="Annuler la réponse" onClick={() => onCancelReply()}>
              <X size={14} />
            </button>
          </div>
        )}
        {failed.map((item) => (
          <div className="failed-send" key={item.operationId}>
            <span>Non envoyé : {item.body.slice(0, 50)}</span>
            <button type="button" disabled={busy} onClick={() => void onSubmit(item)}>
              Réessayer
            </button>
            <button type="button" onClick={() => onRemoveFailed(item.operationId)}>
              Retirer
            </button>
          </div>
        ))}
        <div className="typing-label" aria-live="polite">
          {typingLabel}
        </div>
        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault();
            void onSubmit();
          }}
        >
          <button type="button" aria-label="Insérer un emoji" onClick={() => setEmojiOpen(true)}>
            ☺
          </button>
          <textarea
            ref={input}
            aria-label="Votre message"
            placeholder={`Écrire ${kind === "group" ? "dans le groupe" : `à ${title}`}…`}
            rows={1}
            maxLength={LIMITS.message}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              typing(!!e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void onSubmit();
              }
            }}
          />
          <button
            className="primary"
            disabled={!draft.trim() || busy}
            type="submit"
            aria-label="Envoyer le message"
          >
            <Send size={19} />
          </button>
        </form>
        <div className="composer-hint">
          Entrée pour envoyer · Maj + Entrée pour une nouvelle ligne
          {draft.length >= LIMITS.message - 200 && (
            <span role="status"> · {LIMITS.message - draft.length} caractères restants</span>
          )}
        </div>
      </div>
      <EmojiPicker
        open={emojiOpen}
        onClose={() => setEmojiOpen(false)}
        onSelect={(emoji) => {
          const start = input.current?.selectionStart ?? draft.length;
          const end = input.current?.selectionEnd ?? start;
          const next = draft.slice(0, start) + emoji + draft.slice(end);
          if (next.length > LIMITS.message) return;
          setDraft(next);
          typing(true);
        }}
      />
    </>
  );
}
