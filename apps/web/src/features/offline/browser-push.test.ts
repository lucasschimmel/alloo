import { expect, it, vi } from "vitest";
import { activateBrowserPush } from "./browser-push";

it("T-PUSH-ACCESS retries partial activation on the same endpoint without creating orphan devices", async () => {
  const subscription = { endpoint: "https://fcm.googleapis.com/test" } as PushSubscription;
  const subscribe = vi.fn(async () => subscription);
  const registration = {
    pushManager: { getSubscription: vi.fn(async () => subscription), subscribe },
  } as unknown as ServiceWorkerRegistration;
  const saved = new Map<string, string>();
  const save = async (sub: PushSubscription, binding: string) => {
    saved.set(sub.endpoint, binding);
  };
  await expect(
    activateBrowserPush(registration, "key", save, async () => {
      throw new Error("WORKER_TIMEOUT");
    }),
  ).rejects.toThrow("WORKER_TIMEOUT");
  await activateBrowserPush(registration, "key", save, async () => undefined);
  expect(saved.size).toBe(1);
  expect(subscribe).not.toHaveBeenCalled();
});
