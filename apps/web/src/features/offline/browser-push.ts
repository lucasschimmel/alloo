import type { LocalStore } from "./store";
import { clearLocalData } from "./store";
export function pushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}
export async function bindWorker(
  registration: ServiceWorkerRegistration,
  store?: LocalStore,
  binding?: string,
) {
  const worker = registration.active;
  if (!worker) throw new Error("WORKER_UNAVAILABLE");
  if (store) await store.valid();
  await new Promise<void>((resolve, reject) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => {
      channel.port1.close();
      reject(new Error("WORKER_TIMEOUT"));
    }, 5000);
    channel.port1.onmessage = (event) => {
      clearTimeout(timer);
      channel.port1.close();
      if (event.data?.ok) resolve();
      else reject(new Error("WORKER_BINDING_FAILED"));
    };
    worker.postMessage(
      {
        type: "alloo-binding",
        control: store
          ? {
              account: store.owner,
              generation: store.generation,
              databaseName: store.databaseName,
              binding,
            }
          : null,
      },
      [channel.port2],
    );
  });
}
export async function disableBrowserPush() {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration("/");
  if (!registration) return;
  await bindWorker(registration);
  const subscription = await registration.pushManager.getSubscription();
  for (const notification of await registration.getNotifications()) notification.close();
  if (subscription) await subscription.unsubscribe();
}
export async function clearBrowserAccount(expectedOwner?: string) {
  if (!expectedOwner) window.dispatchEvent(new Event("alloo-local-reset"));
  // Generation is invalidated first. Even a failed/offline unsubscribe cannot expose later notifications.
  const cleared = await clearLocalData(import.meta.env.VITE_CONVEX_URL, expectedOwner);
  if (!cleared) return;
  if (expectedOwner) {
    window.dispatchEvent(new CustomEvent("alloo-local-reset", { detail: expectedOwner }));
    // Remote deletion already revokes server subscriptions. Do not asynchronously unbind a new account.
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.getRegistration("/");
      for (const notification of (await registration?.getNotifications()) ?? []) {
        if (notification.data?.account === expectedOwner) notification.close();
      }
    }
    return;
  }
  // Local generation revocation already makes incoming push unreadable if the browser is offline.
  await disableBrowserPush().catch(() => false);
}
export function applicationServerKey(value: string) {
  const raw = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export async function workerEnabled(registration: ServiceWorkerRegistration, store: LocalStore) {
  return new Promise<boolean>((resolve) => {
    if (!registration.active) {
      resolve(false);
      return;
    }
    const channel = new MessageChannel();
    const timer = setTimeout(() => {
      channel.port1.close();
      resolve(false);
    }, 5000);
    channel.port1.onmessage = (event) => {
      clearTimeout(timer);
      channel.port1.close();
      resolve(event.data?.ok === true);
    };
    registration.active.postMessage(
      { type: "alloo-status", account: store.owner, generation: store.generation },
      [channel.port2],
    );
  });
}
export async function activateBrowserPush(
  registration: ServiceWorkerRegistration,
  key: string,
  save: (subscription: PushSubscription, binding: string) => Promise<void>,
  bind: (binding: string) => Promise<void>,
) {
  // Keep the endpoint on partial failure: retry repairs the same server record, without consuming another device slot.
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey(key),
    }));
  const binding = crypto.randomUUID();
  try {
    await save(subscription, binding);
  } catch (error) {
    if (error instanceof Error && error.message.includes("FORBIDDEN"))
      await subscription.unsubscribe();
    throw error;
  }
  await bind(binding);
}
