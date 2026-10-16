import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { actor, quota } from "./access";
export const reserve = internalMutation({
  args: {},
  handler: async (ctx) => {
    const userId = await actor(ctx);
    await quota(ctx, userId, "avatar", 5);
    return userId;
  },
});
export const commit = internalMutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    const userId = await actor(ctx),
      p = await ctx.db
        .query("profiles")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique();
    if (!p) throw new ConvexError("PROFILE_REQUIRED");
    await ctx.db.patch(p._id, { avatar: storageId });
    if (p.avatar) await ctx.storage.delete(p.avatar);
  },
});
export const owned = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await actor(ctx);
    const p = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    return p?.deleted ? null : (p?.avatar ?? null);
  },
});
