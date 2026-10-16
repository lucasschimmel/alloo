import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Copy, Languages, Pencil, Pin, Reply, Smile, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { LIMITS } from "../../../shared/policy";
import { Modal } from "../../components/ui/modal";
import { explain } from "../../lib/errors";
export type Message = FunctionReturnType<typeof api.messages.list>["page"][number];

import { AttachmentDownload } from "./attachment-transfer";
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
    pin = useMutation(api.messages.pin),
    edit = useMutation(api.messages.edit),
    remove = useMutation(api.messages.remove);
  const [editing, setEditing] = useState(false),
    [deleting, setDeleting] = useState(false),
    [editBody, setEditBody] = useState(""),
    [editRevision, setEditRevision] = useState(0),
    [saving, setSaving] = useState(false);
  const [translation, setTranslation] = useState<Awaited<
      ReturnType<typeof translateLocally>
    > | null>(null),
    [translating, setTranslating] = useState(false),
    [picker, setPicker] = useState(false);
  const active = useRef<AbortController | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Editing text invalidates an in-flight translation.
  useEffect(() => {
    setTranslation(null);
    setTranslating(false);
    if (m.deletedAt !== undefined) {
      setEditing(false);
      setDeleting(false);
      setPicker(false);
    }
    return () => active.current?.abort();
  }, [m.body, m.deletedAt]);
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
      const result = await translateLocally(m.body, navigator.language, controller.signal);
      if (!controller.signal.aborted) setTranslation(result);
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
        {m.attachment && m.deletedAt === undefined && (
          <AttachmentDownload file={m.attachment} notify={notify} />
        )}
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
          {m.editedAt && m.deletedAt === undefined && "Modifié · "}
          {m.pinned && "📌 "}
          {new Date(m._creationTime).toLocaleTimeString("fr", {
            hour: "2-digit",
            minute: "2-digit",
          })}
          {own && (read ? " · Lu" : " · Envoyé")}
        </small>
      </div>
      {m.deletedAt === undefined && (
        <>
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
            {own && (
              <>
                <button
                  type="button"
                  aria-label="Modifier le message"
                  onClick={() => {
                    setEditBody(m.body);
                    setEditRevision(m.revision ?? 0);
                    setEditing(true);
                  }}
                >
                  <Pencil size={13} />
                </button>
                <button
                  type="button"
                  aria-label="Supprimer pour tous"
                  onClick={() => setDeleting(true)}
                >
                  <Trash2 size={13} /> Tous
                </button>
              </>
            )}
          </div>
        </>
      )}
      <Modal open={editing} onClose={() => setEditing(false)} title="Modifier le message">
        <form
          className="stack"
          onSubmit={async (e) => {
            e.preventDefault();
            if (saving) return;
            setSaving(true);
            try {
              await edit({ messageId: m._id, body: editBody, revision: editRevision });
              setEditing(false);
            } catch (error) {
              notify(explain(error));
            } finally {
              setSaving(false);
            }
          }}
        >
          <textarea
            aria-label="Texte modifié"
            maxLength={LIMITS.message}
            value={editBody}
            onChange={(e) => setEditBody(e.target.value)}
          />
          <button
            type="submit"
            className="primary"
            disabled={saving || (!editBody.trim() && !m.attachment)}
          >
            Enregistrer la modification
          </button>
        </form>
      </Modal>
      <Modal open={deleting} onClose={() => setDeleting(false)} title="Supprimer pour tous ?">
        <p>
          Le contenu et les fichiers seront retirés pour tous les participants. Cette action est
          définitive.
        </p>
        <button
          type="button"
          disabled={saving}
          onClick={async () => {
            if (saving) return;
            setSaving(true);
            try {
              await remove({ messageId: m._id });
              setDeleting(false);
            } catch (error) {
              notify(explain(error));
            } finally {
              setSaving(false);
            }
          }}
        >
          Confirmer la suppression
        </button>
      </Modal>
    </article>
  );
}
