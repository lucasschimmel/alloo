import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const ids = [];
    for (const name of ["Alice", "Bob", "Eve"]) {
      const id = await ctx.db.insert("users", { name });
      await ctx.db.insert("profiles", { userId: id, name, username: name.toLowerCase(), bio: "" });
      ids.push(id);
    }
    return ids;
  });
  return {
    t,
    a: t.withIdentity({ subject: ids[0] }),
    b: t.withIdentity({ subject: ids[1] }),
    e: t.withIdentity({ subject: ids[2] }),
    ids,
  };
}
afterEach(() => vi.useRealTimers());
describe("V2 domain contracts", () => {
  it("T-RECOVERY atomically bounds issuance and does not classify verified login as issuance", async () => {
    const { t, ids } = await setup();
    await t.run((ctx) =>
      ctx.db.insert("authAccounts", {
        userId: ids[0],
        provider: "password",
        providerAccountId: "alice@example.test",
        emailVerified: "alice@example.test",
      }),
    );
    for (let i = 0; i < 5; i++)
      await t.mutation(internal.authIssuance.reserve, { digest: "test-digest" });
    await expect(
      t.mutation(internal.authIssuance.reserve, { digest: "test-digest" }),
    ).rejects.toThrow("RATE_LIMITED");
    expect(
      await t.query(internal.authIssuance.needsVerification, { email: "alice@example.test" }),
    ).toBe(false);
  });
  it("T-ABUSE hides moderation reports from ordinary users", async () => {
    const { a, b, ids } = await setup();
    await a.mutation(api.accounts.report, { targetId: ids[1], reason: "Test report" });
    expect(await b.query(api.moderation.queue, {})).toBeNull();
  });
  it("T-DM rejects self conversations and deduplicates pairs", async () => {
    const { a, b, ids } = await setup();
    await expect(a.mutation(api.conversations.createDM, { targetId: ids[0] })).rejects.toThrow();
    const id = await a.mutation(api.conversations.createDM, { targetId: ids[1] });
    expect(await b.mutation(api.conversations.createDM, { targetId: ids[0] })).toBe(id);
  });
  it("T-AUTH denies unauthenticated mutations", async () => {
    const { t, ids } = await setup();
    await expect(t.mutation(api.conversations.createDM, { targetId: ids[1] })).rejects.toThrow(
      "UNAUTHENTICATED",
    );
  });
  it("T-MESSAGE deduplicates retries and refuses another conversation payload", async () => {
    const { a, ids } = await setup();
    const id = await a.mutation(api.conversations.createDM, { targetId: ids[1] });
    const args = { id, body: "hello", operationId: "operation-001" };
    const message = await a.mutation(api.messages.send, args);
    expect(await a.mutation(api.messages.send, args)).toBe(message);
    await expect(a.mutation(api.messages.send, { ...args, body: "changed" })).rejects.toThrow(
      "CONFLICT",
    );
  });
  it("T-MESSAGE keeps outsiders out of messages and anchors", async () => {
    const { a, e, ids } = await setup();
    const id = await a.mutation(api.conversations.createDM, { targetId: ids[1] });
    const messageId = await a.mutation(api.messages.send, {
      id,
      body: "private",
      operationId: "operation-001",
    });
    await expect(e.query(api.messages.anchor, { messageId })).rejects.toThrow("FORBIDDEN");
  });
  it("T-VISIBILITY hides timeline, quote and sidebar preview for one user only", async () => {
    const { a, b, ids } = await setup();
    const id = await a.mutation(api.conversations.createDM, { targetId: ids[1] });
    const messageId = await a.mutation(api.messages.send, {
      id,
      body: "private",
      operationId: "operation-001",
    });
    await b.mutation(api.messages.hide, { messageId });
    expect(await b.query(api.messages.anchor, { messageId })).toBeNull();
    expect((await a.query(api.messages.anchor, { messageId }))?.body).toBe("private");
    const list = await b.query(api.conversations.list, {
      paginationOpts: { numItems: 20, cursor: null },
    });
    expect(list.page[0].preview).not.toBe("private");
  });
  it("T-REACTION enforces per-person reaction bounds but permits toggling off", async () => {
    const { a, ids } = await setup();
    const id = await a.mutation(api.conversations.createDM, { targetId: ids[1] });
    const messageId = await a.mutation(api.messages.send, {
      id,
      body: "hi",
      operationId: "operation-001",
    });
    for (const emoji of ["❤️", "👍", "😂"])
      await a.mutation(api.messages.react, { messageId, emoji });
    await expect(a.mutation(api.messages.react, { messageId, emoji: "😮" })).rejects.toThrow(
      "REACTION_LIMIT",
    );
    await a.mutation(api.messages.react, { messageId, emoji: "❤️" });
    expect((await a.query(api.messages.anchor, { messageId }))?.reactions).toHaveLength(2);
  });
  it("T-GROUP transfers the last administrator when leaving", async () => {
    const { a, b, ids } = await setup();
    const id = await a.mutation(api.conversations.createGroup, {
      title: "Friends",
      userIds: [ids[1]],
    });
    await a.mutation(api.conversations.membership, { id, targetId: ids[0], operation: "remove" });
    expect((await b.query(api.conversations.details, { id }))?.role).toBe("admin");
  });
  it("T-INVITE rotation revokes older links", async () => {
    const { a, e, ids } = await setup();
    const id = await a.mutation(api.conversations.createGroup, {
      title: "Friends",
      userIds: [ids[1]],
    });
    await a.mutation(api.conversations.createInvite, { id, code: "a".repeat(32) });
    await a.mutation(api.conversations.createInvite, { id, code: "b".repeat(32) });
    await expect(e.mutation(api.conversations.join, { code: "a".repeat(32) })).rejects.toThrow(
      "EXPIRED_INVITE",
    );
    expect(await e.mutation(api.conversations.join, { code: "b".repeat(32) })).toBe(id);
  });
  it("T-ABUSE prevents a blocked person sending or starting calls", async () => {
    const { a, b, ids } = await setup();
    const id = await a.mutation(api.conversations.createDM, { targetId: ids[1] });
    await b.mutation(api.accounts.block, { targetId: ids[0], blocked: true });
    await expect(
      a.mutation(api.messages.send, { id, body: "hi", operationId: "operation-001" }),
    ).rejects.toThrow("BLOCKED");
    await expect(
      a.mutation(api.calls.start, { conversationId: id, kind: "audio", session: "caller" }),
    ).rejects.toThrow("FORBIDDEN");
  });
  it("T-CALL rejects caller acceptance and double answering", async () => {
    const { a, b, ids } = await setup();
    const conversationId = await a.mutation(api.conversations.createDM, { targetId: ids[1] });
    const id = await a.mutation(api.calls.start, {
      conversationId,
      kind: "audio",
      session: "caller",
    });
    await expect(a.mutation(api.calls.accept, { id, session: "a" })).rejects.toThrow(
      "INVALID_TRANSITION",
    );
    await b.mutation(api.calls.accept, { id, session: "b" });
    await expect(b.mutation(api.calls.accept, { id, session: "other" })).rejects.toThrow(
      "INVALID_TRANSITION",
    );
  });
  it("T-CALL creates one history event when hangup repeats", async () => {
    const { a, b, t, ids } = await setup();
    const conversationId = await a.mutation(api.conversations.createDM, { targetId: ids[1] });
    const id = await a.mutation(api.calls.start, {
      conversationId,
      kind: "audio",
      session: "caller",
    });
    await a.mutation(api.calls.hangup, { id, session: "caller" });
    await b.mutation(api.calls.hangup, { id });
    const messages = await t.run((ctx) => ctx.db.query("messages").collect());
    expect(messages).toHaveLength(1);
  });
  it("T-CALL prevents a losing tab from ending or signaling the winning session", async () => {
    const { a, b, ids } = await setup();
    const conversationId = await a.mutation(api.conversations.createDM, { targetId: ids[1] });
    const id = await a.mutation(api.calls.start, {
      conversationId,
      kind: "audio",
      session: "caller",
    });
    await b.mutation(api.calls.accept, { id, session: "winner" });
    await expect(b.mutation(api.calls.hangup, { id, session: "loser" })).rejects.toThrow(
      "OTHER_SESSION",
    );
    await expect(
      b.mutation(api.calls.signal, { id, session: "loser", body: "{}" }),
    ).rejects.toThrow("OTHER_SESSION");
    await expect(
      a.mutation(api.calls.heartbeat, { id, session: "other-caller-tab" }),
    ).rejects.toThrow("OTHER_SESSION");
    expect((await b.query(api.calls.get, { id }))?.state).toBe("active");
    await b.mutation(api.calls.hangup, { id, session: "winner" });
    expect((await b.query(api.calls.get, { id }))?.state).toBe("ended");
  });
  it("T-ACCOUNT deletes login accounts and revokes access while retaining anonymized history", async () => {
    vi.useFakeTimers();
    const { a, b, t, ids } = await setup();
    const id = await a.mutation(api.conversations.createDM, { targetId: ids[1] });
    const messageId = await a.mutation(api.messages.send, {
      id,
      body: "retained",
      operationId: "account-test-001",
    });
    await t.run(async (ctx) => {
      const accountId = await ctx.db.insert("authAccounts", {
        userId: ids[0],
        provider: "password",
        providerAccountId: "alice@example.test",
      });
      await ctx.db.insert("authVerificationCodes", {
        accountId,
        provider: "email",
        code: "test-only",
        expirationTime: Date.now() + 1000,
      });
    });
    await a.mutation(api.accounts.remove, { confirmation: "SUPPRIMER" });
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    await expect(
      a.mutation(api.messages.send, { id, body: "denied", operationId: "account-test-002" }),
    ).rejects.toThrow();
    expect(await t.run((ctx) => ctx.db.query("authAccounts").collect())).toHaveLength(0);
    expect(await t.run((ctx) => ctx.db.query("authVerificationCodes").collect())).toHaveLength(0);
    expect((await b.query(api.messages.anchor, { messageId }))?.author.name).toBe(
      "Compte supprimé",
    );
  });
  it("T-CALL expires ringing without a browser timeout", async () => {
    vi.useFakeTimers();
    const { a, t, ids } = await setup();
    const conversationId = await a.mutation(api.conversations.createDM, { targetId: ids[1] });
    const id = await a.mutation(api.calls.start, {
      conversationId,
      kind: "audio",
      session: "caller",
    });
    await t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(31_000));
    expect((await a.query(api.calls.get, { id }))?.state).toBe("ended");
  });
  it("T-READ cannot regress the read cursor", async () => {
    const { a, b, ids } = await setup();
    const id = await a.mutation(api.conversations.createDM, { targetId: ids[1] });
    const first = await a.mutation(api.messages.send, {
      id,
      body: "first",
      operationId: "operation-001",
    });
    const second = await a.mutation(api.messages.send, {
      id,
      body: "second",
      operationId: "operation-002",
    });
    await b.mutation(api.messages.markRead, { messageId: second });
    const before = (await b.query(api.conversations.details, { id }))?.members.find(
      (m) => m.userId === ids[1],
    )?.readAt;
    await b.mutation(api.messages.markRead, { messageId: first });
    expect(
      (await b.query(api.conversations.details, { id }))?.members.find((m) => m.userId === ids[1])
        ?.readAt,
    ).toBe(before);
  });
});
