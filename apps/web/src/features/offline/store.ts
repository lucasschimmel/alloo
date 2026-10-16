import type { Id } from "@alloo/backend/dataModel";
import { OFFLINE } from "@alloo/shared/offline";
import { type DBSchema, openDB } from "idb";
export type Draft = {
  id: Id<"conversations">;
  body: string;
  replyId?: Id<"messages">;
  version: string;
  at: number;
};
export type Queued = {
  operationId: string;
  id: Id<"conversations">;
  body: string;
  replyId?: Id<"messages">;
  file?: File;
  attachmentId?: Id<"attachments">;
  uploadedAt?: number;
  at: number;
  attempts: number;
  nextAt: number;
  lease?: string;
  leaseUntil: number;
  error?: string;
};
interface LocalSchema extends DBSchema {
  meta: { key: string; value: { owner: string; generation: string } };
  drafts: { key: string; value: Draft };
  outbox: { key: string; value: Queued };
}
export const localDatabaseName = (backend: string) => `alloo-local-v1:${backend}`;
async function database(backend: string) {
  return openDB<LocalSchema>(localDatabaseName(backend), 1, {
    upgrade(db) {
      db.createObjectStore("meta");
      db.createObjectStore("drafts", { keyPath: "id" });
      db.createObjectStore("outbox", { keyPath: "operationId" });
    },
  });
}
export async function clearLocalData(backend: string, expectedOwner?: string) {
  const db = await database(backend),
    tx = db.transaction(["meta", "drafts", "outbox"], "readwrite");
  const active = await tx.objectStore("meta").get("active");
  if (expectedOwner && active?.owner !== expectedOwner) {
    await tx.done;
    db.close();
    return false;
  }
  await tx.objectStore("meta").put({ owner: "", generation: crypto.randomUUID() }, "active");
  await tx.objectStore("drafts").clear();
  await tx.objectStore("outbox").clear();
  await tx.done;
  db.close();
  return true;
}
export async function openLocalStore(backend: string, owner: string) {
  const db = await database(backend),
    init = db.transaction(["meta", "drafts", "outbox"], "readwrite");
  let active = await init.objectStore("meta").get("active");
  if (active?.owner !== owner) {
    active = { owner, generation: crypto.randomUUID() };
    await init.objectStore("meta").put(active, "active");
    await init.objectStore("drafts").clear();
    await init.objectStore("outbox").clear();
  }
  for (const draft of await init.objectStore("drafts").getAll()) {
    if (draft.at < Date.now() - OFFLINE.ttlMs) await init.objectStore("drafts").delete(draft.id);
  }
  await init.done;
  const generation = active.generation;
  // Transactions serialize cross-tab claims and validate the account generation before every write.
  async function transaction<T>(
    work: (
      tx: import("idb").IDBPTransaction<LocalSchema, ["meta", "drafts", "outbox"], "readwrite">,
    ) => Promise<T>,
  ) {
    const tx = db.transaction(["meta", "drafts", "outbox"], "readwrite");
    const current = await tx.objectStore("meta").get("active");
    if (current?.owner !== owner || current.generation !== generation) {
      await tx.done;
      throw new Error("LOCAL_ACCOUNT_CHANGED");
    }
    try {
      const result = await work(tx);
      await tx.done;
      return result;
    } catch (error) {
      try {
        tx.abort();
      } catch {
        /* An already completed/aborted transaction cannot be aborted again. */
      }
      await tx.done.catch(() => undefined);
      throw error;
    }
  }
  return {
    owner,
    generation,
    databaseName: localDatabaseName(backend),
    close: () => db.close(),
    valid: () => transaction(async () => true),
    draft: (id: Id<"conversations">) =>
      transaction(async (tx) => {
        const draft = await tx.objectStore("drafts").get(id);
        if (draft && draft.at < Date.now() - OFFLINE.ttlMs) {
          await tx.objectStore("drafts").delete(id);
          return undefined;
        }
        return draft;
      }),
    saveDraft: (draft: Draft) =>
      transaction(async (tx) => {
        const store = tx.objectStore("drafts");
        if (!draft.body && !draft.replyId) {
          await store.delete(draft.id);
          return;
        }
        if (!(await store.get(draft.id)) && (await store.count()) >= OFFLINE.items)
          throw new Error("LOCAL_STORAGE_FULL");
        await store.put(draft);
      }),
    enqueue: (item: Queued, draftVersion?: string) =>
      transaction(async (tx) => {
        const store = tx.objectStore("outbox"),
          rows = await store.getAll();
        if (rows.some((row) => row.operationId === item.operationId)) return;
        if (
          rows.length >= OFFLINE.items ||
          rows.reduce((sum, row) => sum + (row.file?.size ?? 0), 0) + (item.file?.size ?? 0) >
            OFFLINE.bytes
        )
          throw new Error("LOCAL_STORAGE_FULL");
        await store.put(item);
        const draft = await tx.objectStore("drafts").get(item.id);
        if (draft?.version === draftVersion) await tx.objectStore("drafts").delete(item.id);
      }),
    list: () =>
      transaction(async (tx) => {
        const store = tx.objectStore("outbox");
        for (const row of await store.getAll()) {
          if (row.at < Date.now() - OFFLINE.ttlMs) await store.delete(row.operationId);
        }
        return (await store.getAll()).sort((a, b) => a.at - b.at);
      }),
    claim: (lease: string, now = Date.now()) =>
      transaction(async (tx) => {
        const store = tx.objectStore("outbox"),
          rows = (await store.getAll()).sort((a, b) => a.at - b.at);
        const blockedConversations = new Set<string>();
        for (const row of rows) {
          if (row.at < now - OFFLINE.ttlMs) {
            await store.delete(row.operationId);
            continue;
          }
          if (blockedConversations.has(row.id)) continue;
          blockedConversations.add(row.id);
          if (row.error || row.nextAt > now || row.leaseUntil > now) continue;
          const next = { ...row, lease, leaseUntil: now + OFFLINE.leaseMs };
          await store.put(next);
          return next;
        }
        return undefined;
      }),
    update: (operationId: string, lease: string, patch: Partial<Queued>) =>
      transaction(async (tx) => {
        const store = tx.objectStore("outbox"),
          row = await store.get(operationId);
        if (!row || row.lease !== lease) throw new Error("LOCAL_CANCELED");
        await store.put({ ...row, ...patch, operationId: row.operationId, id: row.id });
      }),
    remove: (operationId: string, lease?: string) =>
      transaction(async (tx) => {
        const store = tx.objectStore("outbox"),
          row = await store.get(operationId);
        if (row && (!lease || row.lease === lease)) await store.delete(operationId);
      }),
    retry: (operationId: string) =>
      transaction(async (tx) => {
        const store = tx.objectStore("outbox"),
          row = await store.get(operationId);
        if (row && row.leaseUntil <= Date.now())
          await store.put({ ...row, error: undefined, attempts: 0, nextAt: 0 });
      }),
  };
}
export type LocalStore = Awaited<ReturnType<typeof openLocalStore>>;
