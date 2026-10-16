import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

export async function actor(ctx: QueryCtx) {
  const id = await getAuthUserId(ctx);
  if (!id) throw new ConvexError("UNAUTHENTICATED");
  const profile = await ctx.db
    .query("profiles")
    .withIndex("by_user", (q) => q.eq("userId", id))
    .unique();
  if (profile?.deleted) throw new ConvexError("ACCOUNT_DELETED");
  return id;
}
export async function member(ctx: QueryCtx, conversationId: Id<"conversations">) {
  const userId = await actor(ctx);
  const row = await ctx.db
    .query("members")
    .withIndex("by_pair", (q) => q.eq("conversationId", conversationId).eq("userId", userId))
    .unique();
  if (!row) throw new ConvexError("FORBIDDEN");
  return row;
}
// Reactive reads must tolerate access being revoked while a screen is mounted.
export async function readableMember(ctx: QueryCtx, conversationId: Id<"conversations">) {
  const userId = await getAuthUserId(ctx);
  if (!userId) return null;
  const profile = await ctx.db
    .query("profiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  if (profile?.deleted) return null;
  return ctx.db
    .query("members")
    .withIndex("by_pair", (q) => q.eq("conversationId", conversationId).eq("userId", userId))
    .unique();
}
export async function admin(ctx: QueryCtx, conversationId: Id<"conversations">) {
  const row = await member(ctx, conversationId);
  if (row.role !== "admin") throw new ConvexError("FORBIDDEN");
  return row;
}
export async function publicProfile(ctx: QueryCtx, userId: Id<"users">) {
  const row = await ctx.db
    .query("profiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  return {
    userId,
    name: row?.deleted ? "Compte supprimé" : (row?.name ?? "Membre"),
    username: row?.deleted ? "" : (row?.username ?? ""),
    bio: row?.deleted ? "" : (row?.bio ?? ""),
    hasAvatar: !!row?.avatar && !row?.deleted,
  };
}
export async function blocked(ctx: QueryCtx, a: Id<"users">, b: Id<"users">) {
  const rows = await Promise.all(
    [
      [a, b],
      [b, a],
    ].map(([userId, targetId]) =>
      ctx.db
        .query("blocks")
        .withIndex("by_pair", (q) => q.eq("userId", userId).eq("targetId", targetId))
        .unique(),
    ),
  );
  return rows.some(Boolean);
}
export async function quota(
  ctx: MutationCtx,
  userId: Id<"users">,
  key: string,
  maximum: number,
  windowMs = 60_000,
) {
  const row = await ctx.db
    .query("quotas")
    .withIndex("by_pair", (q) => q.eq("userId", userId).eq("key", key))
    .unique();
  const now = Date.now();
  if (!row) return void (await ctx.db.insert("quotas", { userId, key, at: now, count: 1 }));
  if (now - row.at >= windowMs) return void (await ctx.db.patch(row._id, { at: now, count: 1 }));
  if (row.count >= maximum) throw new ConvexError("RATE_LIMITED");
  await ctx.db.patch(row._id, { count: row.count + 1 });
}
