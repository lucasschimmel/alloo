import { useNavigate, useSearch } from "@tanstack/react-router";
import { useConvexConnectionState, useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { MessageCircle, Plus, Search, Settings } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { LIMITS } from "../../../shared/policy";
import { Avatar } from "../../components/ui/avatar";
import { Modal } from "../../components/ui/modal";
import { explain } from "../../lib/errors";
import { CallProvider } from "../calls/call-provider";
import { Timeline } from "../messages/timeline";
import { ProfileEditor } from "../profile/profile-editor";
import { ConversationInfo } from "./conversation-info";
import { NewConversation } from "./new-conversation";

export function Workspace({ profile }: { profile: Doc<"profiles"> }) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.conversations.list,
    {},
    { initialNumItems: LIMITS.conversationPage },
  );
  const search = useSearch({ from: "/app" });
  const navigate = useNavigate({ from: "/app" });
  const selected = search.conversation ?? null;
  const setSelected = useCallback(
    (id: Id<"conversations"> | null) => {
      void navigate({ search: { conversation: id ?? undefined } });
    },
    [navigate],
  );
  const [creating, setCreating] = useState(false),
    [settings, setSettings] = useState(false),
    [info, setInfo] = useState(false),
    [term, setTerm] = useState(""),
    [toast, setToast] = useState(""),
    [theme, setTheme] = useState(() => localStorage.getItem("alloo-theme") ?? "system");
  const detail = useQuery(api.conversations.details, selected ? { id: selected } : "skip"),
    heartbeat = useMutation(api.presence.heartbeat),
    join = useMutation(api.conversations.join),
    connection = useConvexConnectionState();
  const [session] = useState(() => crypto.randomUUID()),
    lastTyping = useRef(0);
  const notify = useCallback((text: string) => setToast(text), []);
  useEffect(() => {
    if (selected && detail === null) {
      setInfo(false);
      notify("Cette conversation n’est plus accessible. Vous avez peut-être été retiré du groupe.");
      void navigate({ search: {}, replace: true });
    }
  }, [detail, selected, navigate, notify]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 6000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const system = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme =
        theme === "system" ? (system.matches ? "dark" : "light") : theme;
    };
    apply();
    localStorage.setItem("alloo-theme", theme);
    system.addEventListener("change", apply);
    return () => system.removeEventListener("change", apply);
  }, [theme]);
  useEffect(() => {
    const code = search.invite;
    if (!code) return;
    void join({ code })
      .then((id) => {
        void navigate({ search: { conversation: id }, replace: true });
      })
      .catch((e) => notify(explain(e)));
  }, [join, notify, search.invite, navigate]);
  useEffect(() => {
    const beat = () =>
      void heartbeat({
        session,
        conversationId: detail?._id,
        typing: false,
        online: true,
      }).catch((e) => notify(explain(e)));
    beat();
    const timer = setInterval(beat, LIMITS.heartbeatMs);
    return () => {
      clearInterval(timer);
      void heartbeat({ session, typing: false, online: false }).catch(() => {
        /* Lease expiry is the crash fallback; no private data is retained here. */
      });
    };
  }, [heartbeat, session, detail?._id, notify]);
  function typing(value: boolean) {
    if (value && Date.now() - lastTyping.current < 2000) return;
    lastTyping.current = Date.now();
    void heartbeat({
      session,
      conversationId: detail?._id,
      typing: value,
      online: true,
    }).catch((e) => notify(explain(e)));
  }
  const conversations = results.filter((c) => c.title.toLowerCase().includes(term.toLowerCase()));
  return (
    <CallProvider userId={profile.userId} notify={notify}>
      <div className={`workspace ${selected ? "has-conversation" : ""}`}>
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
              onClick={() => setCreating(true)}
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
                  {c.unread > 0 && (
                    <span className="unread">{c.unread >= 99 ? "99+" : c.unread}</span>
                  )}
                </div>
              </button>
            ))}
            {status !== "LoadingFirstPage" && !conversations.length && (
              <div className="empty-chat">
                <Search size={24} />
                <p>{term ? "Aucune conversation trouvée." : "Votre prochain Alloo vous attend."}</p>
                <button type="button" onClick={() => setCreating(true)}>
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
              onClick={() => setSettings(true)}
            >
              <Settings size={19} />
            </button>
          </div>
        </aside>
        <main className="conversation-pane">
          {!connection.isWebSocketConnected && (
            <div className="connection-banner" role="status">
              Reconnexion en cours… Vos envois sont conservés sur cet appareil.
            </div>
          )}
          {selected ? (
            detail ? (
              <Timeline
                key={selected}
                detail={detail}
                userId={profile.userId}
                onBack={() => setSelected(null)}
                onInfo={() => setInfo(true)}
                notify={notify}
                typing={typing}
              />
            ) : (
              <div className="empty-chat">Chargement de la conversation…</div>
            )
          ) : (
            <div className="empty-chat">
              <MessageCircle size={52} strokeWidth={1.3} />
              <span className="eyebrow">LES CONVERSATIONS QUI COMPTENT</span>
              <h1>
                Un petit Alloo,
                <br />
                ça change la journée.
              </h1>
              <p>Choisissez une conversation ou retrouvez quelqu’un. Le reste peut attendre.</p>
              <button type="button" className="button primary" onClick={() => setCreating(true)}>
                <Plus size={17} /> Nouvelle conversation
              </button>
            </div>
          )}
        </main>
      </div>
      <NewConversation open={creating} onClose={() => setCreating(false)} onSelect={setSelected} />
      <Modal
        open={settings}
        onClose={() => setSettings(false)}
        title="Votre compte"
        description="Un profil qui vous ressemble."
      >
        <ProfileEditor profile={profile} onDone={() => setSettings(false)} />
      </Modal>
      {info && detail && (
        <ConversationInfo
          id={detail._id}
          userId={profile.userId}
          onClose={() => setInfo(false)}
          onLeave={() => {
            setInfo(false);
            setSelected(null);
          }}
        />
      )}
      {toast && (
        <div role="status" className="toast">
          {toast}
        </div>
      )}
    </CallProvider>
  );
}
