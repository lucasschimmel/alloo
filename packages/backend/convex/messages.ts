import { messageLabel } from "@alloo/shared/message-label";
import { messageFingerprint } from "@alloo/shared/message-request";
import { boundedPage, cleanText, LIMITS, validReaction } from "@alloo/shared/policy";
import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, type QueryCtx, query } from "./_generated/server";
import { blocked, member, publicProfile, quota, readableMember } from "./access";
import { deleteAttachment } from "./attachmentRecords";

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
    const own = await readableMember(ctx, msg.conversationId);
    if (!own) return null;
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
      if (!(await hidden(ctx, own.userId, m._id)))
        result.push({ _id: m._id, body: messageLabel(m) });
    return result;
  },
});
export const send = mutation({
  args: {
    id: v.id("conversations"),
    expectedUserId: v.optional(v.id("users")),
    body: v.string(),
    operationId: v.string(),
    replyId: v.optional(v.id("messages")),
    attachmentId: v.optional(v.id("attachments")),
  },
  handler: async (ctx, args) => {
    const own = await member(ctx, args.id),
      body = args.attachmentId && !args.body.trim() ? "" : cleanText(args.body, LIMITS.message);
    if (args.expectedUserId && args.expectedUserId !== own.userId)
      throw new ConvexError("FORBIDDEN");
    if (args.operationId.length < 8 || args.operationId.length > 100)
      throw new ConvexError("INVALID_INPUT");
    const fingerprint = await messageFingerprint(args.id, body, args.replyId, args.attachmentId);
    const old = await ctx.db
      .query("messages")
      .withIndex("by_operation", (q) =>
        q.eq("userId", own.userId).eq("operationId", args.operationId),
      )
      .unique();
    if (old) {
      if (
        old.sendFingerprint
          ? old.sendFingerprint !== fingerprint
          : old.conversationId !== args.id ||
            old.body !== body ||
            old.replyId !== args.replyId ||
            old.attachmentId !== args.attachmentId
      )
        throw new ConvexError("CONFLICT");
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
      if (
        !reply ||
        reply.deletedAt !== undefined ||
        reply.conversationId !== args.id ||
        (await hidden(ctx, own.userId, reply._id))
      )
        throw new ConvexError("INVALID_REPLY");
    }
    if (args.attachmentId) {
      const file = await ctx.db.get(args.attachmentId);
      if (
        !file ||
        file.userId !== own.userId ||
        file.conversationId !== args.id ||
        file.messageId ||
        (file.expiresAt ?? 0) <= Date.now()
      )
        throw new ConvexError("INVALID_ATTACHMENT");
    }
    await quota(ctx, own.userId, "message", 60);
    const id = await ctx.db.insert("messages", {
      conversationId: args.id,
      userId: own.userId,
      body,
      operationId: args.operationId,
      sendFingerprint: fingerprint,
      attachmentId: args.attachmentId,
      replyId: args.replyId,
      kind: "text",
      pinned: false,
    });
    if (args.attachmentId)
      await ctx.db.patch(args.attachmentId, { messageId: id, expiresAt: undefined });
    const now = Date.now();
    await ctx.db.patch(args.id, { updatedAt: now });
    for (const m of members) await ctx.db.patch(m._id, { updatedAt: now });
    await ctx.scheduler.runAfter(0, internal.push.fanout, { messageId: id });
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
    if (!msg || msg.deletedAt !== undefined) throw new ConvexError("NOT_FOUND");
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
    if (!msg || msg.deletedAt !== undefined) throw new ConvexError("NOT_FOUND");
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

export const edit = mutation({
  args: { messageId: v.id("messages"), body: v.string(), revision: v.number() },
  handler: async (ctx, { messageId, body: input, revision }) => {
    const msg = await ctx.db.get(messageId);
    if (!msg || msg.deletedAt !== undefined) throw new ConvexError("NOT_FOUND");
    const own = await member(ctx, msg.conversationId);
    if (msg.userId !== own.userId || msg.kind !== "text") throw new ConvexError("FORBIDDEN");
    const body = msg.attachmentId && !input.trim() ? "" : cleanText(input, LIMITS.message);
    if (body === msg.body) return;
    if ((msg.revision ?? 0) !== revision) throw new ConvexError("EDIT_CONFLICT");
    await quota(ctx, own.userId, "edit", 60);
    await ctx.db.patch(messageId, {
      body,
      revision: revision + 1,
      editedAt: Date.now(),
      sendFingerprint:
        msg.sendFingerprint ??
        (await messageFingerprint(msg.conversationId, msg.body, msg.replyId, msg.attachmentId)),
    });
  },
});
export const remove = mutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, { messageId }) => {
    const msg = await ctx.db.get(messageId);
    if (!msg) throw new ConvexError("NOT_FOUND");
    const own = await member(ctx, msg.conversationId);
    if (msg.userId !== own.userId || msg.kind !== "text") throw new ConvexError("FORBIDDEN");
    if (msg.deletedAt !== undefined) return;
    await quota(ctx, own.userId, "delete", 60);
    const reactions = await ctx.db
      .query("reactions")
      .withIndex("by_message", (q) => q.eq("messageId", messageId))
      .take(100);
    for (const row of reactions) await ctx.db.delete(row._id);
    if (msg.attachmentId) await deleteAttachment(ctx, msg.attachmentId);
    await ctx.db.patch(messageId, {
      sendFingerprint:
        msg.sendFingerprint ??
        (await messageFingerprint(msg.conversationId, msg.body, msg.replyId, msg.attachmentId)),
      attachmentId: undefined,
      body: "",
      deletedAt: Date.now(),
      pinned: false,
      replyId: undefined,
    });
  },
});

export const search = query({
  args: { id: v.id("conversations"), text: v.string(), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { id, text, paginationOpts }) => {
    const empty = { page: [], isDone: true, continueCursor: "" };
    const own = await readableMember(ctx, id);
    const term = text.trim();
    if (!own || !term || term.length > 200 || (term.match(/[\p{L}\p{N}]+/gu)?.length ?? 0) > 16)
      return empty;
    const page = await ctx.db
      .query("messages")
      .withSearchIndex("search_body", (q) =>
        q.search("body", term).eq("conversationId", id).eq("kind", "text"),
      )
      .paginate(boundedPage(paginationOpts, 20));
    const rows = [];
    for (const msg of page.page)
      if (msg.deletedAt === undefined && !(await hidden(ctx, own.userId, msg._id)))
        rows.push(await decorate(ctx, own.userId, msg));
    return { ...page, page: rows };
  },
});

export const receipt = query({
  args: {
    id: v.id("conversations"),
    expectedUserId: v.id("users"),
    operationId: v.string(),
    body: v.string(),
    replyId: v.optional(v.id("messages")),
    attachmentId: v.optional(v.id("attachments")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId !== args.expectedUserId) throw new ConvexError("UNAUTHENTICATED");
    const old = await ctx.db
      .query("messages")
      .withIndex("by_operation", (q) =>
        q.eq("userId", args.expectedUserId).eq("operationId", args.operationId),
      )
      .unique();
    if (!old) return null;
    const fingerprint = await messageFingerprint(
      args.id,
      args.body.trim(),
      args.replyId,
      args.attachmentId,
    );
    if (old.sendFingerprint !== fingerprint) throw new ConvexError("CONFLICT");
    return old._id;
  },
});
