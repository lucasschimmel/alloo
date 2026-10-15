import type { Doc } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
export async function endCall(ctx: MutationCtx, call: Doc<"calls">, reason: string) {
  if (call.state === "ended") return;
  await ctx.db.patch(call._id, { state: "ended", reason, expiresAt: Date.now() });
  const signals = await ctx.db
    .query("signals")
    .withIndex("by_call", (q) => q.eq("callId", call._id))
    .take(200);
  for (const signal of signals) await ctx.db.delete(signal._id);
  await ctx.db.insert("messages", {
    conversationId: call.conversationId,
    userId: call.callerId,
    body:
      reason === "missed"
        ? "Appel manqué"
        : call.kind === "audio"
          ? "Appel audio terminé"
          : "Appel vidéo terminé",
    operationId: `call:${call._id}`,
    kind: "call",
    pinned: false,
  });
  const now = Date.now();
  await ctx.db.patch(call.conversationId, { updatedAt: now });
  const members = await ctx.db
    .query("members")
    .withIndex("by_conversation", (q) => q.eq("conversationId", call.conversationId))
    .take(2);
  for (const member of members) await ctx.db.patch(member._id, { updatedAt: now });
}
