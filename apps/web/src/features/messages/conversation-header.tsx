import { api } from "@alloo/backend/api";
import type { Id } from "@alloo/backend/dataModel";
import { lastSeenLabel } from "@alloo/shared/message-label";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, MoreHorizontal, Phone, Search, Video } from "lucide-react";
import { Avatar } from "../../components/ui/avatar";
import { explain } from "../../lib/errors";
import { useCalls } from "../calls/call-provider";
import type { ConversationDetails } from "../conversations/types";

// One semantic header owns its labelled controls; transport and viewport lifetimes stay outside this view.
export function ConversationHeader({
  detail,
  title,
  peerId,
  online,
  lastSeen,
  onBack,
  onInfo,
  onSearch,
  notify,
}: {
  detail: ConversationDetails;
  title: string;
  peerId?: Id<"users">;
  online?: boolean;
  lastSeen?: number;
  onBack: () => void;
  onInfo: () => void;
  onSearch: () => void;
  notify: (text: string) => void;
}) {
  const id = detail._id;
  const muted = useQuery(api.push.preference, { id });
  const mute = useMutation(api.push.mute);
  const { start } = useCalls();
  return (
    <header className="conversation-header">
      <button
        type="button"
        className="icon-button mobile-back"
        aria-label="Retour aux conversations"
        onClick={onBack}
      >
        <ArrowLeft size={19} />
      </button>
      <Avatar name={title} userId={detail.kind === "dm" ? peerId : undefined} />
      <div className="conversation-heading">
        <h1>{title}</h1>
        <p>
          {detail.kind === "group"
            ? `${detail.members.length} membres`
            : online
              ? "En ligne"
              : lastSeenLabel(lastSeen)}
        </p>
      </div>
      <div className="header-actions">
        <button
          type="button"
          className="icon-button"
          aria-label={muted ? "Réactiver les notifications" : "Mettre en sourdine"}
          aria-pressed={!!muted}
          onClick={() => void mute({ id, muted: !muted }).catch((error) => notify(explain(error)))}
        >
          {muted ? "🔕" : "🔔"}
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label="Rechercher dans la conversation"
          onClick={() => onSearch()}
        >
          <Search size={18} />
        </button>
        {detail.kind === "dm" && (
          <>
            <button
              type="button"
              className="icon-button"
              aria-label="Appel audio"
              onClick={() => void start(id, "audio")}
            >
              <Phone size={18} />
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label="Appel vidéo"
              onClick={() => void start(id, "video")}
            >
              <Video size={19} />
            </button>
          </>
        )}
        <button
          type="button"
          className="icon-button"
          aria-label="Informations de la conversation"
          onClick={onInfo}
        >
          <MoreHorizontal size={22} />
        </button>
      </div>
    </header>
  );
}
