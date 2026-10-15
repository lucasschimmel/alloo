import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Languages, Pin, Reply, Trash2 } from "lucide-react";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { explain } from "../../lib/errors";
export type Message = FunctionReturnType<typeof api.messages.list>["page"][number];
type TranslatorApi = {
  availability: (o: { sourceLanguage: string; targetLanguage: string }) => Promise<string>;
  create: (o: {
    sourceLanguage: string;
    targetLanguage: string;
  }) => Promise<{ translate: (text: string) => Promise<string>; destroy: () => void }>;
};
export function MessageItem({
  message: m,
  userId,
  canPin,
  onReply,
  onAnchor,
  notify,
  read,
}: {
  message: Message;
  userId: Id<"users">;
  canPin: boolean;
  onReply: (m: Message) => void;
  onAnchor: (id: Id<"messages">) => void;
  notify: (message: string) => void;
  read: boolean;
}) {
  const react = useMutation(api.messages.react),
    hide = useMutation(api.messages.hide),
    pin = useMutation(api.messages.pin);
  const [translation, setTranslation] = useState(""),
    [translating, setTranslating] = useState(false);
  const own = m.userId === userId;
  async function translate() {
    const Translator = (globalThis as typeof globalThis & { Translator?: TranslatorApi })
      .Translator;
    if (!Translator) {
      notify("La traduction locale n’est pas disponible dans ce navigateur.");
      return;
    }
    setTranslating(true);
    let instance: Awaited<ReturnType<TranslatorApi["create"]>> | undefined;
    try {
      const options = { sourceLanguage: "en", targetLanguage: "fr" };
      if ((await Translator.availability(options)) === "unavailable")
        throw new Error("Unavailable");
      instance = await Translator.create(options);
      setTranslation(await instance.translate(m.body));
    } catch {
      notify("La traduction anglais → français n’est pas disponible pour ce message.");
    } finally {
      instance?.destroy();
      setTranslating(false);
    }
  }
  if (m.kind !== "text") return <div className="system-message">{m.body}</div>;
  return (
    <article className={`message-row ${own ? "own" : ""}`} data-message={m._id}>
      <span className="message-author">{own ? "Vous" : m.author.name}</span>
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
            {translation}
            <small>Traduction locale · anglais → français</small>
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
          title="Traduire de l’anglais vers le français sur cet appareil"
          aria-label="Traduire en français"
          onClick={() => void translate()}
        >
          <Languages size={13} />
        </button>
      </div>
    </article>
  );
}
