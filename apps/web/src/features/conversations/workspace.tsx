import { api } from "@alloo/backend/api";
import type { Doc, Id } from "@alloo/backend/dataModel";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useConvexConnectionState, useMutation, useQuery } from "convex/react";
import { MessageCircle, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Modal } from "../../components/ui/modal";
import { explain } from "../../lib/errors";
import { CallProvider } from "../calls/call-provider";
import { Timeline } from "../messages/timeline";
import { ProfileEditor } from "../profile/profile-editor";
import { ConversationInfo } from "./conversation-info";
import { ConversationSidebar } from "./conversation-sidebar";
import { NewConversation } from "./new-conversation";
import { usePresence } from "./use-presence";

export function Workspace({ profile }: { profile: Doc<"profiles"> }) {
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
    [toast, setToast] = useState("");
  const detail = useQuery(api.conversations.details, selected ? { id: selected } : "skip"),
    join = useMutation(api.conversations.join),
    connection = useConvexConnectionState();
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
    const code = search.invite;
    if (!code) return;
    void join({ code })
      .then((id) => {
        void navigate({ search: { conversation: id }, replace: true });
      })
      .catch((e) => notify(explain(e)));
  }, [join, notify, search.invite, navigate]);
  const typing = usePresence(detail?._id, notify);
  return (
    <CallProvider userId={profile.userId} notify={notify}>
      <div className={`workspace ${selected ? "has-conversation" : ""}`}>
        <ConversationSidebar
          profile={profile}
          selected={selected}
          setSelected={setSelected}
          onCreate={() => setCreating(true)}
          onSettings={() => setSettings(true)}
        />
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
