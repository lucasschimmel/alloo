"use node";
import { v } from "convex/values";
import { sanitizeImage } from "../shared/image";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";
export const upload = action({
  args: { bytes: v.bytes() },
  handler: async (ctx, { bytes }) => {
    await ctx.runMutation(internal.avatarRecords.reserve, {});
    const output = sanitizeImage(bytes);
    const storageId = await ctx.storage.store(
      new Blob([new Uint8Array(output)], { type: "image/png" }),
    );
    try {
      await ctx.runMutation(internal.avatarRecords.commit, { storageId });
    } catch (error) {
      await ctx.storage.delete(storageId);
      throw error;
    }
  },
});
export const read = action({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }): Promise<ArrayBuffer | null> => {
    const id = await ctx.runQuery(internal.avatarRecords.owned, { userId });
    if (!id) return null;
    const blob = await ctx.storage.get(id);
    return blob ? await blob.arrayBuffer() : null;
  },
});
