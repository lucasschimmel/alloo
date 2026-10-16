import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";

// A one-hour grace period protects in-flight uploads; attached files stay private and retained.
export const sweep = internalMutation({
  args: { cursor: v.optional(v.string()) },
  handler: async (ctx, { cursor }) => {
    const page = await ctx.db.system
      .query("_storage")
      .paginate({ cursor: cursor ?? null, numItems: 50 });
    for (const file of page.page) {
      if (file._creationTime > Date.now() - 3_600_000) continue;
      const owner = await ctx.db
        .query("profiles")
        .withIndex("by_avatar", (q) => q.eq("avatar", file._id))
        .first();
      const attachment = await ctx.db
        .query("attachments")
        .withIndex("by_storage", (q) => q.eq("storageId", file._id))
        .first();
      if (!owner && !attachment) await ctx.storage.delete(file._id);
    }
    if (!page.isDone)
      await ctx.scheduler.runAfter(0, internal.maintenance.sweep, { cursor: page.continueCursor });
    const drafts = await ctx.db
      .query("attachments")
      .withIndex("by_expiry", (q) => q.gt("expiresAt", 0).lte("expiresAt", Date.now()))
      .take(50);
    for (const file of drafts) {
      await ctx.storage.delete(file.storageId);
      await ctx.db.delete(file._id);
    }
    const expired = await ctx.db
      .query("presence")
      .withIndex("by_expiry", (q) => q.lt("expiresAt", Date.now()))
      .take(100);
    for (const row of expired) await ctx.db.delete(row._id);
    const quotas = await ctx.db
      .query("authIssuance")
      .withIndex("by_started", (q) => q.lt("startedAt", Date.now() - 86_400_000))
      .take(100);
    for (const row of quotas) await ctx.db.delete(row._id);
  },
});
