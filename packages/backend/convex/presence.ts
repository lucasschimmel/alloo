import { LIMITS } from "@alloo/shared/policy";
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { actor, member, quota, readableMember } from "./access";
export const heartbeat = mutation({
  args: {
    session: v.string(),
    conversationId: v.optional(v.id("conversations")),
    typing: v.boolean(),
    online: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await actor(ctx);
    if (args.session.length > 100) throw new Error("INVALID_INPUT");
    await quota(ctx, userId, "presence", 120);
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (profile) await ctx.db.patch(profile._id, { lastSeenAt: Date.now() });
    if (args.conversationId) await member(ctx, args.conversationId);
    const sessions = await ctx.db
      .query("presence")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(21);
    for (const stale of sessions) if (stale.expiresAt < Date.now()) await ctx.db.delete(stale._id);
    const old = sessions.find((s) => s.session === args.session && s.expiresAt >= Date.now());
    if (!args.online) {
      if (old) await ctx.db.delete(old._id);
      return;
    }
    const fields = {
      userId,
      session: args.session,
      expiresAt: Date.now() + LIMITS.presenceMs,
      conversationId: args.conversationId,
      typingUntil: args.typing ? Date.now() + LIMITS.typingMs : 0,
    };
    if (old) await ctx.db.patch(old._id, fields);
    else if (sessions.filter((s) => s.expiresAt >= Date.now()).length < 20)
      await ctx.db.insert("presence", fields);
  },
});
export const list = query({
  args: { id: v.id("conversations") },
  handler: async (ctx, { id }) => {
    if (!(await getAuthUserId(ctx))) return [];
    if (!(await readableMember(ctx, id))) return [];
    const members = await ctx.db
      .query("members")
      .withIndex("by_conversation", (q) => q.eq("conversationId", id))
      .take(LIMITS.group);
    return Promise.all(
      members.map(async (m) => {
        const sessions = await ctx.db
          .query("presence")
          .withIndex("by_user", (q) => q.eq("userId", m.userId))
          .take(20);
        return {
          userId: m.userId,
          lastSeenAt: (
            await ctx.db
              .query("profiles")
              .withIndex("by_user", (q) => q.eq("userId", m.userId))
              .unique()
          )?.lastSeenAt,
          expiresAt: Math.max(0, ...sessions.map((s) => s.expiresAt)),
          typingUntil: Math.max(
            0,
            ...sessions.filter((s) => s.conversationId === id).map((s) => s.typingUntil),
          ),
        };
      }),
    );
  },
});
