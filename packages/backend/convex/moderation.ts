import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { actor, publicProfile, readableUser } from "./access";

function isOperator(userId: string) {
  return (process.env.ALLOO_OPERATOR_IDS ?? "")
    .split(",")
    .map((x) => x.trim())
    .includes(userId);
}
export const queue = query({
  args: {},
  handler: async (ctx) => {
    const userId = await readableUser(ctx);
    if (!userId || !isOperator(userId)) return null;
    const rows = await ctx.db
      .query("reports")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .take(50);
    return Promise.all(
      rows.map(async (row) => ({
        ...row,
        reporter: await publicProfile(ctx, row.userId),
        target: await publicProfile(ctx, row.targetId),
      })),
    );
  },
});
export const resolve = mutation({
  args: { id: v.id("reports") },
  handler: async (ctx, { id }) => {
    const userId = await actor(ctx);
    if (!isOperator(userId)) throw new ConvexError("FORBIDDEN");
    await ctx.db.patch(id, { status: "resolved" });
  },
});
