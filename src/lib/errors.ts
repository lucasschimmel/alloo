export function explain(error: unknown) {
  const text = error instanceof Error ? error.message : String(error);
  const messages: Record<string, string> = {
    TRANSLATION_UNAVAILABLE:
      "La traduction locale n’est pas disponible pour ces langues dans ce navigateur.",
    TRANSLATION_UNCERTAIN:
      "La langue de ce message est incertaine. Essayez avec un texte plus long.",
    TRANSLATION_SAME_LANGUAGE: "Ce message est déjà dans la langue de votre navigateur.",
    INVALID_REACTION: "Choisissez un seul emoji valide.",
    GROUP_FULL: "Ce groupe a atteint la limite de 100 membres.",
    INVALID_MEMBERS: "Cette personne ne peut pas être ajoutée au groupe.",
    CALL_CONNECTION_FAILED:
      "La connexion de l’appel a été interrompue. Vous pouvez rappeler votre correspondant.",
    USERNAME_TAKEN: "Ce nom d’utilisateur est déjà pris.",
    INVALID_USERNAME: "Choisissez 3 à 24 lettres minuscules, chiffres ou traits de soulignement.",
    RATE_LIMITED: "Vous allez un peu vite. Réessayez dans un instant.",
    FORBIDDEN: "Vous n’avez plus accès à cette action.",
    BLOCKED: "Cette interaction n’est pas disponible.",
    BUSY: "Cette personne est déjà en appel.",
    TURN_NOT_CONFIGURED: "Le service d’appel n’est pas encore configuré sur cette installation.",
    EXPIRED_INVITE: "Cette invitation a expiré ou a été remplacée.",
    INVALID_IMAGE:
      "Cette image ne peut pas être utilisée. Choisissez un JPEG, PNG ou WebP de moins de 5 Mo.",
    INVALID_TRANSITION: "Cet appel n’est plus disponible ou a été accepté dans un autre onglet.",
    UNAUTHENTICATED: "Votre session a expiré. Reconnectez-vous.",
    PIN_LIMIT: "Cette conversation contient déjà 10 épingles.",
    REACTION_LIMIT: "La limite de réactions est atteinte.",
  };
  for (const [code, message] of Object.entries(messages)) if (text.includes(code)) return message;
  if (text.includes("NotAllowedError") || text.includes("Permission"))
    return "Autorisez l’accès au microphone ou à la caméra dans votre navigateur.";
  return "L’action n’a pas abouti. Vérifiez votre connexion et réessayez.";
}
