import { ConvexError, v } from "convex/values";
import { attachmentName } from "../shared/attachments";
import { LIMITS } from "../shared/policy";
import type { Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  type MutationCtx,
  mutation,
  query,
} from "./_generated/server";
import { actor, blocked, member, quota } from "./access";
export const endpoint = query({ args: {}, handler: () => process.env.CONVEX_SITE_URL ?? null });
export const reserve = internalMutation({
  args: { id: v.id("conversations") },
  handler: async (ctx, { id }) => {
    const own = await member(ctx, id);
    if ((await ctx.db.get(id))?.kind === "dm") {
      const members = await ctx.db
        .query("members")
        .withIndex("by_conversation", (q) => q.eq("conversationId", id))
        .take(2);
      for (const other of members)
        if (await blocked(ctx, own.userId, other.userId)) throw new ConvexError("BLOCKED");
    }
    await quota(ctx, own.userId, "attachment", 20, LIMITS.attachmentExpiryMs);
  },
});
export const commit = internalMutation({
  args: { id: v.id("conversations"), storageId: v.id("_storage"), name: v.string() },
  handler: async (ctx, { id, storageId, name }) => {
    const own = await member(ctx, id);
    const file = await ctx.db.system.get(storageId);
    if (!file?.size || file.size > LIMITS.attachmentBytes)
      throw new ConvexError("INVALID_ATTACHMENT");
    return ctx.db.insert("attachments", {
      userId: own.userId,
      conversationId: id,
      storageId,
      name: attachmentName(name),
      size: file.size,
      expiresAt: Date.now() + LIMITS.attachmentExpiryMs,
    });
  },
});
export const readable = internalQuery({
  args: { id: v.id("attachments") },
  handler: async (ctx, { id }) => {
    const file = await ctx.db.get(id);
    if (!file?.messageId) throw new ConvexError("NOT_FOUND");
    const own = await member(ctx, file.conversationId);
    const messageId = file.messageId;
    const message = await ctx.db.get(messageId);
    const hidden = await ctx.db
      .query("hidden")
      .withIndex("by_pair", (q) => q.eq("userId", own.userId).eq("messageId", messageId))
      .unique();
    if (!message || message.deletedAt !== undefined || message.attachmentId !== id || hidden)
      throw new ConvexError("NOT_FOUND");
    return file;
  },
});
export async function deleteAttachment(ctx: MutationCtx, id: Id<"attachments">) {
  const file = await ctx.db.get(id);
  if (!file) return;
  await ctx.storage.delete(file.storageId);
  await ctx.db.delete(id);
}
export const discard = mutation({
  args: { id: v.id("attachments") },
  handler: async (ctx, { id }) => {
    const userId = await actor(ctx),
      file = await ctx.db.get(id);
    if (!file) return;
    if (file.userId !== userId) throw new ConvexError("FORBIDDEN");
    // An uncertain send may already have committed: never erase its live file.
    if (!file.messageId) await deleteAttachment(ctx, id);
  },
});
