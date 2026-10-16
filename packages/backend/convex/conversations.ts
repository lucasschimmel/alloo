import { messageLabel } from "@alloo/shared/message-label";
import { boundedPage, canonicalPair, cleanText, LIMITS } from "@alloo/shared/policy";
import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  actor,
  admin,
  assertCompatibleMembers,
  blocked,
  member,
  publicProfile,
  quota,
  readableMember,
  readableUser,
} from "./access";

import { closeEmptyGroup, groupEvent } from "./groupLifecycle";

export const list = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const userId = await readableUser(ctx);
    if (!userId) return { page: [], isDone: true, continueCursor: "" };
    const page = await ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .paginate({
        ...boundedPage(args.paginationOpts, LIMITS.conversationPage),
        // Nested history scans can read 100 full messages per membership.
        // Cap rows even when reactive pagination supplies an expanded endCursor.
        maximumRowsRead: LIMITS.conversationPage,
      });
    const rows = await Promise.all(
      page.page.map(async (m) => {
        const c = await ctx.db.get(m.conversationId);
        if (!c) return null;
        const members = await ctx.db
          .query("members")
          .withIndex("by_conversation", (q) => q.eq("conversationId", c._id))
          .take(LIMITS.group);
        const peer = members.find((x) => x.userId !== userId);
        const profile = peer ? await publicProfile(ctx, peer.userId) : null;
        const recent = await ctx.db
          .query("messages")
          .withIndex("by_conversation", (q) => q.eq("conversationId", c._id))
          .order("desc")
          .take(100);
        const visible = [];
        for (const msg of recent)
          if (
            !(await ctx.db
              .query("hidden")
              .withIndex("by_pair", (q) => q.eq("userId", userId).eq("messageId", msg._id))
              .unique())
          )
            visible.push(msg);
        return {
          ...c,
          title: c.kind === "dm" ? (profile?.name ?? "Conversation") : c.title,
          peerId: c.kind === "dm" ? peer?.userId : undefined,
          preview: visible[0] ? messageLabel(visible[0]) : "Votre conversation commence ici",
          unread: visible.filter((x) => x._creationTime > m.readAt && x.userId !== userId).length,
          role: m.role,
        };
      }),
    );
    return { ...page, page: rows.filter((r) => r !== null) };
  },
});
export const details = query({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("conversations", args.id);
    if (!id) return null;
    if (!(await getAuthUserId(ctx))) return null;
    const own = await readableMember(ctx, id);
    if (!own) return null;
    const c = await ctx.db.get(id);
    if (!c || c.closed) return null;
    const rows = await ctx.db
      .query("members")
      .withIndex("by_conversation", (q) => q.eq("conversationId", id))
      .take(LIMITS.group);
    const invite =
      own.role === "admin"
        ? await ctx.db
            .query("invites")
            .withIndex("by_conversation", (q) => q.eq("conversationId", id))
            .first()
        : null;
    return {
      ...c,
      invite:
        invite && !invite.revoked && invite.expiresAt > Date.now()
          ? { code: invite.code, expiresAt: invite.expiresAt }
          : null,
      role: own.role,
      members: await Promise.all(
        rows.map(async (m) => ({
          ...(await publicProfile(ctx, m.userId)),
          role: m.role,
          readAt: m.readAt,
        })),
      ),
    };
  },
});
export const createDM = mutation({
  args: { targetId: v.id("users") },
  handler: async (ctx, { targetId }) => {
    const userId = await actor(ctx),
      pair = canonicalPair(userId, targetId);
    if (await blocked(ctx, userId, targetId)) throw new ConvexError("BLOCKED");
    const target = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", targetId))
      .unique();
    if (!target || target.deleted) throw new ConvexError("NOT_FOUND");
    const existing = await ctx.db
      .query("conversations")
      .withIndex("by_pair", (q) => q.eq("pair", pair))
      .unique();
    if (existing) return existing._id;
    await quota(ctx, userId, "conversation", 10);
    const now = Date.now();
    const id = await ctx.db.insert("conversations", {
      kind: "dm",
      title: "",
      pair,
      updatedAt: now,
    });
    for (const uid of [userId, targetId])
      await ctx.db.insert("members", {
        conversationId: id,
        userId: uid,
        role: "member",
        readAt: 0,
        updatedAt: now,
      });
    return id;
  },
});
export const createGroup = mutation({
  args: { title: v.string(), userIds: v.array(v.id("users")) },
  handler: async (ctx, args) => {
    const userId = await actor(ctx);
    await quota(ctx, userId, "conversation", 10);
    const ids = [...new Set([userId, ...args.userIds])];
    if (ids.length < 2 || ids.length > LIMITS.group) throw new ConvexError("INVALID_MEMBERS");
    for (const id of ids) {
      const p = await ctx.db
        .query("profiles")
        .withIndex("by_user", (q) => q.eq("userId", id))
        .unique();
      if (!p || p.deleted || (await blocked(ctx, userId, id)))
        throw new ConvexError("INVALID_MEMBERS");
    }
    await assertCompatibleMembers(ctx, [], ids);
    const now = Date.now(),
      id = await ctx.db.insert("conversations", {
        kind: "group",
        title: cleanText(args.title, LIMITS.name),
        updatedAt: now,
      });
    for (const uid of ids)
      await ctx.db.insert("members", {
        conversationId: id,
        userId: uid,
        role: uid === userId ? "admin" : "member",
        readAt: 0,
        updatedAt: now,
      });
    await groupEvent(ctx, id, userId, "created", undefined, args.title.trim());
    return id;
  },
});
export const rename = mutation({
  args: { id: v.id("conversations"), title: v.string() },
  handler: async (ctx, { id, title }) => {
    const own = await admin(ctx, id);
    const cleaned = cleanText(title, LIMITS.name);
    if ((await ctx.db.get(id))?.title === cleaned) return;
    await quota(ctx, own.userId, "group-admin", 30);
    await ctx.db.patch(id, { title: cleaned });
    await groupEvent(ctx, id, own.userId, "renamed", undefined, cleaned);
  },
});
export const membership = mutation({
  args: {
    id: v.id("conversations"),
    targetId: v.id("users"),
    operation: v.union(v.literal("remove"), v.literal("promote"), v.literal("demote")),
  },
  handler: async (ctx, { id, targetId, operation }) => {
    const own = await member(ctx, id),
      c = await ctx.db.get(id);
    if (c?.kind !== "group") throw new ConvexError("FORBIDDEN");
    if (own.userId !== targetId || operation !== "remove") await admin(ctx, id);
    const target = await ctx.db
      .query("members")
      .withIndex("by_pair", (q) => q.eq("conversationId", id).eq("userId", targetId))
      .unique();
    if (!target) return;
    if (operation === "promote" && target.role === "admin") return;
    if (operation === "demote" && target.role === "member") return;
    await quota(ctx, own.userId, "group-admin", 30);
    const rows = await ctx.db
      .query("members")
      .withIndex("by_conversation", (q) => q.eq("conversationId", id))
      .take(LIMITS.group);
    if (
      target.role === "admin" &&
      operation !== "promote" &&
      !rows.some((m) => m.userId !== targetId && m.role === "admin")
    ) {
      const next = rows.find((m) => m.userId !== targetId);
      if (next) {
        await ctx.db.patch(next._id, { role: "admin" });
        await groupEvent(ctx, id, own.userId, "promoted", next.userId);
      } else if (operation === "demote") throw new ConvexError("LAST_ADMIN");
    }
    if (operation === "remove") await ctx.db.delete(target._id);
    else await ctx.db.patch(target._id, { role: operation === "promote" ? "admin" : "member" });
    await groupEvent(
      ctx,
      id,
      own.userId,
      operation === "remove"
        ? own.userId === targetId
          ? "left"
          : "removed"
        : operation === "promote"
          ? "promoted"
          : "demoted",
      targetId,
    );
    await closeEmptyGroup(ctx, id);
  },
});
export const addMembers = mutation({
  args: { id: v.id("conversations"), userIds: v.array(v.id("users")) },
  handler: async (ctx, { id, userIds }) => {
    const own = await admin(ctx, id);
    if ((await ctx.db.get(id))?.kind !== "group") throw new ConvexError("FORBIDDEN");
    if (userIds.length > LIMITS.group) throw new ConvexError("GROUP_FULL");
    const rows = await ctx.db
      .query("members")
      .withIndex("by_conversation", (q) => q.eq("conversationId", id))
      .take(LIMITS.group);
    const additions = [...new Set(userIds)].filter((uid) => !rows.some((m) => m.userId === uid));
    if (rows.length + additions.length > LIMITS.group) throw new ConvexError("GROUP_FULL");
    await quota(ctx, own.userId, "add-members", 20);
    await assertCompatibleMembers(
      ctx,
      rows.map((m) => m.userId),
      additions,
    );
    for (const uid of additions) {
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_user", (q) => q.eq("userId", uid))
        .unique();
      if (!profile || profile.deleted || (await blocked(ctx, own.userId, uid)))
        throw new ConvexError("INVALID_MEMBERS");

      await ctx.db.insert("members", {
        conversationId: id,
        userId: uid,
        role: "member",
        readAt: 0,
        updatedAt: Date.now(),
      });
      await groupEvent(ctx, id, own.userId, "added", uid);
    }
  },
});
export const revokeInvite = mutation({
  args: { id: v.id("conversations") },
  handler: async (ctx, { id }) => {
    await admin(ctx, id);
    const rows = await ctx.db
      .query("invites")
      .withIndex("by_conversation", (q) => q.eq("conversationId", id))
      .take(100);
    for (const row of rows) await ctx.db.delete(row._id);
  },
});
export const createInvite = mutation({
  args: { id: v.id("conversations"), code: v.string() },
  handler: async (ctx, { id, code }) => {
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
  },
});
export const join = mutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
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
  },
});
