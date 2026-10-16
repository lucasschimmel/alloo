import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
export const needsVerification = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const account = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q.eq("provider", "password").eq("providerAccountId", email),
      )
      .unique();
    return !!account && !account.emailVerified;
  },
});
export const reserve = internalMutation({
  args: { digest: v.string() },
  handler: async (ctx, { digest }) => {
    const now = Date.now();
    for (const [key, maximum, window] of [
      [digest, 5, 900_000],
      ["global", 500, 3_600_000],
    ] as const) {
      const row = await ctx.db
        .query("authIssuance")
        .withIndex("by_key", (q) => q.eq("key", key))
        .unique();
      if (!row) await ctx.db.insert("authIssuance", { key, startedAt: now, count: 1 });
      else if (now - row.startedAt >= window)
        await ctx.db.patch(row._id, { startedAt: now, count: 1 });
      else {
        if (row.count >= maximum) throw new ConvexError("RATE_LIMITED");
        await ctx.db.patch(row._id, { count: row.count + 1 });
      }
    }
  },
});
