import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { expect, it, vi } from "vitest";
import { clearLocalData, openLocalStore } from "./store";

const source = readFileSync(new URL("../../../public/sw.js", import.meta.url), "utf8");
async function setup() {
  const backend = crypto.randomUUID(),
    store = await openLocalStore(backend, "alice");
  const notifications = vi.fn(async () => undefined),
    openWindow = vi.fn(async () => undefined);
  const self = {
    addEventListener: vi.fn(),
    location: { origin: "https://alloo.test" },
    clients: {
      matchAll: vi.fn(async () => [] as { focused: boolean; url: string }[]),
      openWindow,
      claim: vi.fn(),
    },
    registration: {
      showNotification: notifications,
      getNotifications: vi.fn(async () => [] as { close: () => void }[]),
    },
  };
  const context = createContext({ self, indexedDB, URL, Date });
  runInContext(source, context);
  const control = {
    account: "alice",
    binding: crypto.randomUUID(),
    databaseName: store.databaseName,
    generation: store.generation,
  };
  await runInContext(
    `(async () => { const db = await openDatabase("alloo-push-v1", true); await new Promise(resolve => {
   const tx = db.transaction("control","readwrite"); tx.objectStore("control").put(${JSON.stringify(control)}, "active"); tx.oncomplete=resolve;
 }); db.close(); })()`,
    context,
  );
  async function emit(name: string, payload: object) {
    const handler = self.addEventListener.mock.calls.find((call) => call[0] === name)?.[1] as (
      event: object,
    ) => void;
    let pending = Promise.resolve();
    handler({
      data: { json: () => payload },
      notification: { data: payload, close: vi.fn() },
      waitUntil: (promise: Promise<void>) => {
        pending = promise;
      },
    });
    await pending;
  }
  const payload = { ...control, conversationId: "conversation123", messageId: "message123" };
  return { backend, store, self, context, emit, payload, notifications, openWindow };
}
it("T-AC-06 T-PUSH-WORKER drops wrong-account, logged-out and unsafe notification targets", async () => {
  const { backend, store, emit, payload, notifications, openWindow } = await setup();
  await emit("push", { ...payload, account: "bob" });
  await emit("notificationclick", { ...payload, conversationId: "https://evil.test" });
  expect(notifications).not.toHaveBeenCalled();
  expect(openWindow).not.toHaveBeenCalled();
  await clearLocalData(backend);
  await emit("push", payload);
  expect(notifications).not.toHaveBeenCalled();
  store.close();
});
it("T-PUSH-WORKER generic notification deduplicates even after dismissal and routes a valid click", async () => {
  const { store, self, emit, payload, notifications, openWindow } = await setup();
  await emit("push", payload);
  self.addEventListener.mockClear();
  runInContext(source, createContext({ self, indexedDB, URL, Date }));
  await emit("push", payload);
  expect(notifications).toHaveBeenCalledTimes(1);
  expect(notifications).toHaveBeenCalledWith(
    "Alloo",
    expect.objectContaining({ body: "Vous avez un nouveau message." }),
  );
  await emit("notificationclick", payload);
  expect(openWindow).toHaveBeenCalledWith("https://alloo.test/app?conversation=conversation123");
  store.close();
});
it("T-PUSH-WORKER suppresses the currently focused conversation", async () => {
  const { store, self, emit, payload, notifications } = await setup();
  self.clients.matchAll.mockResolvedValue([
    { focused: true, url: "https://alloo.test/app?conversation=conversation123" },
  ]);
  await emit("push", payload);
  expect(notifications).not.toHaveBeenCalled();
  store.close();
});

it("T-PUSH-WORKER logout while clients resolve prevents a delayed display", async () => {
  const { backend, store, self, emit, payload, notifications } = await setup();
  let release: (() => void) | undefined;
  self.clients.matchAll.mockImplementationOnce(async () => {
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    return [];
  });
  const pending = emit("push", payload);
  await vi.waitFor(() => expect(release).toBeDefined());
  await clearLocalData(backend);
  release?.();
  await pending;
  expect(notifications).not.toHaveBeenCalled();
  store.close();
});

it("T-PUSH-WORKER logout during notification display closes the newly displayed notification", async () => {
  const { backend, store, self, emit, payload, notifications } = await setup();
  const close = vi.fn();
  notifications.mockImplementationOnce(async () => {
    await clearLocalData(backend);
  });
  self.registration.getNotifications.mockResolvedValue([{ close }]);
  await emit("push", payload);
  expect(close).toHaveBeenCalledTimes(1);
  store.close();
});
