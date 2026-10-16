import { api } from "@alloo/backend/api";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { explain } from "../../lib/errors";
export function ModerationQueue() {
  const rows = useQuery(api.moderation.queue, {});
  const resolve = useMutation(api.moderation.resolve);
  const [error, setError] = useState("");
  if (!rows) return null;
  return (
    <section className="stack">
      <h3>Signalements à examiner</h3>
      <p className="small muted">
        Réservé aux opérateurs de cette installation. Examinez les faits avant de clôturer.
      </p>
      {rows.length === 0 && <p>Aucun signalement en attente.</p>}
      {rows.map((row) => (
        <article className="notice-inline" key={row._id}>
          <strong>
            {row.reporter.name} → {row.target.name}
          </strong>
          <p>{row.reason}</p>
          <button
            type="button"
            onClick={() => void resolve({ id: row._id }).catch((e) => setError(explain(e)))}
          >
            Marquer comme traité
          </button>
        </article>
      ))}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
