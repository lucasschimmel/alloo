import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Copy, Languages, Pin, Reply, Smile, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { explain } from "../../lib/errors";
export type Message = FunctionReturnType<typeof api.messages.list>["page"][number];

import { EmojiPicker } from "./emoji-picker";
import { translateLocally } from "./translation";
export function MessageItem({
  message: m,
  userId,
  canPin,
  onReply,
  onAnchor,
  notify,
  read,
  grouped = false,
  onProfile,
}: {
  message: Message;
  userId: Id<"users">;
  canPin: boolean;
  onReply: (m: Message) => void;
  onAnchor: (id: Id<"messages">) => void;
  notify: (message: string) => void;
  read: boolean;
  grouped?: boolean;
  onProfile?: (person: Message["author"]) => void;
}) {
  const react = useMutation(api.messages.react),
    hide = useMutation(api.messages.hide),
    pin = useMutation(api.messages.pin);
  const [translation, setTranslation] = useState<Awaited<
      ReturnType<typeof translateLocally>
    > | null>(null),
    [translating, setTranslating] = useState(false),
    [picker, setPicker] = useState(false);
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  const own = m.userId === userId;
  async function translate() {
    if (translating) return;
    if (translation) {
      setTranslation(null);
      return;
    }
    const controller = new AbortController();
    active.current = controller;
    setTranslating(true);
    try {
      setTranslation(await translateLocally(m.body, navigator.language, controller.signal));
    } catch (error) {
      if (!controller.signal.aborted) notify(explain(error));
    } finally {
      if (!controller.signal.aborted) setTranslating(false);
    }
  }
  if (m.kind !== "text")
    return (
      <div className="system-message">
        {m.kind === "call" && `${own ? "Vous" : m.author.name} · `}
        {m.body}
        {m.kind === "call" && (
          <time>
            {" "}
            ·{" "}
            {new Date(m._creationTime).toLocaleTimeString("fr", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </time>
        )}
      </div>
    );
  return (
    <article className={`message-row ${own ? "own" : ""}`} data-message={m._id}>
      {!grouped && (
        <button
          type="button"
          className="message-author profile-link"
          aria-label={`Profil de ${m.author.name}`}
          onClick={() => onProfile?.(m.author)}
        >
          {own ? "Vous" : m.author.name}
        </button>
      )}
      <div className={`bubble ${own ? "outgoing" : "incoming"}`}>
        {m.quote && (
          <button type="button" className="quote" onClick={() => onAnchor(m.quote?.id ?? m._id)}>
            {m.quote.body}
          </button>
        )}
        {m.body}
        {translation && (
          <div className="translation">
            <hr />
            {translation.text}
            <small>
              Traduction locale · {translation.sourceLanguage} → {translation.targetLanguage}
            </small>
          </div>
        )}
        <small>
          {m.pinned && "📌 "}
          {new Date(m._creationTime).toLocaleTimeString("fr", {
            hour: "2-digit",
            minute: "2-digit",
          })}
          {own && (read ? " · Lu" : " · Envoyé")}
        </small>
      </div>
      <EmojiPicker
        open={picker}
        onClose={() => setPicker(false)}
        onSelect={(emoji) =>
          void react({ messageId: m._id, emoji }).catch((e) => notify(explain(e)))
        }
      />
      <div className="message-actions">
        {m.reactions.map((r) => (
          <button
            type="button"
            key={r.emoji}
            className={r.mine ? "reacted" : ""}
            aria-label={`${r.emoji}, ${r.count} réactions`}
            onClick={() =>
              void react({ messageId: m._id, emoji: r.emoji }).catch((e) => notify(explain(e)))
            }
          >
            {r.emoji} {r.count}
          </button>
        ))}
        <button
          type="button"
          title="J’aime"
          aria-label="Réagir avec un cœur"
          onClick={() =>
            void react({ messageId: m._id, emoji: "❤️" }).catch((e) => notify(explain(e)))
          }
        >
          ♡
        </button>
        <button
          type="button"
          title="Répondre"
          aria-label="Répondre au message"
          onClick={() => onReply(m)}
        >
          <Reply size={13} />
        </button>
        <button type="button" aria-label="Choisir une réaction" onClick={() => setPicker(true)}>
          <Smile size={13} />
        </button>
        <button
          type="button"
          aria-label="Copier le message"
          onClick={() =>
            void navigator.clipboard
              .writeText(m.body)
              .then(() => notify("Message copié."))
              .catch(() => notify("La copie n’est pas autorisée dans ce navigateur."))
          }
        >
          <Copy size={13} />
        </button>
        {canPin && (
          <button
            type="button"
            title={m.pinned ? "Désépingler" : "Épingler"}
            aria-label={m.pinned ? "Désépingler" : "Épingler"}
            onClick={() => void pin({ messageId: m._id }).catch((e) => notify(explain(e)))}
          >
            <Pin size={12} />
          </button>
        )}
        <button
          type="button"
          title="Supprimer pour moi"
          aria-label="Supprimer pour moi"
          onClick={() => void hide({ messageId: m._id }).catch((e) => notify(explain(e)))}
        >
          <Trash2 size={12} />
        </button>
        <button
          type="button"
          disabled={translating}
          title="Traduire sur cet appareil"
          aria-label={translation ? "Masquer la traduction" : "Traduire le message"}
          onClick={() => void translate()}
        >
          <Languages size={13} />
        </button>
      </div>
    </article>
  );
}
