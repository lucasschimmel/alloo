"use node";
import { PUSH } from "@alloo/shared/push";
import { v } from "convex/values";
import webpush from "web-push";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
export const deliver = internalAction({
  args: {
    messageId: v.id("messages"),
    subscriptionId: v.id("pushSubscriptions"),
    binding: v.string(),
    attempt: v.number(),
  },
  handler: async (ctx, args) => {
    const publicKey = process.env.VAPID_PUBLIC_KEY,
      privateKey = process.env.VAPID_PRIVATE_KEY,
      subject = process.env.VAPID_SUBJECT;
    if (!publicKey || !privateKey || !subject) return;
    const eligible = await ctx.runQuery(internal.push.eligible, {
      messageId: args.messageId,
      subscriptionId: args.subscriptionId,
      binding: args.binding,
    });
    if (!eligible) return;
    const { sub, conversationId } = eligible;
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({
          account: sub.userId,
          binding: sub.binding,
          conversationId,
          messageId: args.messageId,
        }),
        {
          vapidDetails: { subject, publicKey, privateKey },
          timeout: PUSH.timeout,
          TTL: PUSH.ttl,
        },
      );
    } catch (error) {
      const status =
        error && typeof error === "object" && "statusCode" in error ? Number(error.statusCode) : 0;
      if (status === 404 || status === 410)
        await ctx.runMutation(internal.push.prune, { id: sub._id, binding: sub.binding });
      else if ((!status || status === 429 || status >= 500) && args.attempt + 1 < PUSH.attempts)
        await ctx.scheduler.runAfter(10_000 * 2 ** args.attempt, internal.pushDelivery.deliver, {
          ...args,
          attempt: args.attempt + 1,
        });
      // Provider bodies can contain subscription secrets; never log them.
    }
  },
});
