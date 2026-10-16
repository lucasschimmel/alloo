import "fake-indexeddb/auto";
import { expect, it, vi } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import { OFFLINE } from "../../../shared/offline";
import { drainOne, type QueueTransport } from "./runner";
import { clearLocalData, openLocalStore, type Queued } from "./store";

const id = "conversation" as Id<"conversations">;
const item = (patch: Partial<Queued> = {}): Queued => ({
  id,
  body: "hello",
  operationId: crypto.randomUUID(),
  at: Date.now(),
  attempts: 0,
  nextAt: 0,
  leaseUntil: 0,
  ...patch,
});
const transport = (): QueueTransport => ({
  receipt: vi.fn(async () => null),
  upload: vi.fn(async () => "attachment"),
  send: vi.fn(async () => "message"),
});
it("T-AC-01 T-OFF-DRAFT restores drafts after reopen and clears all data on logout", async () => {
  const backend = crypto.randomUUID(),
    store = await openLocalStore(backend, "alice");
  await store.saveDraft({ id, body: "draft", at: Date.now(), version: "one" });
  store.close();
  const reopened = await openLocalStore(backend, "alice");
  expect((await reopened.draft(id))?.body).toBe("draft");
  await clearLocalData(backend);
  await expect(reopened.draft(id)).rejects.toThrow("LOCAL_ACCOUNT_CHANGED");
  const next = await openLocalStore(backend, "alice");
  expect(await next.draft(id)).toBeUndefined();
  reopened.close();
  next.close();
});
it("T-AC-02 T-OFF-QUEUE preserves newer draft and attachments while enqueueing atomically", async () => {
  const store = await openLocalStore(crypto.randomUUID(), "alice");
  await store.saveDraft({ id, body: "new text", at: Date.now(), version: "new" });
  const row = item({ file: new File(["content"], "report.txt") });
  await store.enqueue(row, "old");
  expect((await store.draft(id))?.body).toBe("new text");
  expect((await store.list())[0].file?.size).toBe(7);
  await store.enqueue(row);
  expect(await store.list()).toHaveLength(1);
  store.close();
});
it("T-OFF-QUEUE rejects overcapacity without losing draft", async () => {
  const store = await openLocalStore(crypto.randomUUID(), "alice");
  await store.saveDraft({ id, body: "keep", at: Date.now(), version: "v" });
  for (let i = 0; i < OFFLINE.items; i++) await store.enqueue(item());
  await expect(store.enqueue(item(), "v")).rejects.toThrow("LOCAL_STORAGE_FULL");
  expect((await store.draft(id))?.body).toBe("keep");
  store.close();
});
it("T-AC-03 T-OFF-LIFETIME gives one tab the claim and fences old-account writes", async () => {
  const backend = crypto.randomUUID(),
    a = await openLocalStore(backend, "alice"),
    b = await openLocalStore(backend, "alice");
  await a.enqueue(item());
  const claims = await Promise.all([a.claim("a"), b.claim("b")]);
  expect(claims.filter(Boolean)).toHaveLength(1);
  const other = await openLocalStore(backend, "bob");
  await expect(a.enqueue(item())).rejects.toThrow("LOCAL_ACCOUNT_CHANGED");
  expect(await other.list()).toEqual([]);
  a.close();
  b.close();
  other.close();
});
it("T-OFF-QUEUE persists upload receipt before send and resolves lost acknowledgment without another upload", async () => {
  const store = await openLocalStore(crypto.randomUUID(), "alice"),
    row = item({ file: new File(["abc"], "a.txt") });
  await store.enqueue(row);
  const network = transport();
  network.send = vi.fn(async (sent) => {
    expect((await store.list())[0].attachmentId).toBe(sent.attachmentId);
    throw new Error("NETWORK");
  });
  await drainOne(store, network, new AbortController().signal);
  const saved = (await store.list())[0];
  expect(saved.attachmentId).toBe("attachment");
  await store.retry(row.operationId);
  network.receipt = vi.fn(async () => "message");
  await drainOne(store, network, new AbortController().signal);
  expect(network.upload).toHaveBeenCalledTimes(1);
  expect(network.send).toHaveBeenCalledTimes(1);
  expect(await store.list()).toEqual([]);
  store.close();
});
it("T-OFF-LIFETIME does not send after logout during receipt resolution", async () => {
  const backend = crypto.randomUUID(),
    store = await openLocalStore(backend, "alice");
  await store.enqueue(item());
  const network = transport();
  network.receipt = async () => {
    await clearLocalData(backend);
    return null;
  };
  await expect(drainOne(store, network, new AbortController().signal)).rejects.toThrow(
    "LOCAL_ACCOUNT_CHANGED",
  );
  expect(network.send).not.toHaveBeenCalled();
  store.close();
});
it("T-OFF-LIFETIME cancellation before send cannot recreate the queue item", async () => {
  const store = await openLocalStore(crypto.randomUUID(), "alice"),
    row = item();
  await store.enqueue(row);
  const network = transport();
  network.receipt = async () => {
    await store.remove(row.operationId);
    return null;
  };
  await expect(drainOne(store, network, new AbortController().signal)).resolves.toBe(true);
  expect(network.send).not.toHaveBeenCalled();
  expect(await store.list()).toEqual([]);
  store.close();
});
it("T-OFF-LIFETIME permission failure stays visible and requires manual retry", async () => {
  const store = await openLocalStore(crypto.randomUUID(), "alice"),
    row = item();
  await store.enqueue(row);
  const network = transport();
  network.send = vi.fn(async () => {
    throw new Error("FORBIDDEN");
  });
  await drainOne(store, network, new AbortController().signal);
  expect((await store.list())[0].error).toBe("PERMANENT_SEND_FAILURE");
  expect(await drainOne(store, network, new AbortController().signal)).toBe(false);
  await store.retry(row.operationId);
  expect((await store.list())[0].error).toBeUndefined();
  store.close();
});
it("T-OFF-LIFETIME transient failures stop after the bounded attempt budget", async () => {
  const store = await openLocalStore(crypto.randomUUID(), "alice");
  await store.enqueue(item({ attempts: OFFLINE.attempts - 1 }));
  const network = transport();
  network.send = async () => {
    throw new Error("NETWORK");
  };
  await drainOne(store, network, new AbortController().signal);
  expect((await store.list())[0].error).toBe("RETRY_EXHAUSTED");
  store.close();
});

it("T-OFF-LIFETIME transport rejection after cancellation leaves other sends running", async () => {
  const store = await openLocalStore(crypto.randomUUID(), "alice"),
    row = item();
  await store.enqueue(row);
  const network = transport();
  network.send = async () => {
    await store.remove(row.operationId);
    throw new Error("NETWORK");
  };
  await expect(drainOne(store, network, new AbortController().signal)).resolves.toBe(true);
  await store.enqueue(item());
  expect(await store.claim("next")).toBeDefined();
  store.close();
});

it("T-FINAL-LOCAL delayed deletion cleanup cannot clear another account", async () => {
  const backend = crypto.randomUUID(),
    store = await openLocalStore(backend, "bob");
  await store.saveDraft({ id, body: "Bob draft", at: Date.now(), version: "b" });
  expect(await clearLocalData(backend, "alice")).toBe(false);
  expect((await store.draft(id))?.body).toBe("Bob draft");
  expect(await clearLocalData(backend, "bob")).toBe(true);
  await expect(store.valid()).rejects.toThrow("LOCAL_ACCOUNT_CHANGED");
  store.close();
});
