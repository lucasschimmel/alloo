import { LIMITS } from "@alloo/shared/policy";
import { ConvexError } from "convex/values";
import type { Id } from "../convex/_generated/dataModel";
import type { MutationCtx } from "../convex/_generated/server";
import { actor, admin, blocked, quota } from "../convex/access";
import { groupEvent } from "../convex/groupLifecycle";

export async function revokeInvite(ctx: MutationCtx, { id }: { id: Id<"conversations"> }) {
  await admin(ctx, id);
  const rows = await ctx.db
    .query("invites")
    .withIndex("by_conversation", (q) => q.eq("conversationId", id))
    .take(100);
  for (const row of rows) await ctx.db.delete(row._id);
}

export async function createInvite(
  ctx: MutationCtx,
  { id, code }: { id: Id<"conversations">; code: string },
) {
  const own = await admin(ctx, id);
  await quota(ctx, own.userId, "invite", 10);
  if (!/^[a-f0-9]{32}$/.test(code)) throw new ConvexError("INVALID_INPUT");
  const old = await ctx.db
    .query("invites")
    .withIndex("by_conversation", (q) => q.eq("conversationId", id))
    .take(100);
  for (const row of old) await ctx.db.delete(row._id);
  await ctx.db.insert("invites", {
    conversationId: id,
    code,
    expiresAt: Date.now() + LIMITS.inviteMs,
    revoked: false,
  });
  return code;
}

export async function join(ctx: MutationCtx, { code }: { code: string }) {
  const userId = await actor(ctx);
  await quota(ctx, userId, "join", 15);
  const invite = await ctx.db
    .query("invites")
    .withIndex("by_code", (q) => q.eq("code", code))
    .unique();
  if (!invite || invite.revoked || invite.expiresAt <= Date.now())
    throw new ConvexError("EXPIRED_INVITE");
  const conversation = await ctx.db.get(invite.conversationId);
  if (!conversation || conversation.closed || conversation.kind !== "group")
    throw new ConvexError("EXPIRED_INVITE");
  const rows = await ctx.db
    .query("members")
    .withIndex("by_conversation", (q) => q.eq("conversationId", invite.conversationId))
    .take(LIMITS.group);
  const liveProfiles = await Promise.all(
    rows.map((m) =>
      ctx.db
        .query("profiles")
        .withIndex("by_user", (q) => q.eq("userId", m.userId))
        .unique(),
    ),
  );
  if (!liveProfiles.some((p) => p && !p.deleted) || !rows.some((m) => m.role === "admin"))
    throw new ConvexError("EXPIRED_INVITE");
  if (rows.some((m) => m.userId === userId)) return invite.conversationId;
  if (rows.length >= LIMITS.group) throw new ConvexError("GROUP_FULL");
  for (const row of rows)
    if (await blocked(ctx, userId, row.userId)) throw new ConvexError("BLOCKED");
  await ctx.db.insert("members", {
    conversationId: invite.conversationId,
    userId,
    role: "member",
    readAt: 0,
    updatedAt: Date.now(),
  });
  await groupEvent(ctx, invite.conversationId, userId, "joined");
  return invite.conversationId;
}
