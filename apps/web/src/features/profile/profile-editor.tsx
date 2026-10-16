import { api } from "@alloo/backend/api";
import type { Doc } from "@alloo/backend/dataModel";
import { useAuthActions } from "@convex-dev/auth/react";
import { useAction, useConvex, useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useState } from "react";
import { Avatar } from "../../components/ui/avatar";
import { explain } from "../../lib/errors";
import { clearBrowserAccount } from "../offline/browser-push";
import { OfflineSettings } from "../offline/settings";
import { ModerationQueue } from "./moderation-queue";
import { prepareAvatar } from "./prepare-avatar";

export function ProfileEditor({
  profile,
  onDone,
}: {
  profile: Doc<"profiles"> | null;
  onDone: () => void;
}) {
  const save = useMutation(api.profiles.save),
    upload = useAction(api.avatars.upload),
    remove = useMutation(api.accounts.remove),
    client = useConvex(),
    { signOut } = useAuthActions();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [confirmation, setConfirmation] = useState("");
  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(explain(e));
    } finally {
      setBusy(false);
    }
  };
  async function exportData() {
    const messages = [];
    let cursor: string | null = null;
    do {
      const page: FunctionReturnType<typeof api.accounts.exportPage> = await client.query(
        api.accounts.exportPage,
        {
          paginationOpts: { numItems: 100, cursor },
        },
      );
      messages.push(...page.page);
      cursor = page.isDone ? null : page.continueCursor;
    } while (cursor);
    const url = URL.createObjectURL(
      new Blob(
        [JSON.stringify({ exportedAt: new Date().toISOString(), profile, messages }, null, 2)],
        { type: "application/json" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "alloo-export.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div className="stack">
      {profile && (
        <div className="profile-avatar-row">
          <Avatar name={profile.name} userId={profile.userId} />
          <label>
            Changer ma photo
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file)
                  void act(async () => {
                    if (file.size > 5 * 1024 * 1024) throw new Error("INVALID_IMAGE");
                    await upload({ bytes: await prepareAvatar(file) });
                  });
                e.target.value = "";
              }}
            />
          </label>
        </div>
      )}
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          void act(async () => {
            await save({
              name: String(form.get("name")),
              username: String(form.get("username")),
              bio: String(form.get("bio")),
            });
            onDone();
          });
        }}
      >
        <label>
          Votre prénom ou nom
          <input
            name="name"
            defaultValue={profile?.name}
            maxLength={60}
            required
            autoComplete="name"
          />
        </label>
        <label>
          Nom d’utilisateur
          <input
            name="username"
            defaultValue={profile?.username}
            pattern="[a-z0-9_]{3,24}"
            minLength={3}
            maxLength={24}
            required
            autoComplete="username"
            placeholder="ex. camille"
          />
        </label>
        <label>
          Quelques mots sur vous
          <textarea name="bio" defaultValue={profile?.bio} maxLength={160} rows={2} />
        </label>
        <button type="submit" disabled={busy} className="button primary">
          {busy ? "Enregistrement…" : profile ? "Enregistrer" : "Entrer dans Alloo"}
        </button>
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {profile && (
        <>
          <hr />
          <ModerationQueue />
          <OfflineSettings />
          <h3>Vos données</h3>
          <p className="notice-inline">
            L’export contient votre profil et les messages que vous avez envoyés. La suppression
            anonymise votre profil et retire vos accès ; vos messages restent dans les conversations
            de vos correspondants.
          </p>
          <div className="settings-actions">
            <button type="button" disabled={busy} onClick={() => void act(exportData)}>
              Exporter mes données
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void act(async () => {
                  await clearBrowserAccount();
                  await signOut();
                })
              }
            >
              Se déconnecter
            </button>
          </div>
          <details>
            <summary className="danger">Supprimer mon compte</summary>
            <div className="stack">
              <p className="small muted">
                Cette action retire votre accès définitivement. Tapez SUPPRIMER pour confirmer.
              </p>
              <input
                aria-label="Confirmation de suppression"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
              />
              <button
                type="button"
                className="danger"
                disabled={busy || confirmation !== "SUPPRIMER"}
                onClick={() =>
                  void act(async () => {
                    await clearBrowserAccount();
                    await remove({ confirmation });
                    await signOut();
                  })
                }
              >
                Supprimer mon compte
              </button>
            </div>
          </details>
        </>
      )}
    </div>
  );
}
