import { api } from "@alloo/backend/api";
import type { Doc, Id } from "@alloo/backend/dataModel";
import { LIMITS } from "@alloo/shared/policy";
import { usePaginatedQuery } from "convex/react";
import { Plus, Search, Settings } from "lucide-react";
import { useState } from "react";
import { Avatar } from "../../components/ui/avatar";
import { useTheme } from "./use-theme";

// Keep sidebar navigation and account controls in one semantic region; presence and routing are separate.
export function ConversationSidebar({
  profile,
  selected,
  setSelected,
  onCreate,
  onSettings,
}: {
  profile: Doc<"profiles">;
  selected: string | null;
  setSelected: (id: Id<"conversations">) => void;
  onCreate: () => void;
  onSettings: () => void;
}) {
  const [term, setTerm] = useState("");
  const [theme, setTheme] = useTheme();
  const { results, status, loadMore } = usePaginatedQuery(
    api.conversations.list,
    {},
    { initialNumItems: LIMITS.conversationPage },
  );
  const conversations = results.filter((c) => c.title.toLowerCase().includes(term.toLowerCase()));
  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <a className="wordmark" href="/">
          Alloo.
        </a>
        <select
          className="theme-select"
          aria-label="Thème"
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
        >
          <option value="system">Système</option>
          <option value="light">Clair</option>
          <option value="dark">Sombre</option>
        </select>
      </div>
      <div className="sidebar-tools">
        <label>
          <span className="sr-only">Rechercher une conversation</span>
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Rechercher une conversation"
          />
        </label>
      </div>
      <div className="sidebar-label">
        <span>VOS CONVERSATIONS</span>
        <button
          type="button"
          className="icon-button"
          aria-label="Nouvelle conversation"
          onClick={() => onCreate()}
        >
          <Plus size={19} />
        </button>
      </div>
      <div className="conversation-list">
        {status === "LoadingFirstPage" && <p className="muted small">Chargement…</p>}
        {conversations.map((c) => (
          <button
            type="button"
            key={c._id}
            className={`conversation-row ${selected === c._id ? "selected" : ""}`}
            aria-current={selected === c._id ? "page" : undefined}
            onClick={() => setSelected(c._id)}
          >
            <Avatar name={c.title} userId={c.peerId} />
            <div className="conversation-summary">
              <strong>{c.title}</strong>
              <p>{c.preview}</p>
            </div>
            <div className="row-meta">
              <time>
                {new Date(c.updatedAt).toLocaleTimeString("fr", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </time>
              {c.unread > 0 && <span className="unread">{c.unread >= 99 ? "99+" : c.unread}</span>}
            </div>
          </button>
        ))}
        {status !== "LoadingFirstPage" && !conversations.length && (
          <div className="empty-chat">
            <Search size={24} />
            <p>{term ? "Aucune conversation trouvée." : "Votre prochain Alloo vous attend."}</p>
            <button type="button" onClick={() => onCreate()}>
              Commencer une conversation
            </button>
          </div>
        )}
        {status === "CanLoadMore" && (
          <button
            type="button"
            className="load-more"
            onClick={() => loadMore(LIMITS.conversationPage)}
          >
            Voir plus
          </button>
        )}
      </div>
      <div className="account-footer">
        <Avatar name={profile.name} userId={profile.userId} />
        <div>
          <strong>{profile.name}</strong>
          <small>@{profile.username}</small>
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label="Mon compte"
          onClick={() => onSettings()}
        >
          <Settings size={19} />
        </button>
      </div>
    </aside>
  );
}
