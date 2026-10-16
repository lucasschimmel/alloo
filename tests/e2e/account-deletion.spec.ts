import { expect, test } from "@playwright/test";
import { signup } from "./helpers";

test("T-FINAL-LOCAL remote account deletion clears drafts on the other device", async ({
  browser,
}) => {
  test.skip(process.env.E2E_CONNECTED !== "1", "Requires local Convex");
  const contexts = await Promise.all([0, 1, 2].map(() => browser.newContext()));
  const [alice, bob, remote] = await Promise.all(contexts.map((c) => c.newPage()));
  const suffix = Date.now().toString(36),
    handle = `delete_${suffix}`;
  try {
    await signup(alice, handle, "Delete Alice");
    await signup(bob, `peer_${suffix}`, "Delete Bob");
    await alice.getByRole("button", { name: "Nouvelle conversation", exact: true }).first().click();
    await alice.getByLabel("Rechercher une personne").fill(`peer_${suffix}`);
    await alice.getByRole("button", { name: /Delete Bob/ }).click();
    await alice.getByLabel("Votre message").fill("Local private draft");
    const countDrafts = () =>
      alice.evaluate(async () => {
        const name = (await indexedDB.databases()).find((d) =>
          d.name?.startsWith("alloo-local-v1:"),
        )?.name;
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
    await expect.poll(countDrafts).toBe(1);
    await alice.getByRole("button", { name: "Mon compte" }).click();
    await remote.goto("/app");
    await remote.getByLabel("Adresse e-mail").fill(`${handle}@example.test`);
    await remote.getByLabel("Mot de passe", { exact: true }).fill("Test-only-Alloo-2026!");
    await remote.getByRole("button", { name: "Se connecter", exact: true }).click();
    await remote.getByRole("button", { name: "Mon compte" }).click();
    await remote.locator("summary").filter({ hasText: "Supprimer mon compte" }).click();
    await remote.getByLabel("Confirmation de suppression").fill("SUPPRIMER");
    await remote.getByRole("button", { name: "Supprimer mon compte", exact: true }).click();
    await expect.poll(countDrafts).toBe(0);
    await expect(alice.getByLabel("Votre message")).toHaveCount(0);
  } finally {
    for (const context of contexts) await context.close();
  }
});
