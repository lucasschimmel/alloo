export async function messageFingerprint(
  id: string,
  body: string,
  replyId?: string,
  attachmentId?: string,
) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify([id, body, replyId ?? null, attachmentId ?? null])),
  );
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
