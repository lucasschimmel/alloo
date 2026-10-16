import { getAuthSessionId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { PUSH, validPushSubscription } from "../shared/push";
import { internal } from "./_generated/api";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { actor, blocked, member, readableMember, readableUser } from "./access";

export const configuration = query({
  args: {},
  handler: async (ctx) => {
    if (!(await readableUser(ctx))) return null;
    return process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT
      ? (process.env.VAPID_PUBLIC_KEY ?? null)
      : null;
  },
});
export const register = mutation({
  args: {
    endpoint: v.string(),
    p256dh: v.string(),
    auth: v.string(),
    binding: v.string(),
    expectedUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await actor(ctx),
      sessionId = await getAuthSessionId(ctx);
    if (
      !sessionId ||
      !validPushSubscription(args.endpoint, args.p256dh, args.auth) ||
      !/^[a-f0-9-]{36}$/.test(args.binding)
    )
      throw new ConvexError("INVALID_INPUT");
    if (args.expectedUserId !== userId) throw new ConvexError("FORBIDDEN");
    const { expectedUserId: _expected, ...subscription } = args;
    const session = await ctx.db.get(sessionId);
    if (!session || session.userId !== userId || session.expirationTime <= Date.now())
      throw new ConvexError("UNAUTHENTICATED");
    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint))
      .unique();
    if (existing && existing.userId !== userId) throw new ConvexError("FORBIDDEN");
    if (existing) {
      await ctx.db.replace(existing._id, { ...subscription, userId, sessionId });
      return;
    }
    const devices = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(PUSH.devices);
    let activeDevices = 0;
    for (const device of devices) {
      const previous = await ctx.db.get(device.sessionId);
      if (!previous || previous.expirationTime <= Date.now()) await ctx.db.delete(device._id);
      else activeDevices++;
    }
    if (activeDevices >= PUSH.devices) throw new ConvexError("DEVICE_LIMIT");
    await ctx.db.insert("pushSubscriptions", { ...subscription, userId, sessionId });
  },
});
export const unregister = mutation({
  args: { endpoint: v.string() },
  handler: async (ctx, { endpoint }) => {
    const userId = await actor(ctx);
    const row = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", endpoint))
      .unique();
    if (row?.userId === userId) await ctx.db.delete(row._id);
  },
});
export const preference = query({
  args: { id: v.id("conversations") },
  handler: async (ctx, { id }) => (await readableMember(ctx, id))?.muted ?? false,
});
export const mute = mutation({
  args: { id: v.id("conversations"), muted: v.boolean() },
  handler: async (ctx, { id, muted }) => {
    const own = await member(ctx, id);
    await ctx.db.patch(own._id, { muted });
  },
});
export const fanout = internalMutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, { messageId }) => {
    const msg = await ctx.db.get(messageId);
    if (!msg || msg.deletedAt !== undefined) return;
    const members = await ctx.db
      .query("members")
      .withIndex("by_conversation", (q) => q.eq("conversationId", msg.conversationId))
      .take(100);
    for (const m of members) {
      if (m.userId === msg.userId || m.muted) continue;
      const devices = await ctx.db
        .query("pushSubscriptions")
        .withIndex("by_user", (q) => q.eq("userId", m.userId))
        .take(PUSH.devices);
      for (const device of devices)
        await ctx.scheduler.runAfter(0, internal.pushDelivery.deliver, {
          messageId,
          subscriptionId: device._id,
          binding: device.binding,
          attempt: 0,
        });
    }
  },
});
export const eligible = internalQuery({
  args: {
    messageId: v.id("messages"),
    subscriptionId: v.id("pushSubscriptions"),
    binding: v.string(),
  },
  handler: async (ctx, { messageId, subscriptionId, binding }) => {
    const sub = await ctx.db.get(subscriptionId),
      msg = await ctx.db.get(messageId);
    if (
      !sub ||
      sub.binding !== binding ||
      !msg ||
      msg.deletedAt !== undefined ||
      msg.userId === sub.userId
    )
      return null;
    const session = await ctx.db.get(sub.sessionId);
    if (!session || session.expirationTime <= Date.now()) return null;
    for (const userId of [sub.userId, msg.userId]) {
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique();
      const membership = await ctx.db
        .query("members")
        .withIndex("by_pair", (q) =>
          q.eq("conversationId", msg.conversationId).eq("userId", userId),
        )
        .unique();
      if (
        !profile ||
        profile.deleted ||
        !membership ||
        (userId === sub.userId && (membership.muted || membership.readAt >= msg._creationTime))
      )
        return null;
    }
    if (await blocked(ctx, sub.userId, msg.userId)) return null;
    if (
      await ctx.db
        .query("hidden")
        .withIndex("by_pair", (q) => q.eq("userId", sub.userId).eq("messageId", messageId))
        .unique()
    )
      return null;
    return { sub, conversationId: msg.conversationId };
  },
});
export const prune = internalMutation({
  args: { id: v.id("pushSubscriptions"), binding: v.string() },
  handler: async (ctx, { id, binding }) => {
    const row = await ctx.db.get(id);
    if (row?.binding === binding) await ctx.db.delete(id);
  },
});
