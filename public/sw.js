/* No fetch handler: private responses and authenticated pages are never cached. */
const CONTROL_DB = "alloo-push-v1";
function openDatabase(name, create = false) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => {
      if (create) request.result.createObjectStore("control");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function readControl() {
  const db = await openDatabase(CONTROL_DB, true);
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction("control").objectStore("control").get("active");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}
async function validControl(control) {
  if (!control?.databaseName?.startsWith("alloo-local-v1:")) return false;
  const db = await openDatabase(control.databaseName);
  try {
    if (!db.objectStoreNames.contains("meta")) return false;
    const active = await new Promise((resolve, reject) => {
      const request = db.transaction("meta").objectStore("meta").get("active");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return active?.owner === control.account && active.generation === control.generation;
  } finally {
    db.close();
  }
}
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("message", (event) => {
  if (event.data?.type === "alloo-status") {
    event.waitUntil(
      (async () => {
        const control = await readControl();
        event.ports[0]?.postMessage({
          ok:
            !!control &&
            control.account === event.data.account &&
            control.generation === event.data.generation &&
            (await validControl(control)),
        });
      })().catch(() => event.ports[0]?.postMessage({ ok: false })),
    );
    return;
  }
  if (event.data?.type !== "alloo-binding") return;
  event.waitUntil(
    (async () => {
      const control = event.data.control;
      if (control && !(await validControl(control))) throw new Error("STALE_ACCOUNT");
      const db = await openDatabase(CONTROL_DB, true);
      try {
        await new Promise((resolve, reject) => {
          const tx = db.transaction("control", "readwrite");
          if (control) tx.objectStore("control").put(control, "active");
          else tx.objectStore("control").delete("active");
          tx.oncomplete = resolve;
          tx.onerror = () => reject(tx.error);
        });
      } finally {
        db.close();
      }
      for (const notification of await self.registration.getNotifications()) notification.close();
      event.ports[0]?.postMessage({ ok: true });
    })().catch(() => event.ports[0]?.postMessage({ ok: false })),
  );
});
async function matches(payload) {
  const control = await readControl();
  return (
    control &&
    control.account === payload.account &&
    control.binding === payload.binding &&
    (await validControl(control))
  );
}
async function alreadyDelivered(payload) {
  const db = await openDatabase(CONTROL_DB, true);
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("control", "readwrite"),
        store = tx.objectStore("control");
      const key = `seen:${payload.binding}:${payload.messageId}`;
      let duplicate = false;
      const request = store.get(key);
      request.onsuccess = () => {
        duplicate = !!request.result;
        if (!duplicate) store.put(Date.now(), key);
        let seenCount = 0;
        const cursor = store.openCursor();
        cursor.onsuccess = () => {
          const row = cursor.result;
          if (!row) return;
          if (String(row.key).startsWith("seen:")) seenCount++;
          if (
            String(row.key).startsWith("seen:") &&
            (!String(row.key).startsWith(`seen:${payload.binding}:`) ||
              row.value < Date.now() - 86400000 ||
              seenCount > 2000)
          )
            row.delete();
          row.continue();
        };
      };
      tx.oncomplete = () => resolve(duplicate);
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      const payload = event.data?.json();
      if (
        !payload ||
        !/^[a-zA-Z0-9]+$/.test(payload.conversationId) ||
        !/^[a-zA-Z0-9]+$/.test(payload.messageId) ||
        !(await matches(payload))
      )
        return;
      const clients = await self.clients.matchAll({ type: "window" });
      if (
        clients.some(
          (client) =>
            client.focused &&
            new URL(client.url).searchParams.get("conversation") === payload.conversationId,
        )
      )
        return;
      if ((await alreadyDelivered(payload)) || !(await matches(payload))) return;
      await self.registration.showNotification("Alloo", {
        body: "Vous avez un nouveau message.",
        tag: payload.messageId,
        renotify: false,
        data: payload,
      });
      if (!(await matches(payload))) {
        for (const notification of await self.registration.getNotifications({
          tag: payload.messageId,
        }))
          notification.close();
      }
    })(),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const payload = event.notification.data;
      if (!payload || !(await matches(payload)) || !/^[a-zA-Z0-9]+$/.test(payload.conversationId))
        return;
      const url = new URL("/app", self.location.origin);
      url.searchParams.set("conversation", payload.conversationId);
      const clients = await self.clients.matchAll({ type: "window" });
      if (!(await matches(payload))) return;
      const client = clients.find((client) => new URL(client.url).origin === self.location.origin);
      if (client) {
        await client.navigate(url.href);
        await client.focus();
      } else await self.clients.openWindow(url.href);
    })(),
  );
});
