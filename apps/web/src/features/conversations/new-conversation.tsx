import { api } from "@alloo/backend/api";
import type { Id } from "@alloo/backend/dataModel";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { Avatar } from "../../components/ui/avatar";
import { Modal } from "../../components/ui/modal";
import { explain } from "../../lib/errors";
export function NewConversation({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (id: Id<"conversations">) => void;
}) {
  const [term, setTerm] = useState(""),
    [group, setGroup] = useState(false),
    [title, setTitle] = useState(""),
    [selected, setSelected] = useState<Id<"users">[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const people = useQuery(api.profiles.search, open ? { term } : "skip"),
    dm = useMutation(api.conversations.createDM),
    createGroup = useMutation(api.conversations.createGroup);
  async function create(targetId?: Id<"users">) {
    setBusy(true);
    setError("");
    try {
      const id = targetId
        ? await dm({ targetId })
        : await createGroup({ title, userIds: selected });
      onSelect(id);
      onClose();
    } catch (e) {
      setError(explain(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Une nouvelle conversation"
      description="Retrouvez quelqu’un avec son nom d’utilisateur."
    >
      <div className="stack">
        <div className="settings-actions">
          <button type="button" aria-pressed={!group} onClick={() => setGroup(false)}>
            Message privé
          </button>
          <button type="button" aria-pressed={group} onClick={() => setGroup(true)}>
            Créer un groupe
          </button>
        </div>
        {group && (
          <label>
            Nom du groupe
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} />
          </label>
        )}
        <label>
          Rechercher une personne
          <input
            autoComplete="off"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Au moins 2 caractères"
          />
        </label>
        <div className="people-list">
          {people?.map((p) => (
            <button
              type="button"
              className="person-row"
              key={p.userId}
              disabled={busy}
              aria-pressed={group ? selected.includes(p.userId) : undefined}
              onClick={() =>
                group
                  ? setSelected((ids) =>
                      ids.includes(p.userId)
                        ? ids.filter((id) => id !== p.userId)
                        : [...ids, p.userId],
                    )
                  : void create(p.userId)
              }
            >
              <Avatar name={p.name} userId={p.userId} />
              <div>
                <strong>{p.name}</strong>
                <small>@{p.username}</small>
              </div>
              {group && (selected.includes(p.userId) ? "✓" : "+")}
            </button>
          ))}
          {term.length >= 2 && people?.length === 0 && (
            <p className="muted small">Aucune personne trouvée.</p>
          )}
        </div>
        {group && (
          <button
            type="button"
            className="primary"
            disabled={busy || !title.trim() || !selected.length}
            onClick={() => void create()}
          >
            Créer le groupe · {selected.length + 1} membres
          </button>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
