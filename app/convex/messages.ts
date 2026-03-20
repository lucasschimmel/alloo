import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

async function getMembership(
  ctx: { db: any },
  conversationId: any,
  userId: any
) {
  const members = await ctx.db
    .query("conversationMembers")
    .withIndex("by_conversation", (q: any) =>
      q.eq("conversationId", conversationId)
    )
    .collect();
  return members.find((m: any) => m.userId === userId) ?? null;
}

async function getTypingEntry(
  ctx: { db: any },
  conversationId: any,
  userId: any
) {
  const entries = await ctx.db
    .query("typingIndicators")
    .withIndex("by_conversation", (q: any) =>
      q.eq("conversationId", conversationId)
    )
    .collect();
  return entries.find((e: any) => e.userId === userId) ?? null;
}

export const list = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const membership = await getMembership(ctx, args.conversationId, userId);
    if (!membership) return [];

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q: any) =>
        q.eq("conversationId", args.conversationId)
      )
      .order("asc")
      .collect();

    const messagesWithSender = await Promise.all(
      messages.map(async (msg: any) => {
        const sender = await ctx.db.get(msg.senderId);
        return {
          ...msg,
          sender: sender
            ? {
                _id: sender._id,
                username: sender.username,
                name: sender.name,
                image: sender.image,
              }
            : null,
          isOwn: msg.senderId === userId,
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
      .withIndex("by_conversation", (q: any) =>
        q.eq("conversationId", args.conversationId)
      )
      .collect();

    const activeTypers = indicators.filter(
      (i: any) => i.userId !== userId && i.expiresAt > now
    );

    const users = await Promise.all(
      activeTypers.map(async (i: any) => {
        const user = await ctx.db.get(i.userId);
        return user?.username ?? user?.name ?? "Someone";
      })
    );

    return users;
  },
});
