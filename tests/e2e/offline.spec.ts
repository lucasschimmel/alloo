import { expect, test } from "@playwright/test";
import { signup } from "./helpers";

test("T-AC-07 T-OFF-BROWSER restores drafts and delivers queued offline text and file once", async ({
  browser,
}) => {
  test.skip(process.env.E2E_CONNECTED !== "1", "Requires isolated local Convex backend");
  const ac = await browser.newContext(),
    bc = await browser.newContext();
  let a = await ac.newPage();
  const b = await bc.newPage();
  const suffix = Date.now().toString(36),
    handle = `ob_${suffix}`;
  try {
    await signup(a, `oa_${suffix}`, "Offline Alice");
    await signup(b, handle, "Offline Bob");
    expect(
      await a.evaluate(async () => {
        await navigator.serviceWorker.register("/sw.js");
        return (await navigator.serviceWorker.ready).active?.scriptURL.endsWith("/sw.js");
      }),
    ).toBe(true);
    await a.getByRole("button", { name: "Nouvelle conversation", exact: true }).first().click();
    await a.getByLabel("Rechercher une personne").fill(handle);
    await a.getByRole("button", { name: /Offline Bob/ }).click();
    let input = a.getByRole("textbox", { name: "Votre message" });
    await input.fill("Brouillon conservé");
    await expect
      .poll(async () =>
        a.evaluate(async () => {
          const names = await indexedDB.databases();
          const name = names.find((n) => n.name?.startsWith("alloo-local-v1:"))?.name;
          if (!name) return 0;
          return new Promise<number>((resolve) => {
            const r = indexedDB.open(name);
            r.onsuccess = () => {
              const q = r.result.transaction("drafts").objectStore("drafts").count();
              q.onsuccess = () => {
                r.result.close();
                resolve(q.result);
              };
            };
          });
        }),
      )
      .toBe(1);
    await a.reload();
    await expect(input).toHaveValue("Brouillon conservé");
    await ac.setOffline(true);
    await input.fill("Message hors ligne");
    await a.getByLabel("Pièce jointe", { exact: true }).setInputFiles({
      name: "offline.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("persistent attachment"),
    });
    await a.getByRole("button", { name: "Envoyer le message" }).click();
    await expect(a.locator(".failed-send")).toContainText("Message hors ligne");
    await expect(input).toHaveValue("");
    const location = a.url();
    await a.close();
    await ac.setOffline(false);
    a = await ac.newPage();
    await a.goto(location);
    input = a.getByRole("textbox", { name: "Votre message" });
    await expect(a.locator(".bubble").filter({ hasText: "Message hors ligne" })).toHaveCount(1);
    await expect(a.locator(".failed-send")).toHaveCount(0);
    await b.getByRole("button", { name: /Offline Alice/ }).click();
    await expect(b.locator(".bubble").filter({ hasText: "Message hors ligne" })).toHaveCount(1);
    await expect(b.getByRole("button", { name: /offline.txt/ })).toBeVisible();
    await input.fill("Effacer à la déconnexion");
    await a.getByRole("button", { name: "Mon compte" }).click();
    await a.getByRole("button", { name: "Se déconnecter" }).click();
    await expect(a.getByLabel("Adresse e-mail")).toBeVisible();
    const remaining = await a.evaluate(async () => {
      const names = await indexedDB.databases();
      const name = names.find((n) => n.name?.startsWith("alloo-local-v1:"))?.name;
      if (!name) return 0;
      return new Promise<number>((resolve) => {
        const r = indexedDB.open(name);
        r.onsuccess = () => {
          const q = r.result.transaction("drafts").objectStore("drafts").count();
          q.onsuccess = () => {
            r.result.close();
            resolve(q.result);
          };
        };
      });
    });
    expect(remaining).toBe(0);
  } finally {
    await ac.close();
    await bc.close();
  }
});

// Shared account setup keeps these cross-browser lifecycle regressions in one suite.
