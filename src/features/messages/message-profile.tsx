import { lastSeenLabel } from "../../../shared/message-label";
import { Avatar } from "../../components/ui/avatar";
import { Modal } from "../../components/ui/modal";
import type { Message } from "./message-item";
export function MessageProfile({
  person,
  onClose,
  isAdmin,
  online,
  lastSeen,
}: {
  person: Message["author"] | null;
  onClose: () => void;
  isAdmin: boolean;
  online: boolean;
  lastSeen?: number;
}) {
  return (
    <Modal
      open={!!person}
      onClose={onClose}
      title={`Profil de ${person?.name ?? ""}`}
      description={person?.username ? `@${person.username}` : ""}
    >
      {person && (
        <div className="stack">
          <Avatar name={person.name} userId={person.userId} />
          <p>{person.bio || "Cette personne n’a pas encore ajouté de présentation."}</p>
          {isAdmin && <strong>Administrateur</strong>}
          <p>{online ? "En ligne" : lastSeenLabel(lastSeen)}</p>
        </div>
      )}
    </Modal>
  );
}
