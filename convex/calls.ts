import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { LIMITS } from "../shared/policy";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, mutation, type QueryCtx, query } from "./_generated/server";
import { actor, blocked, member, publicProfile, quota, readableUser } from "./access";
import { endCall, liveCalls } from "./callLifecycle";

async function owned(ctx: QueryCtx, id: Id<"calls">) {
  const userId = await actor(ctx),
    call = await ctx.db.get(id);
  if (!call || ![call.callerId, call.recipientId].includes(userId))
    throw new ConvexError("FORBIDDEN");
  await member(ctx, call.conversationId);
  return { userId, call };
}
function publicCall(call: Doc<"calls">) {
  const { callerSession: _caller, acceptedSession: _recipient, ...view } = call;
  return view;
}
function sessionOwner(call: Doc<"calls">, userId: Id<"users">, session: string | undefined) {
  if (call.state === "ended") return;
  const expected = userId === call.callerId ? call.callerSession : call.acceptedSession;
  if (!expected || expected !== session) throw new ConvexError("OTHER_SESSION");
}
export const current = query({
  args: {},
  handler: async (ctx) => {
    const userId = await readableUser(ctx);
    if (!userId) return null;
    const call = (await liveCalls(ctx, userId)).find((c) => c.expiresAt > Date.now());
    return call
      ? {
          ...publicCall(call),
          peer: await publicProfile(
            ctx,
            call.callerId === userId ? call.recipientId : call.callerId,
          ),
        }
      : null;
  },
});
export const get = query({
  args: { id: v.id("calls") },
  handler: async (ctx, { id }) => {
    if (!(await getAuthUserId(ctx))) return null;
    const { call, userId } = await owned(ctx, id);
    return {
      ...publicCall(call),
      peer: await publicProfile(ctx, call.callerId === userId ? call.recipientId : call.callerId),
    };
  },
});
export const start = mutation({
  args: {
    conversationId: v.id("conversations"),
    kind: v.union(v.literal("audio"), v.literal("video")),
    session: v.string(),
  },
  handler: async (ctx, args) => {
    const own = await member(ctx, args.conversationId);
    if (!args.session || args.session.length > 100) throw new ConvexError("INVALID_INPUT");
    await quota(ctx, own.userId, "call", 5);
    const c = await ctx.db.get(args.conversationId);
    if (c?.kind !== "dm") throw new ConvexError("DM_ONLY");
    const rows = await ctx.db
      .query("members")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .take(3);
    const peer = rows.find((m) => m.userId !== own.userId);
    if (!peer || (await blocked(ctx, own.userId, peer.userId))) throw new ConvexError("FORBIDDEN");
    for (const uid of [own.userId, peer.userId])
      for (const call of await liveCalls(ctx, uid)) {
        if (call.expiresAt > Date.now()) throw new ConvexError("BUSY");
        await endCall(ctx, call, call.state === "ringing" ? "missed" : "expired");
      }
    const now = Date.now();
    const id = await ctx.db.insert("calls", {
      conversationId: args.conversationId,
      callerId: own.userId,
      callerSession: args.session,
      recipientId: peer.userId,
      kind: args.kind,
      state: "ringing",
      expiresAt: now + LIMITS.ringingMs,
      callerHeartbeat: now,
      recipientHeartbeat: now,
    });
    await ctx.scheduler.runAfter(LIMITS.ringingMs, internal.calls.expire, { id });
    return id;
  },
});
export const accept = mutation({
  args: { id: v.id("calls"), session: v.string() },
  handler: async (ctx, { id, session }) => {
    const { userId, call } = await owned(ctx, id);
    if (await blocked(ctx, call.callerId, call.recipientId)) throw new ConvexError("BLOCKED");
    if (
      userId !== call.recipientId ||
      call.state !== "ringing" ||
      call.expiresAt <= Date.now() ||
      !session ||
      session.length > 100
    )
      throw new ConvexError("INVALID_TRANSITION");
    const now = Date.now();
    await ctx.db.patch(id, {
      state: "active",
      startedAt: now,
      acceptedSession: session,
      callerHeartbeat: now,
      recipientHeartbeat: now,
      expiresAt: now + LIMITS.leaseMs,
    });
  },
});
export const hangup = mutation({
  args: {
    id: v.id("calls"),
    session: v.optional(v.string()),
    reason: v.optional(v.literal("connection-failed")),
  },
  handler: async (ctx, { id, session, reason }) => {
    const { userId, call } = await owned(ctx, id);
    if (call.state === "active" || userId === call.callerId) sessionOwner(call, userId, session);
    await endCall(
      ctx,
      call,
      call.state === "ringing"
        ? userId === call.callerId
          ? "canceled"
          : "declined"
        : (reason ?? "hangup"),
    );
  },
});
export const heartbeat = mutation({
  args: { id: v.id("calls"), session: v.string() },
  handler: async (ctx, { id, session }) => {
    const { userId, call } = await owned(ctx, id);
    if (call.state !== "active" || call.expiresAt <= Date.now())
      throw new ConvexError("EXPIRED_CALL");
    sessionOwner(call, userId, session);
    await quota(ctx, userId, "call-heartbeat", 12);
    const callerHeartbeat = userId === call.callerId ? Date.now() : call.callerHeartbeat,
      recipientHeartbeat = userId === call.recipientId ? Date.now() : call.recipientHeartbeat;
    await ctx.db.patch(id, {
      callerHeartbeat,
      recipientHeartbeat,
      expiresAt: Math.min(callerHeartbeat, recipientHeartbeat) + LIMITS.leaseMs,
    });
  },
});
export const expire = internalMutation({
  args: { id: v.id("calls") },
  handler: async (ctx, { id }) => {
    const call = await ctx.db.get(id);
    if (!call || call.state === "ended") return;
    if (call.expiresAt > Date.now()) {
      await ctx.scheduler.runAfter(call.expiresAt - Date.now(), internal.calls.expire, { id });
      return;
    }
    await endCall(ctx, call, call.state === "ringing" ? "missed" : "expired");
  },
});
export const signal = mutation({
  args: { id: v.id("calls"), body: v.string(), session: v.string() },
  handler: async (ctx, { id, body, session }) => {
    const { userId, call } = await owned(ctx, id);
    sessionOwner(call, userId, session);
    if (call.state === "ended" || call.expiresAt <= Date.now())
      throw new ConvexError("EXPIRED_CALL");
    if (body.length > 32_000) throw new ConvexError("SIGNAL_TOO_LARGE");
    await quota(ctx, userId, "signal", 180);
    const rows = await ctx.db
      .query("signals")
      .withIndex("by_call", (q) => q.eq("callId", id))
      .take(200);
    if (rows.length >= 200) throw new ConvexError("SIGNAL_LIMIT");
    await ctx.db.insert("signals", { callId: id, senderId: userId, body });
  },
});
export const signals = query({
  args: { id: v.id("calls"), session: v.string() },
  handler: async (ctx, { id, session }) => {
    if (!(await getAuthUserId(ctx))) return [];
    const { userId, call } = await owned(ctx, id);
    sessionOwner(call, userId, session);
    return (
      await ctx.db
        .query("signals")
        .withIndex("by_call", (q) => q.eq("callId", id))
        .take(200)
    ).filter((s) => s.senderId !== userId);
  },
});
export const consume = mutation({
  args: { id: v.id("calls"), ids: v.array(v.id("signals")), session: v.string() },
  handler: async (ctx, { id, ids, session }) => {
    const { userId, call } = await owned(ctx, id);
    sessionOwner(call, userId, session);
    if (ids.length > 200) throw new ConvexError("INVALID_INPUT");
    for (const sid of ids) {
      const s = await ctx.db.get(sid);
      if (s && s.callId === id && s.senderId !== userId) await ctx.db.delete(sid);
    }
  },
});
export const reserveTurn = internalMutation({
  args: {},
  handler: async (ctx) => {
    const userId = await actor(ctx);
    await quota(ctx, userId, "turn", 5);
    return userId;
  },
});
