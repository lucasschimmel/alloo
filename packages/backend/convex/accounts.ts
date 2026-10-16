import { cleanText, LIMITS } from "@alloo/shared/policy";
import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { boundedPage } from "../src/pagination";
import { internal } from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";
import { actor, quota } from "./access";
import { endCall, liveCalls } from "./callLifecycle";
import { closeEmptyGroup, groupEvent } from "./groupLifecycle";
export const block = mutation({
  args: { targetId: v.id("users"), blocked: v.boolean() },
  handler: async (ctx, { targetId, blocked }) => {
    const userId = await actor(ctx);
    if (targetId === userId) throw new ConvexError("INVALID_INPUT");
    await quota(ctx, userId, "block", 30);
    const row = await ctx.db
      .query("blocks")
      .withIndex("by_pair", (q) => q.eq("userId", userId).eq("targetId", targetId))
      .unique();
    if (blocked && !row) {
      const rows = await ctx.db
        .query("blocks")
        .withIndex("by_pair", (q) => q.eq("userId", userId))
        .take(LIMITS.blocks);
      if (rows.length >= LIMITS.blocks) throw new ConvexError("BLOCK_LIMIT");
      await ctx.db.insert("blocks", { userId, targetId });
    } else if (!blocked && row) await ctx.db.delete(row._id);
    if (blocked)
      for (const call of await liveCalls(ctx, userId))
        if (call.callerId === targetId || call.recipientId === targetId)
          await endCall(ctx, call, "connection-failed");
  },
});
export const isBlocked = query({
  args: { targetId: v.id("users") },
  handler: async (ctx, { targetId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return false;
    return !!(await ctx.db
      .query("blocks")
      .withIndex("by_pair", (q) => q.eq("userId", userId).eq("targetId", targetId))
      .unique());
  },
});
export const report = mutation({
  args: { targetId: v.id("users"), reason: v.string() },
  handler: async (ctx, { targetId, reason }) => {
    const userId = await actor(ctx);
    await quota(ctx, userId, "report", 5);
    await ctx.db.insert("reports", {
      userId,
      targetId,
      reason: cleanText(reason, 1000),
      status: "open",
    });
  },
});
export const exportPage = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const userId = await actor(ctx);
    return ctx.db
      .query("messages")
      .withIndex("by_author", (q) => q.eq("userId", userId))
      .paginate(boundedPage(args.paginationOpts));
  },
});
export const remove = mutation({
  args: { confirmation: v.string() },
  handler: async (ctx, { confirmation }) => {
    if (confirmation !== "SUPPRIMER") throw new ConvexError("INVALID_CONFIRMATION");
    const userId = await actor(ctx),
      p = await ctx.db
        .query("profiles")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique();
    if (p) {
      if (p.avatar) await ctx.storage.delete(p.avatar);
      await ctx.db.patch(p._id, {
        deleted: true,
        name: "Compte supprimé",
        username: `deleted_${p._id}`,
        bio: "",
        avatar: undefined,
      });
    }
    if (!p)
      await ctx.db.insert("profiles", {
        userId,
        deleted: true,
        name: "Compte supprimé",
        username: `deleted_${userId}`,
        bio: "",
      });
    const subscriptions = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(5);
    for (const sub of subscriptions) await ctx.db.delete(sub._id);
    for (const call of await liveCalls(ctx, userId)) await endCall(ctx, call, "connection-failed");
    await ctx.scheduler.runAfter(0, internal.accounts.cleanup, { userId });
  },
});
export const cleanup = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const memberships = await ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(10);
    for (const own of memberships) {
      const isGroup = (await ctx.db.get(own.conversationId))?.kind === "group";
      if (own.role === "admin") {
        const others = await ctx.db
          .query("members")
          .withIndex("by_conversation", (q) => q.eq("conversationId", own.conversationId))
          .take(LIMITS.group);
        const next = others.find((x) => x.userId !== userId);
        if (next && !others.some((x) => x.userId !== userId && x.role === "admin")) {
          await ctx.db.patch(next._id, { role: "admin" });
          if (isGroup) await groupEvent(ctx, own.conversationId, userId, "promoted", next.userId);
        }
      }
      await ctx.db.delete(own._id);
      if (isGroup) await groupEvent(ctx, own.conversationId, userId, "left");
      await closeEmptyGroup(ctx, own.conversationId);
    }
    if (memberships.length) {
      await ctx.scheduler.runAfter(0, internal.accounts.cleanup, { userId });
      return;
    }
    const sessions = await ctx.db
      .query("authSessions")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .take(20);
    for (const session of sessions) {
      const refresh = await ctx.db
        .query("authRefreshTokens")
        .withIndex("sessionId", (q) => q.eq("sessionId", session._id))
        .take(50);
      for (const row of refresh) await ctx.db.delete(row._id);
      if (refresh.length === 50) {
        await ctx.scheduler.runAfter(0, internal.accounts.cleanup, { userId });
        return;
      }
      await ctx.db.delete(session._id);
    }
    if (sessions.length) {
      await ctx.scheduler.runAfter(0, internal.accounts.cleanup, { userId });
      return;
    }
    const presence = await ctx.db
      .query("presence")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(20);
    for (const row of presence) await ctx.db.delete(row._id);
    const accounts = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))
      .take(10);
    for (const account of accounts) {
      const codes = await ctx.db
        .query("authVerificationCodes")
        .withIndex("accountId", (q) => q.eq("accountId", account._id))
        .take(50);
      for (const code of codes) await ctx.db.delete(code._id);
      if (codes.length === 50) {
        await ctx.scheduler.runAfter(0, internal.accounts.cleanup, { userId });
        return;
      }
      await ctx.db.delete(account._id);
    }
    if (accounts.length || presence.length === 20)
      await ctx.scheduler.runAfter(0, internal.accounts.cleanup, { userId });
    const user = await ctx.db.get(userId);
    if (user)
      await ctx.db.patch(userId, {
        name: undefined,
        email: undefined,
        image: undefined,
        phone: undefined,
      });
  },
});
