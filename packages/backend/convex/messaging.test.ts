import { afterEach, expect, it, vi } from "vitest";
import { setupUsers } from "../test-support";
import { api, internal } from "./_generated/api";

afterEach(() => vi.useRealTimers());
const modules = import.meta.glob("./**/*.ts");
async function setup() {
  const { t, ids, a, b, c } = await setupUsers(modules);
  const id = await a.mutation(api.conversations.createDM, { targetId: ids[1] });
  const messageId = await a.mutation(api.messages.send, {
    id,
    body: "original",
    operationId: "original-message",
  });
  return { t, a, b, c, id, ids, messageId };
}
it("T-AC-01 T-MSG-EDIT author edits with revision control and unauthorized edits fail", async () => {
  const { a, b, c, messageId } = await setup();
  for (const client of [b, c])
    await expect(
      client.mutation(api.messages.edit, { messageId, body: "stolen", revision: 0 }),
    ).rejects.toThrow();
  await a.mutation(api.messages.edit, { messageId, body: "corrected", revision: 0 });
  expect((await b.query(api.messages.anchor, { messageId }))?.body).toBe("corrected");
  await expect(
    a.mutation(api.messages.edit, { messageId, body: "stale", revision: 0 }),
  ).rejects.toThrow("EDIT_CONFLICT");
});
it("T-AC-02 T-MSG-DELETE erases text, quotes, pins and reactions and is idempotent", async () => {
  const { a, b, id, messageId } = await setup();
  const reply = await b.mutation(api.messages.send, {
    id,
    body: "reply",
    replyId: messageId,
    operationId: "reply-message",
  });
  await a.mutation(api.messages.pin, { messageId });
  await b.mutation(api.messages.react, { messageId, emoji: "❤️" });
  await expect(b.mutation(api.messages.remove, { messageId })).rejects.toThrow("FORBIDDEN");
  await a.mutation(api.messages.remove, { messageId });
  await a.mutation(api.messages.remove, { messageId });
  const deleted = await b.query(api.messages.anchor, { messageId });
  expect(deleted?.body).toBe("Message supprimé");
  expect(deleted?.reactions).toEqual([]);
  expect((await b.query(api.messages.anchor, { messageId: reply }))?.quote?.body).toBe(
    "Message supprimé",
  );
  expect(await b.query(api.messages.pins, { id })).toEqual([]);
  await expect(
    a.mutation(api.messages.edit, { messageId, body: "revive", revision: 0 }),
  ).rejects.toThrow();
  await expect(b.mutation(api.messages.react, { messageId, emoji: "❤️" })).rejects.toThrow();
});

it("T-MSG-EDIT original send retry stays idempotent after edit and deletion", async () => {
  const { a, id, messageId } = await setup();
  await a.mutation(api.messages.edit, { messageId, body: "changed", revision: 0 });
  const args = { id, body: "original", operationId: "original-message" };
  expect(await a.mutation(api.messages.send, args)).toBe(messageId);
  await a.mutation(api.messages.remove, { messageId });
  expect(await a.mutation(api.messages.send, args)).toBe(messageId);
  expect((await a.query(api.messages.anchor, { messageId }))?.body).toBe("Message supprimé");
});
it("T-AC-03 T-MSG-SEARCH scopes search, hides personal removals and updates edited/deleted text", async () => {
  const { a, b, c, id, messageId } = await setup();
  const args = { id, text: "original", paginationOpts: { cursor: null, numItems: 20 } };
  expect((await c.query(api.messages.search, args)).page).toHaveLength(0);
  expect((await b.query(api.messages.search, args)).page).toHaveLength(1);
  await b.mutation(api.messages.hide, { messageId });
  expect((await b.query(api.messages.search, args)).page).toHaveLength(0);
  await a.mutation(api.messages.edit, { messageId, body: "updated", revision: 0 });
  expect((await a.query(api.messages.search, args)).page).toHaveLength(0);
  expect((await a.query(api.messages.search, { ...args, text: "updated" })).page).toHaveLength(1);
  await a.mutation(api.messages.remove, { messageId });
  expect((await a.query(api.messages.search, { ...args, text: "updated" })).page).toHaveLength(0);
});

async function upload(
  client: Awaited<ReturnType<typeof setup>>["a"],
  id: Awaited<ReturnType<typeof setup>>["id"],
  text = "document content",
) {
  const response = await client.fetch(`/attachments?conversation=${id}&name=notes.txt`, {
    method: "POST",
    body: text,
  });
  expect(response.status).toBe(200);
  return (await response.json()) as {
    id: import("./_generated/dataModel").Id<"attachments">;
    name: string;
    size: number;
  };
}
it("T-AC-04 T-MSG-FILE HTTP upload binds owner and conversation; send is single-use and retry-safe", async () => {
  const { t, a, b, c, id, messageId, ids } = await setup();
  expect(
    (
      await t.fetch(`/attachments?conversation=${id}&name=notes.txt`, {
        method: "POST",
        body: "test",
      })
    ).status,
  ).not.toBe(200);
  const file = await upload(a, id);
  const args = { id, body: "", attachmentId: file.id, operationId: "file-message" };
  await expect(b.mutation(api.messages.send, args)).rejects.toThrow("INVALID_ATTACHMENT");
  await expect(c.mutation(api.messages.send, args)).rejects.toThrow();
  const other = await a.mutation(api.conversations.createDM, { targetId: ids[2] });
  await expect(a.mutation(api.messages.send, { ...args, id: other })).rejects.toThrow(
    "INVALID_ATTACHMENT",
  );
  const sent = await a.mutation(api.messages.send, args);
  expect(await a.mutation(api.messages.send, args)).toBe(sent);
  await expect(
    a.mutation(api.messages.send, { ...args, operationId: "reuse-file" }),
  ).rejects.toThrow("INVALID_ATTACHMENT");
  await a.mutation(api.attachmentRecords.discard, { id: file.id });
  expect((await b.query(api.messages.anchor, { messageId: sent }))?.attachment?.name).toBe(
    "notes.txt",
  );
  expect((await a.query(api.messages.anchor, { messageId }))?.attachment).toBeNull();
});
it("T-AC-05 T-MSG-FILE-ACCESS download is private, no-store, denied after hiding or deletion", async () => {
  const { t, a, b, c, id } = await setup();
  const file = await upload(a, id);
  const path = `/attachments?id=${file.id}`;
  expect((await a.fetch(path)).status).toBe(404);
  const messageId = await a.mutation(api.messages.send, {
    id,
    body: "",
    attachmentId: file.id,
    operationId: "download-message",
  });
  for (const client of [t, c]) expect((await client.fetch(path)).status).toBe(404);
  const response = await b.fetch(path);
  expect(await response.text()).toBe("document content");
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(response.headers.get("content-type")).toBe("application/octet-stream");
  expect(response.headers.get("content-disposition")).toContain("attachment;");
  await b.mutation(api.messages.hide, { messageId });
  expect((await b.fetch(path)).status).toBe(404);
  await a.mutation(api.messages.remove, { messageId });
  expect((await a.fetch(path)).status).toBe(404);
  expect(await t.run((ctx) => ctx.db.get(file.id))).toBeNull();
});
it("T-MSG-FILE rejects expired drafts and oversized HTTP bodies", async () => {
  const { t, a, id } = await setup();
  const response = await a.fetch(`/attachments?conversation=${id}&name=notes.txt`, {
    method: "POST",
    headers: { "content-length": String(11 * 1024 * 1024) },
    body: "small",
  });
  expect(response.status).toBe(413);
  const file = await upload(a, id);
  await t.run((ctx) => ctx.db.patch(file.id, { expiresAt: Date.now() - 1 }));
  await expect(
    a.mutation(api.messages.send, {
      id,
      body: "",
      attachmentId: file.id,
      operationId: "expired-file",
    }),
  ).rejects.toThrow("INVALID_ATTACHMENT");
  await t.mutation(internal.maintenance.sweep, {});
  expect(await t.run((ctx) => ctx.db.get(file.id))).toBeNull();
});
it("T-MSG-FILE-ACCESS storage sweep preserves linked files and access loss denies downloads", async () => {
  const { t, a, b, id, ids } = await setup();
  const file = await upload(a, id);
  await a.mutation(api.messages.send, {
    id,
    body: "",
    attachmentId: file.id,
    operationId: "retained-file",
  });
  await t.mutation(internal.maintenance.sweep, {});
  expect((await b.fetch(`/attachments?id=${file.id}`)).status).toBe(200);
  await t.run(async (ctx) => {
    const member = await ctx.db
      .query("members")
      .withIndex("by_pair", (q) => q.eq("conversationId", id).eq("userId", ids[1]))
      .unique();
    if (member) await ctx.db.delete(member._id);
  });
  expect((await b.fetch(`/attachments?id=${file.id}`)).status).toBe(404);
});

it("T-MSG-SEARCH cannot reveal another conversation to an authorized member", async () => {
  const { a, b, c, id, ids } = await setup();
  const privateId = await a.mutation(api.conversations.createDM, { targetId: ids[2] });
  await a.mutation(api.messages.send, {
    id: privateId,
    body: "original private",
    operationId: "other-conversation",
  });
  const args = { id, text: "original", paginationOpts: { cursor: null, numItems: 20 } };
  const result = await b.query(api.messages.search, args);
  expect(result.page).toHaveLength(1);
  expect(result.page[0].body).toBe("original");
  expect((await c.query(api.messages.search, args)).page).toHaveLength(0);
  expect(
    (await b.query(api.messages.search, { ...args, text: Array(17).fill("word").join("-") })).page,
  ).toHaveLength(0);
});
it("T-MSG-EDIT legacy messages preserve send retry identity without exposing fingerprints", async () => {
  const { t, a, b, id, messageId } = await setup();
  await t.run((ctx) => ctx.db.patch(messageId, { sendFingerprint: undefined }));
  await a.mutation(api.messages.edit, { messageId, body: "new text", revision: 0 });
  expect(
    await a.mutation(api.messages.send, { id, body: "original", operationId: "original-message" }),
  ).toBe(messageId);
  await a.mutation(api.messages.pin, { messageId });
  expect((await b.query(api.messages.pins, { id }))[0]).not.toHaveProperty("sendFingerprint");
  expect(await b.query(api.messages.anchor, { messageId })).not.toHaveProperty("sendFingerprint");
});
it("T-MSG-FILE-ACCESS sweep retains old linked files and purges expired drafts", async () => {
  const { t, a, b, id } = await setup();
  const retained = await upload(a, id),
    orphan = await upload(a, id);
  await a.mutation(api.messages.send, {
    id,
    body: "",
    attachmentId: retained.id,
    operationId: "old-linked-file",
  });
  vi.useFakeTimers();
  vi.setSystemTime(Date.now() + 7_200_000);
  await t.mutation(internal.maintenance.sweep, {});
  expect((await b.fetch(`/attachments?id=${retained.id}`)).status).toBe(200);
  expect(await t.run((ctx) => ctx.db.get(orphan.id))).toBeNull();
});
it("T-MSG-FILE-ACCESS closing the last-member group deletes attached storage", async () => {
  const { t, a, ids } = await setup();
  const id = await a.mutation(api.conversations.createGroup, { title: "Purge", userIds: [ids[1]] });
  const file = await upload(a, id);
  await a.mutation(api.messages.send, {
    id,
    body: "",
    attachmentId: file.id,
    operationId: "purge-attached-file",
  });
  const storageId = await t.run(async (ctx) => (await ctx.db.get(file.id))?.storageId);
  await t.run(async (ctx) => {
    await ctx.db.patch(id, { closed: true });
  });
  await t.mutation(internal.groupLifecycle.purge, { id });
  expect(await t.run((ctx) => ctx.db.get(file.id))).toBeNull();
  expect(
    await t.run(async (ctx) => (storageId ? await ctx.db.system.get(storageId) : null)),
  ).toBeNull();
});
it("T-MSG-EDIT removed authors and system events cannot be edited or deleted", async () => {
  const { t, a, id, ids, messageId } = await setup();
  const event = await t.run((ctx) =>
    ctx.db.insert("messages", {
      conversationId: id,
      userId: ids[0],
      body: "system",
      kind: "system",
      operationId: "system-message",
      pinned: false,
    }),
  );
  await expect(
    a.mutation(api.messages.edit, { messageId: event, body: "fake", revision: 0 }),
  ).rejects.toThrow("FORBIDDEN");
  await expect(a.mutation(api.messages.remove, { messageId: event })).rejects.toThrow("FORBIDDEN");
  await t.run(async (ctx) => {
    const row = await ctx.db
      .query("members")
      .withIndex("by_pair", (q) => q.eq("conversationId", id).eq("userId", ids[0]))
      .unique();
    if (row) await ctx.db.delete(row._id);
  });
  await expect(
    a.mutation(api.messages.edit, { messageId, body: "fake", revision: 0 }),
  ).rejects.toThrow("FORBIDDEN");
  await expect(a.mutation(api.messages.remove, { messageId })).rejects.toThrow("FORBIDDEN");
});
