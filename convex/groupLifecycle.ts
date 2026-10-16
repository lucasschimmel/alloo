import { v } from "convex/values";
import { LIMITS } from "../shared/policy";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { publicProfile } from "./access";

export async function groupEvent(
  ctx: MutationCtx,
  id: Id<"conversations">,
  userId: Id<"users">,
  action: NonNullable<Doc<"messages">["event"]>["action"],
  targetId?: Id<"users">,
  title?: string,
) {
  await ctx.db.insert("messages", {
    conversationId: id,
    userId,
    kind: "system",
    body: "",
    pinned: false,
    operationId: crypto.randomUUID(),
    event: {
      action,
      actorName: (await publicProfile(ctx, userId)).name,
      targetName: targetId ? (await publicProfile(ctx, targetId)).name : undefined,
      title,
    },
  });
  const now = Date.now();
  await ctx.db.patch(id, { updatedAt: now });
  const members = await ctx.db
    .query("members")
    .withIndex("by_conversation", (q) => q.eq("conversationId", id))
    .take(LIMITS.group);
  for (const row of members) await ctx.db.patch(row._id, { updatedAt: now });
}

export async function closeEmptyGroup(ctx: MutationCtx, id: Id<"conversations">) {
  const c = await ctx.db.get(id);
  if (c?.kind !== "group") return;
  if (
    await ctx.db
      .query("members")
      .withIndex("by_conversation", (q) => q.eq("conversationId", id))
      .first()
  )
    return;
  // Tombstone atomically denies joins before asynchronous bounded cleanup starts.
  await ctx.db.patch(id, { closed: true });
  await ctx.scheduler.runAfter(0, internal.groupLifecycle.purge, { id });
}

export const purge = internalMutation({
  args: { id: v.id("conversations") },
  handler: async (ctx, { id }) => {
    const c = await ctx.db.get(id);
    if (!c?.closed) return;
    const invites = await ctx.db
      .query("invites")
      .withIndex("by_conversation", (q) => q.eq("conversationId", id))
      .take(50);
    for (const row of invites) await ctx.db.delete(row._id);
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", id))
      .take(10);
    for (const message of messages) {
      const hidden = await ctx.db
        .query("hidden")
        .withIndex("by_message", (q) => q.eq("messageId", message._id))
        .take(100);
      const reactions = await ctx.db
        .query("reactions")
        .withIndex("by_message", (q) => q.eq("messageId", message._id))
        .take(100);
      for (const row of [...hidden, ...reactions]) await ctx.db.delete(row._id);
      if (hidden.length < 100 && reactions.length < 100) await ctx.db.delete(message._id);
    }
    if (invites.length || messages.length)
      await ctx.scheduler.runAfter(0, internal.groupLifecycle.purge, { id });
    else await ctx.db.delete(id);
  },
});
