import { messageLabel } from "@alloo/shared/message-label";
import type { Doc, Id } from "../convex/_generated/dataModel";
import type { QueryCtx } from "../convex/_generated/server";
import { publicProfile } from "../convex/access";

export async function hidden(ctx: QueryCtx, userId: Id<"users">, id: Id<"messages">) {
  return !!(await ctx.db
    .query("hidden")
    .withIndex("by_pair", (q) => q.eq("userId", userId).eq("messageId", id))
    .unique());
}
export async function decorate(ctx: QueryCtx, userId: Id<"users">, msg: Doc<"messages">) {
  const reply = msg.replyId ? await ctx.db.get(msg.replyId) : null;
  const quote =
    reply && reply.conversationId === msg.conversationId && !(await hidden(ctx, userId, reply._id))
      ? { id: reply._id, body: messageLabel(reply) }
      : null;
  const reactions = await ctx.db
    .query("reactions")
    .withIndex("by_message", (q) => q.eq("messageId", msg._id))
    .take(100);
  const { sendFingerprint: _fingerprint, ...visible } = msg;
  return {
    ...visible,
    body: msg.kind === "text" && msg.deletedAt === undefined ? msg.body : messageLabel(msg),
    author: await publicProfile(ctx, msg.userId),
    quote,
    attachment:
      msg.attachmentId && msg.deletedAt === undefined
        ? await attachmentMetadata(ctx, msg.attachmentId)
        : null,
    reactions: [...new Set(reactions.map((r) => r.emoji))]
      .map((emoji) => ({
        emoji,
        count: reactions.filter((r) => r.emoji === emoji).length,
        mine: reactions.some((r) => r.emoji === emoji && r.userId === userId),
      }))
      .filter((r) => r.count),
  };
}
async function attachmentMetadata(ctx: QueryCtx, id: Id<"attachments">) {
  const file = await ctx.db.get(id);
  return file ? { id: file._id, name: file.name, size: file.size } : null;
}
