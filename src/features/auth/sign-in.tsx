import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";

type Flow = "signIn" | "signUp" | "reset" | "reset-verification" | "email-verification";
export function SignIn() {
  const { signIn } = useAuthActions();
  const capabilities = useQuery(api.authSettings.capabilities, {});
  const [flow, setFlow] = useState<Flow>("signIn");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const verification = flow === "reset-verification" || flow === "email-verification";
  async function submit(provider: string, data?: FormData) {
    setBusy(true);
    setError("");
    try {
      const result = await signIn(
        provider,
        data ?? { redirectTo: `/app${window.location.search}` },
      );
      if (flow === "reset") setFlow("reset-verification");
      else if (
        provider === "password" &&
        !result.signingIn &&
        capabilities?.recovery &&
        !verification
      )
        setFlow("email-verification");
    } catch {
      // Reset response deliberately does not reveal whether the address exists.
      if (flow === "reset") setFlow("reset-verification");
      else setError("Connexion impossible. Vérifiez vos informations et réessayez.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-page">
      <a href="/" className="wordmark">
        Alloo.
      </a>
      <section className="auth-card">
        <span className="eyebrow">VOTRE ESPACE, VOS CONVERSATIONS</span>
        <h1>
          {verification
            ? "Vérifiez votre boîte mail."
            : flow === "reset"
              ? "Retrouvons votre compte."
              : flow === "signIn"
                ? "Content de vous revoir."
                : "On fait connaissance ?"}
        </h1>
        <p className="muted">
          {verification
            ? "Si cette adresse est éligible, un code valable 15 minutes vous attend."
            : "Un compte. Vos proches. Rien de plus."}
        </p>
        {capabilities?.password ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit("password", new FormData(e.currentTarget));
            }}
          >
            <input type="hidden" name="flow" value={flow} />
            <label>
              Adresse e-mail
              <input
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                readOnly={verification}
                required
              />
            </label>
            {verification && (
              <label>
                Code de vérification
                <input name="code" autoComplete="one-time-code" required maxLength={12} />
              </label>
            )}
            {flow !== "reset" && flow !== "email-verification" && (
              <label>
                {flow === "reset-verification" ? "Nouveau mot de passe" : "Mot de passe"}
                <input
                  name={flow === "reset-verification" ? "newPassword" : "password"}
                  type="password"
                  minLength={flow === "signIn" ? 1 : 12}
                  maxLength={256}
                  autoComplete={flow === "signIn" ? "current-password" : "new-password"}
                  required
                />
              </label>
            )}
            {flow === "signUp" && (
              <p className="small muted">
                Au moins 12 caractères, une phrase fait très bien l’affaire.
              </p>
            )}
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <button type="submit" className="button primary" disabled={busy}>
              {busy
                ? "Un instant…"
                : verification
                  ? "Valider le code"
                  : flow === "reset"
                    ? "Recevoir un code"
                    : flow === "signIn"
                      ? "Se connecter"
                      : "Créer mon compte"}
            </button>
          </form>
        ) : (
          <p role="status">
            {capabilities
              ? "La connexion par e-mail sera disponible dès son activation."
              : "Chargement des moyens de connexion…"}
          </p>
        )}
        {(capabilities?.google || capabilities?.github) && (
          <>
            <div className="divider">ou continuer avec</div>
            <div className="oauth-row">
              {capabilities.google && (
                <button type="button" disabled={busy} onClick={() => void submit("google")}>
                  Google
                </button>
              )}
              {capabilities.github && (
                <button type="button" disabled={busy} onClick={() => void submit("github")}>
                  GitHub
                </button>
              )}
            </div>
          </>
        )}
        {capabilities?.password && (
          <button
            className="text-button"
            type="button"
            disabled={busy}
            onClick={() => {
              setFlow(flow === "signIn" ? "signUp" : "signIn");
              setError("");
            }}
          >
            {flow === "signIn"
              ? "Pas encore de compte ? S’inscrire"
              : "Déjà un compte ? Se connecter"}
          </button>
        )}
        {capabilities?.recovery && flow === "signIn" && (
          <button
            className="text-button"
            type="button"
            disabled={busy}
            onClick={() => setFlow("reset")}
          >
            Mot de passe oublié ?
          </button>
        )}
      </section>
      <p className="muted small">
        Vos conversations sont privées. <a href="/privacy">En savoir plus</a>
      </p>
    </main>
  );
}
