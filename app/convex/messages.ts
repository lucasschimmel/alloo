import { v } from "convex/values";
import { mutation, query, type QueryCtx, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";

async function getMembership(
  ctx: QueryCtx | MutationCtx,
  conversationId: Id<"conversations">,
  userId: Id<"users">
) {
  const members = await ctx.db
    .query("conversationMembers")
    .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
    .collect();
  return members.find((m) => m.userId === userId) ?? null;
}

async function getTypingEntry(
  ctx: QueryCtx | MutationCtx,
  conversationId: Id<"conversations">,
  userId: Id<"users">
) {
  const entries = await ctx.db
    .query("typingIndicators")
    .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
    .collect();
  return entries.find((e) => e.userId === userId) ?? null;
}

export const list = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const membership = await getMembership(ctx, args.conversationId, userId);
    if (!membership) return [];

    // Get other members' lastReadAt for read receipts
    const allMembers = await ctx.db
      .query("conversationMembers")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .collect();
    const otherMembers = allMembers.filter((m) => m.userId !== userId);

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .order("asc")
      .collect();

    // Deduplicate sender lookups
    const senderCache = new Map<string, {
      _id: Id<"users">;
      username?: string;
      displayName?: string;
      name?: string;
      image?: string;
    } | null>();

    const messagesWithSender = await Promise.all(
      messages.map(async (msg) => {
        const senderId = msg.senderId as Id<"users">;
        if (!senderCache.has(senderId)) {
          const sender = await ctx.db.get(senderId);
          senderCache.set(
            senderId,
            sender
              ? {
                  _id: sender._id as Id<"users">,
                  username: sender.username,
                  displayName: sender.displayName,
                  name: sender.name,
                  image: sender.image,
                }
              : null
          );
        }
        const isOwn = senderId === userId;
        // Read receipt: check if all other members have read past this message
        const isRead = isOwn
          ? otherMembers.length > 0 &&
            otherMembers.every(
              (m) => m.lastReadAt != null && m.lastReadAt >= msg._creationTime
            )
          : false;

        return {
          ...msg,
          sender: senderCache.get(senderId) ?? null,
          isOwn,
          isRead,
        };
      })
    );

    return messagesWithSender;
  },
});

export const send = mutation({
  args: {
    conversationId: v.id("conversations"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    if (!args.content.trim()) throw new Error("Message cannot be empty");
    if (args.content.length > 4000) throw new Error("Message too long");

    const membership = await getMembership(ctx, args.conversationId, userId);
    if (!membership) throw new Error("Not a member of this conversation");

    await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      senderId: userId,
      content: args.content.trim(),
    });

    await ctx.db.patch(args.conversationId, {
      lastMessageAt: Date.now(),
    });

    const typing = await getTypingEntry(ctx, args.conversationId, userId);
    if (typing) await ctx.db.delete(typing._id);
  },
});

export const setTyping = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return;

    // Verify membership
    const membership = await getMembership(ctx, args.conversationId, userId);
    if (!membership) return;

    const existing = await getTypingEntry(ctx, args.conversationId, userId);
    const expiresAt = Date.now() + 3000;

    if (existing) {
      await ctx.db.patch(existing._id, { expiresAt });
    } else {
      await ctx.db.insert("typingIndicators", {
        conversationId: args.conversationId,
        userId,
        expiresAt,
      });
    }
  },
});

export const getTypingUsers = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    // Verify membership
    const membership = await getMembership(ctx, args.conversationId, userId);
    if (!membership) return [];

    const now = Date.now();
    const indicators = await ctx.db
      .query("typingIndicators")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .collect();

    const activeTypers = indicators.filter(
      (i) => i.userId !== userId && i.expiresAt > now
    );

    const users = await Promise.all(
      activeTypers.map(async (i) => {
        const user = await ctx.db.get(i.userId as Id<"users">);
        return user?.username ?? user?.name ?? "Someone";
      })
    );

    return users;
  },
});
