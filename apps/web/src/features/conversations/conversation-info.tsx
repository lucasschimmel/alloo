import { api } from "@alloo/backend/api";
import type { Id } from "@alloo/backend/dataModel";
import { useMutation, useQuery } from "convex/react";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { Avatar } from "../../components/ui/avatar";
import { Modal } from "../../components/ui/modal";
import { explain } from "../../lib/errors";
export function ConversationInfo({
  id,
  userId,
  onClose,
  onLeave,
}: {
  id: Id<"conversations">;
  userId: Id<"users">;
  onClose: () => void;
  onLeave: () => void;
}) {
  const detail = useQuery(api.conversations.details, { id }),
    rename = useMutation(api.conversations.rename),
    membership = useMutation(api.conversations.membership),
    invite = useMutation(api.conversations.createInvite),
    revoke = useMutation(api.conversations.revokeInvite),
    addMembers = useMutation(api.conversations.addMembers),
    block = useMutation(api.accounts.block),
    report = useMutation(api.accounts.report);
  const peer = detail?.kind === "dm" ? detail.members.find((m) => m.userId !== userId) : undefined;
  const isBlocked = useQuery(api.accounts.isBlocked, peer ? { targetId: peer.userId } : "skip");
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [term, setTerm] = useState(""),
    [reason, setReason] = useState("");
  const people = useQuery(
    api.profiles.search,
    detail?.role === "admin" && term.length >= 2 ? { term } : "skip",
  );
  const link = detail?.invite ? `${location.origin}/invite/${detail.invite.code}` : "";
  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(explain(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={detail?.kind === "group" ? detail.title : (peer?.name ?? "Conversation")}
      description={
        detail?.kind === "group" ? `${detail.members.length} membres` : `@${peer?.username ?? ""}`
      }
    >
      <div className="stack">
        {detail?.kind === "group" && detail.role === "admin" && (
          <>
            <label>
              Ajouter des membres
              <input
                aria-label="Rechercher un membre à ajouter"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Nom d’utilisateur…"
              />
            </label>
            {people
              ?.filter((p) => !detail.members.some((m) => m.userId === p.userId))
              .map((p) => (
                <button
                  key={p.userId}
                  type="button"
                  disabled={busy || detail.members.length >= 100}
                  onClick={() =>
                    void act(async () => {
                      await addMembers({ id, userIds: [p.userId] });
                      setTerm("");
                    })
                  }
                >
                  Ajouter {p.name} (@{p.username})
                </button>
              ))}
            <form
              className="stack"
              onSubmit={(e) => {
                e.preventDefault();
                const title = String(new FormData(e.currentTarget).get("title"));
                void act(() => rename({ id, title }));
              }}
            >
              <label>
                Nom du groupe
                <input name="title" defaultValue={detail.title} required maxLength={60} />
              </label>
              <button type="submit" disabled={busy}>
                Renommer
              </button>
            </form>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void act(async () => {
                  const bytes = crypto.getRandomValues(new Uint8Array(16));
                  const code = Array.from(bytes, (x) => x.toString(16).padStart(2, "0")).join("");
                  await invite({ id, code });
                })
              }
            >
              Créer / renouveler le lien d’invitation
            </button>
            {link && (
              <div className="stack">
                <input
                  readOnly
                  aria-label="Lien d’invitation"
                  value={link}
                  onFocus={(e) => e.currentTarget.select()}
                />
                <QRCodeSVG value={link} size={160} />
                <button
                  type="button"
                  onClick={() => void act(() => navigator.clipboard.writeText(link))}
                >
                  Copier le lien
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void act(() => revoke({ id }))}
                >
                  Révoquer le lien
                </button>
                <p className="small muted">
                  Expire le {new Date(detail.invite?.expiresAt ?? 0).toLocaleDateString("fr")}.
                  Renouveler invalide le lien précédent.
                </p>
              </div>
            )}
          </>
        )}
        {detail?.members.map((m) => (
          <div className="person-row" key={m.userId}>
            <Avatar name={m.name} userId={m.userId} />
            <div>
              <strong>
                {m.name}
                {m.userId === userId ? " (vous)" : ""}
              </strong>
              <small>{m.role === "admin" ? "Administrateur" : m.bio || `@${m.username}`}</small>
            </div>
            {detail.kind === "group" && detail.role === "admin" && m.userId !== userId && (
              <div className="settings-actions">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void act(() =>
                      membership({
                        id,
                        targetId: m.userId,
                        operation: m.role === "admin" ? "demote" : "promote",
                      }),
                    )
                  }
                >
                  {m.role === "admin" ? "Rétrograder" : "Promouvoir"}
                </button>
                <button
                  type="button"
                  className="danger"
                  disabled={busy}
                  onClick={() =>
                    void act(() => membership({ id, targetId: m.userId, operation: "remove" }))
                  }
                >
                  Retirer
                </button>
              </div>
            )}
          </div>
        ))}
        {detail?.kind === "group" && (
          <button
            type="button"
            className="danger"
            disabled={busy}
            onClick={() =>
              void act(async () => {
                await membership({ id, targetId: userId, operation: "remove" });
                onLeave();
              })
            }
          >
            Quitter le groupe
          </button>
        )}
        {peer && (
          <>
            <button
              type="button"
              disabled={busy}
              className="danger"
              onClick={() => void act(() => block({ targetId: peer.userId, blocked: !isBlocked }))}
            >
              {isBlocked ? "Débloquer" : "Bloquer cette personne"}
            </button>
            <p className="notice-inline">
              Le blocage empêche les messages privés, appels et invitations. Les messages des
              groupes partagés restent visibles.
            </p>
            <label>
              Signaler un problème
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={1000}
                placeholder="Décrivez la situation…"
              />
            </label>
            <button
              type="button"
              disabled={busy || !reason.trim()}
              onClick={() =>
                void act(async () => {
                  await report({ targetId: peer.userId, reason });
                  setReason("");
                  setError("Signalement enregistré pour l’administrateur de cette installation.");
                })
              }
            >
              Envoyer le signalement
            </button>
          </>
        )}
        {error && (
          <p role="status" className="error">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
