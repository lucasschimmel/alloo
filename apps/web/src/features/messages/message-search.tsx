import { api } from "@alloo/backend/api";
import type { Id } from "@alloo/backend/dataModel";
import { usePaginatedQuery } from "convex/react";
import { useState } from "react";
import { Modal } from "../../components/ui/modal";
export function MessageSearch({
  id,
  onClose,
  onSelect,
}: {
  id: Id<"conversations">;
  onClose: () => void;
  onSelect: (id: Id<"messages">) => void;
}) {
  const [input, setInput] = useState(""),
    [term, setTerm] = useState("");
  const { results, status, loadMore } = usePaginatedQuery(
    api.messages.search,
    term ? { id, text: term } : "skip",
    { initialNumItems: 20 },
  );
  return (
    <Modal
      open
      onClose={onClose}
      title="Rechercher dans la conversation"
      description="Recherchez des mots dans le texte des messages."
    >
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          setTerm(input.trim());
        }}
      >
        <input
          aria-label="Rechercher des messages"
          maxLength={200}
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button className="primary" disabled={!input.trim()} type="submit">
          Rechercher
        </button>
      </form>
      {term && (
        <div className="stack search-results" aria-live="polite">
          {status === "LoadingFirstPage" ? (
            <p>Recherche…</p>
          ) : (
            !results.length && <p>Aucun message dans cette page de résultats.</p>
          )}
          {results.map((m) => (
            <button
              type="button"
              key={m._id}
              className="search-result"
              onClick={() => onSelect(m._id)}
            >
              <strong>{m.author.name}</strong>
              <span>{m.body}</span>
              <small>{new Date(m._creationTime).toLocaleString("fr")}</small>
            </button>
          ))}
          {(status === "CanLoadMore" || status === "LoadingMore") && (
            <button type="button" disabled={status === "LoadingMore"} onClick={() => loadMore(20)}>
              Charger d’autres résultats
            </button>
          )}
        </div>
      )}
    </Modal>
  );
}
