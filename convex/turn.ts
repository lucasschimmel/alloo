"use node";
import { createHmac } from "node:crypto";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";
export const configuration = action({
  args: {},
  handler: async (ctx): Promise<RTCIceServer[]> => {
    const userId = await ctx.runMutation(internal.calls.reserveTurn, {});
    if (
      process.env.ALLOO_DEV_DIRECT_CALLS === "true" &&
      /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(process.env.SITE_URL ?? "")
    )
      return [];
    const urls = process.env.TURN_URLS?.split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    const shared = process.env.TURN_SHARED_SECRET;
    if (!urls?.length || !shared) throw new Error("TURN_NOT_CONFIGURED");
    const username = `${Math.floor(Date.now() / 1000) + 3600}:${userId}`;
    return [
      { urls, username, credential: createHmac("sha1", shared).update(username).digest("base64") },
    ];
  },
});
