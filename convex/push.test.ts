import { convexTest } from "convex-test";
import { afterEach, expect, it, vi } from "vitest";
import webpush from "web-push";
import { api, internal } from "./_generated/api";
import schema from "./schema";

vi.mock("web-push", () => ({ default: { sendNotification: vi.fn(async () => ({})) } }));
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
const modules = import.meta.glob("./**/*.ts");
const subscription = {
  endpoint: "https://fcm.googleapis.com/fcm/send/test",
  p256dh: "A".repeat(87),
  auth: "B".repeat(22),
  binding: "12345678-1234-1234-1234-123456789abc",
};
async function setup() {
  vi.useFakeTimers();
  const t = convexTest(schema, modules);
  const users = await t.run(async (ctx) => {
    const result = [];
    for (const name of ["Alice", "Bob"]) {
      const userId = await ctx.db.insert("users", { name });
      await ctx.db.insert("profiles", { userId, name, username: name.toLowerCase(), bio: "" });
      const sessionId = await ctx.db.insert("authSessions", {
        userId,
        expirationTime: Date.now() + 3600000,
      });
      result.push({ userId, sessionId });
    }
    return result;
  });
  const [a, b] = users.map((u) => t.withIdentity({ subject: `${u.userId}|${u.sessionId}` }));
  const id = await a.mutation(api.conversations.createDM, { targetId: users[1].userId });
  await b.mutation(api.push.register, { ...subscription, expectedUserId: users[1].userId });
  const messageId = await a.mutation(api.messages.send, {
    id,
    body: "private message",
    operationId: "push-message",
  });
  const sub = await t.run((ctx) => ctx.db.query("pushSubscriptions").first());
  if (!sub) throw new Error("missing sub");
  const args = { messageId, subscriptionId: sub._id, binding: sub.binding };
  return { t, a, b, id, users, args, sub };
}
it("T-AC-04 T-PUSH-ACCESS rejects arbitrary endpoints and cross-account subscription ownership", async () => {
  const { a, b, users } = await setup();
  for (const endpoint of [
    "https://127.0.0.1/x",
    "https://fcm.googleapis.com.evil.test/x",
    "http://fcm.googleapis.com/x",
    "https://user@fcm.googleapis.com/x",
  ])
    await expect(
      b.mutation(api.push.register, { ...subscription, endpoint, expectedUserId: users[1].userId }),
    ).rejects.toThrow("INVALID_INPUT");
  await expect(
    a.mutation(api.push.register, { ...subscription, expectedUserId: users[0].userId }),
  ).rejects.toThrow("FORBIDDEN");
});
it("T-PUSH-ACCESS mute, read, block, logout and deleted messages revoke delivery eligibility", async () => {
  const { t, a, b, id, args, users } = await setup();
  expect(await t.query(internal.push.eligible, args)).not.toBeNull();
  await b.mutation(api.push.mute, { id, muted: true });
  expect(await t.query(internal.push.eligible, args)).toBeNull();
  await b.mutation(api.push.mute, { id, muted: false });
  await b.mutation(api.accounts.block, { targetId: users[0].userId, blocked: true });
  expect(await t.query(internal.push.eligible, args)).toBeNull();
  await b.mutation(api.accounts.block, { targetId: users[0].userId, blocked: false });
  await b.mutation(api.messages.markRead, { messageId: args.messageId });
  expect(await t.query(internal.push.eligible, args)).toBeNull();
  await t.run(async (ctx) => {
    const m = await ctx.db
      .query("members")
      .withIndex("by_pair", (q) => q.eq("conversationId", id).eq("userId", users[1].userId))
      .unique();
    if (m) await ctx.db.patch(m._id, { readAt: 0 });
  });
  await a.mutation(api.messages.remove, { messageId: args.messageId });
  expect(await t.query(internal.push.eligible, args)).toBeNull();
});
it("T-PUSH-ACCESS revoked auth session suppresses queued push and stale prune preserves rebinding", async () => {
  const { t, b, args, users, sub } = await setup();
  await b.mutation(api.push.register, {
    ...subscription,
    expectedUserId: users[1].userId,
    binding: "aaaaaaaa-1234-1234-1234-123456789abc",
  });
  await t.mutation(internal.push.prune, { id: sub._id, binding: sub.binding });
  expect(await t.run((ctx) => ctx.db.get(sub._id))).not.toBeNull();
  await t.run((ctx) => ctx.db.delete(users[1].sessionId));
  expect(
    await t.query(internal.push.eligible, {
      ...args,
      binding: "aaaaaaaa-1234-1234-1234-123456789abc",
    }),
  ).toBeNull();
});
it("T-AC-05 T-PUSH-DELIVERY sends generic payload and prunes expired endpoints", async () => {
  const { t, args, sub } = await setup();
  vi.stubEnv("VAPID_PUBLIC_KEY", "test-public");
  vi.stubEnv("VAPID_PRIVATE_KEY", "test-private");
  vi.stubEnv("VAPID_SUBJECT", "mailto:test@example.com");
  await t.action(internal.pushDelivery.deliver, { ...args, attempt: 0 });
  const payload = vi.mocked(webpush.sendNotification).mock.calls[0][1];
  expect(payload).not.toContain("private message");
  expect(payload).not.toContain("Alice");
  expect(JSON.parse(String(payload))).toMatchObject({
    messageId: args.messageId,
    binding: sub.binding,
  });
  vi.mocked(webpush.sendNotification).mockRejectedValueOnce({ statusCode: 410 });
  await t.action(internal.pushDelivery.deliver, { ...args, attempt: 0 });
  expect(await t.run((ctx) => ctx.db.get(sub._id))).toBeNull();
});
it("T-PUSH-DELIVERY retries transient provider failures only within the attempt budget", async () => {
  const { t, args } = await setup();
  vi.stubEnv("VAPID_PUBLIC_KEY", "test-public");
  vi.stubEnv("VAPID_PRIVATE_KEY", "test-private");
  vi.stubEnv("VAPID_SUBJECT", "mailto:test@example.com");
  vi.mocked(webpush.sendNotification).mockRejectedValue({ statusCode: 503 });
  await t.action(internal.pushDelivery.deliver, { ...args, attempt: 2 });
  const scheduled = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
  expect(scheduled.filter((row) => row.name.includes("pushDelivery"))).toHaveLength(0);
});
it("T-AC-03 T-OFF-LIFETIME expected account prevents cross-send and receipt survives edited server text", async () => {
  const { a, b, id, users, args } = await setup();
  const request = {
    id,
    body: "private message",
    operationId: "push-message",
    expectedUserId: users[0].userId,
  };
  await expect(b.mutation(api.messages.send, request)).rejects.toThrow("FORBIDDEN");
  await expect(b.query(api.messages.receipt, request)).rejects.toThrow("UNAUTHENTICATED");
  await a.mutation(api.messages.edit, { messageId: args.messageId, body: "edited", revision: 0 });
  expect(await a.query(api.messages.receipt, request)).toBe(args.messageId);
  const scheduled = await a.mutation(api.messages.send, request);
  expect(scheduled).toBe(args.messageId);
});

it("T-PUSH-ACCESS reclaims revoked sessions before applying the device cap", async () => {
  const { t, b, users } = await setup();
  await t.run(async (ctx) => {
    for (let i = 0; i < 4; i++) {
      const sessionId = await ctx.db.insert("authSessions", {
        userId: users[1].userId,
        expirationTime: Date.now() - 1,
      });
      await ctx.db.insert("pushSubscriptions", {
        ...subscription,
        endpoint: `https://fcm.googleapis.com/expired/${i}`,
        userId: users[1].userId,
        sessionId,
      });
    }
  });
  await b.mutation(api.push.register, {
    ...subscription,
    endpoint: "https://fcm.googleapis.com/new",
    expectedUserId: users[1].userId,
  });
  expect(await t.run((ctx) => ctx.db.query("pushSubscriptions").collect())).toHaveLength(2);
});
