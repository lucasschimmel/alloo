import type { Doc } from "../convex/_generated/dataModel";

export function durationLabel(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
export function messageLabel(message: Pick<Doc<"messages">, "body" | "event" | "callData">) {
  const call = message.callData;
  if (call) {
    const outcomes = {
      completed: "terminé",
      missed: "manqué",
      declined: "refusé",
      canceled: "annulé",
      interrupted: "interrompu",
    };
    return `Appel ${call.kind === "audio" ? "audio" : "vidéo"} ${outcomes[call.outcome]}${call.durationSeconds ? ` · ${durationLabel(call.durationSeconds)}` : ""}`;
  }
  const e = message.event;
  if (!e) return message.body;
  switch (e.action) {
    case "created":
      return `${e.actorName} a créé le groupe « ${e.title} ».`;
    case "renamed":
      return `${e.actorName} a renommé le groupe « ${e.title} ».`;
    case "added":
      return `${e.actorName} a ajouté ${e.targetName}.`;
    case "joined":
      return `${e.actorName} a rejoint le groupe.`;
    case "left":
      return `${e.actorName} a quitté le groupe.`;
    case "removed":
      return `${e.actorName} a retiré ${e.targetName}.`;
    case "promoted":
      return `${e.targetName} est maintenant administrateur.`;
    case "demoted":
      return `${e.targetName} n’est plus administrateur.`;
  }
}

export function sameDay(a: number, b: number) {
  return new Date(a).toDateString() === new Date(b).toDateString();
}
export function dateLabel(timestamp: number, now = Date.now()) {
  if (sameDay(timestamp, now)) return "Aujourd’hui";
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (sameDay(timestamp, yesterday.getTime())) return "Hier";
  return new Date(timestamp).toLocaleDateString("fr", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
export function lastSeenLabel(timestamp: number | undefined) {
  return timestamp
    ? `Vu ${dateLabel(timestamp).toLowerCase()} à ${new Date(timestamp).toLocaleTimeString("fr", { hour: "2-digit", minute: "2-digit" })}`
    : "Hors ligne";
}
