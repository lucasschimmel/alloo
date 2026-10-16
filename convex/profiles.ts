import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { cleanText, LIMITS, username } from "../shared/policy";
import { providerAvatar } from "../shared/provider-avatar";
import { mutation, query } from "./_generated/server";
import { actor, publicProfile, quota } from "./access";

export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    return { userId, profile };
  },
});
export const save = mutation({
  args: { name: v.string(), username: v.string(), bio: v.string() },
  handler: async (ctx, args) => {
    const userId = await actor(ctx);
    await quota(ctx, userId, "profile", 15);
    const handle = username(args.username),
      name = cleanText(args.name, LIMITS.name);
    if (args.bio.length > LIMITS.bio) throw new ConvexError("INVALID_INPUT");
    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_username", (q) => q.eq("username", handle))
      .unique();
    if (existing && existing.userId !== userId) throw new ConvexError("USERNAME_TAKEN");
    const current = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    const fields = { userId, name, username: handle, bio: args.bio.trim() };
    if (current) await ctx.db.patch(current._id, fields);
    else await ctx.db.insert("profiles", fields);
  },
});
export const search = query({
  args: { term: v.string() },
  handler: async (ctx, { term }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId || term.trim().length < 2) return [];
    const prefix = term.trim().toLowerCase().slice(0, 24);
    const rows = await ctx.db
      .query("profiles")
      .withIndex("by_username", (q) => q.gte("username", prefix).lt("username", `${prefix}\uffff`))
      .take(20);
    return Promise.all(
      rows
        .filter((p) => p.userId !== userId && !p.deleted)
        .map((p) => publicProfile(ctx, p.userId)),
    );
  },
});
export const avatar = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    if (!(await getAuthUserId(ctx))) return null;
    const p = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (!p || p.deleted) return null;
    // Uploaded bytes use an authenticated action; provider images use a restricted HTTPS allowlist.
    return {
      storageId: p.avatar ?? null,
      providerUrl: p.avatar ? null : providerAvatar((await ctx.db.get(userId))?.image),
    };
  },
});
