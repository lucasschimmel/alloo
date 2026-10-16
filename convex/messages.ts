import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { messageLabel } from "../shared/message-label";
import { boundedPage, cleanText, LIMITS, validReaction } from "../shared/policy";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, type QueryCtx, query } from "./_generated/server";
import { blocked, member, publicProfile, quota, readableMember } from "./access";

async function hidden(ctx: QueryCtx, userId: Id<"users">, id: Id<"messages">) {
  return !!(await ctx.db
    .query("hidden")
    .withIndex("by_pair", (q) => q.eq("userId", userId).eq("messageId", id))
    .unique());
}
async function decorate(ctx: QueryCtx, userId: Id<"users">, msg: Doc<"messages">) {
  const reply = msg.replyId ? await ctx.db.get(msg.replyId) : null;
  const quote =
    reply && reply.conversationId === msg.conversationId && !(await hidden(ctx, userId, reply._id))
      ? { id: reply._id, body: messageLabel(reply) }
      : null;
  const reactions = await ctx.db
    .query("reactions")
    .withIndex("by_message", (q) => q.eq("messageId", msg._id))
    .take(100);
  return {
    ...msg,
    body: messageLabel(msg),
    author: await publicProfile(ctx, msg.userId),
    quote,
    reactions: [...new Set(reactions.map((r) => r.emoji))]
      .map((emoji) => ({
        emoji,
        count: reactions.filter((r) => r.emoji === emoji).length,
        mine: reactions.some((r) => r.emoji === emoji && r.userId === userId),
      }))
      .filter((r) => r.count),
  };
}
export const list = query({
  args: { id: v.id("conversations"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    if (!(await getAuthUserId(ctx))) return { page: [], isDone: true, continueCursor: "" };
    const own = await readableMember(ctx, args.id);
    if (!own) return { page: [], isDone: true, continueCursor: "" };
    const page = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.id))
      .order("desc")
      .paginate(boundedPage(args.paginationOpts));
    const rows = [];
    for (const msg of page.page)
      if (!(await hidden(ctx, own.userId, msg._id)))
        rows.push(await decorate(ctx, own.userId, msg));
    return { ...page, page: rows };
  },
});
export const anchor = query({
  args: { messageId: v.id("messages") },
  handler: async (ctx, { messageId }) => {
    if (!(await getAuthUserId(ctx))) return null;
    const msg = await ctx.db.get(messageId);
    if (!msg) return null;
    const own = await member(ctx, msg.conversationId);
    return (await hidden(ctx, own.userId, msg._id)) ? null : await decorate(ctx, own.userId, msg);
  },
});
export const pins = query({
  args: { id: v.id("conversations") },
  handler: async (ctx, { id }) => {
    if (!(await getAuthUserId(ctx))) return [];
    const own = await readableMember(ctx, id);
    if (!own) return [];
    // Pin count is capped at 10; index added below keeps history-independent work.
    const rows = await ctx.db
      .query("messages")
      .withIndex("by_pinned", (q) => q.eq("conversationId", id).eq("pinned", true))
      .take(10);
    const result = [];
    for (const m of rows)
      if (!(await hidden(ctx, own.userId, m._id))) result.push({ ...m, body: messageLabel(m) });
    return result;
  },
});
export const send = mutation({
  args: {
    id: v.id("conversations"),
    body: v.string(),
    operationId: v.string(),
    replyId: v.optional(v.id("messages")),
  },
  handler: async (ctx, args) => {
    const own = await member(ctx, args.id),
      body = cleanText(args.body, LIMITS.message);
    if (args.operationId.length < 8 || args.operationId.length > 100)
      throw new ConvexError("INVALID_INPUT");
    const old = await ctx.db
      .query("messages")
      .withIndex("by_operation", (q) =>
        q.eq("userId", own.userId).eq("operationId", args.operationId),
      )
      .unique();
    if (old) {
      if (old.conversationId !== args.id || old.body !== body) throw new ConvexError("CONFLICT");
      return old._id;
    }
    const c = await ctx.db.get(args.id);
    const members = await ctx.db
      .query("members")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.id))
      .take(LIMITS.group);
    if (c?.kind === "dm")
      for (const m of members)
        if (await blocked(ctx, own.userId, m.userId)) throw new ConvexError("BLOCKED");
    if (args.replyId) {
      const reply = await ctx.db.get(args.replyId);
      if (!reply || reply.conversationId !== args.id || (await hidden(ctx, own.userId, reply._id)))
        throw new ConvexError("INVALID_REPLY");
    }
    await quota(ctx, own.userId, "message", 60);
    const id = await ctx.db.insert("messages", {
      conversationId: args.id,
      userId: own.userId,
      body,
      operationId: args.operationId,
      replyId: args.replyId,
      kind: "text",
      pinned: false,
    });
    const now = Date.now();
    await ctx.db.patch(args.id, { updatedAt: now });
    for (const m of members) await ctx.db.patch(m._id, { updatedAt: now });
    return id;
  },
});
export const markRead = mutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, { messageId }) => {
    const msg = await ctx.db.get(messageId);
    if (!msg) return;
    const own = await member(ctx, msg.conversationId);
    if (!(await hidden(ctx, own.userId, msg._id)))
      await ctx.db.patch(own._id, { readAt: Math.max(own.readAt, msg._creationTime) });
  },
});
export const hide = mutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, { messageId }) => {
    const msg = await ctx.db.get(messageId);
    if (!msg) return;
    const own = await member(ctx, msg.conversationId);
    if (!(await hidden(ctx, own.userId, messageId)))
      await ctx.db.insert("hidden", { userId: own.userId, messageId });
  },
});
export const react = mutation({
  args: { messageId: v.id("messages"), emoji: v.string() },
  handler: async (ctx, { messageId, emoji }) => {
    if (!validReaction(emoji)) throw new ConvexError("INVALID_REACTION");
    const msg = await ctx.db.get(messageId);
    if (!msg) throw new ConvexError("NOT_FOUND");
    const own = await member(ctx, msg.conversationId);
    await quota(ctx, own.userId, "reaction", 60);
    if (await hidden(ctx, own.userId, messageId)) throw new ConvexError("NOT_FOUND");
    const rows = await ctx.db
      .query("reactions")
      .withIndex("by_message", (q) => q.eq("messageId", messageId))
      .take(100);
    const old = rows.find((r) => r.userId === own.userId && r.emoji === emoji);
    if (old) return void (await ctx.db.delete(old._id));
    if (rows.length >= 100 || rows.filter((r) => r.userId === own.userId).length >= 3)
      throw new ConvexError("REACTION_LIMIT");
    await ctx.db.insert("reactions", { messageId, userId: own.userId, emoji });
  },
});
export const pin = mutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, { messageId }) => {
    const msg = await ctx.db.get(messageId);
    if (!msg) throw new ConvexError("NOT_FOUND");
    const own = await member(ctx, msg.conversationId),
      c = await ctx.db.get(msg.conversationId);
    if (c?.kind === "group" && own.role !== "admin") throw new ConvexError("FORBIDDEN");
    if (!msg.pinned) {
      const pins = await ctx.db
        .query("messages")
        .withIndex("by_pinned", (q) =>
          q.eq("conversationId", msg.conversationId).eq("pinned", true),
        )
        .take(10);
      if (pins.length >= 10) throw new ConvexError("PIN_LIMIT");
    }
    await ctx.db.patch(messageId, { pinned: !msg.pinned });
  },
});
