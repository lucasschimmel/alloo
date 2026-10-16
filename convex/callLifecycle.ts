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
    body: "",
    callData: {
      callId: call._id,
      kind: call.kind,
      outcome:
        reason === "missed"
          ? "missed"
          : reason === "declined"
            ? "declined"
            : reason === "canceled"
              ? "canceled"
              : reason === "expired" || reason === "connection-failed"
                ? "interrupted"
                : "completed",
      durationSeconds: call.startedAt
        ? Math.max(0, Math.floor((Date.now() - call.startedAt) / 1000))
        : 0,
    },
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
