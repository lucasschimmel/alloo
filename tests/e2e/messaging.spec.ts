import { expect, test } from "@playwright/test";
import { signup } from "./helpers";

test("T-AC-06 T-MSG-BROWSER attach/download, search, edit and delete for every participant", async ({
  browser,
}) => {
  test.skip(process.env.E2E_CONNECTED !== "1", "Requires local Convex");
  const contexts = await Promise.all([0, 1].map(() => browser.newContext()));
  const [alice, bob] = await Promise.all(contexts.map((c) => c.newPage()));
  const suffix = Date.now().toString(36);
  try {
    await signup(alice, `ma_${suffix}`, "Alice fichiers");
    await signup(bob, `mb_${suffix}`, "Bob fichiers");
    await alice.getByRole("button", { name: "Nouvelle conversation", exact: true }).first().click();
    await alice.getByLabel("Rechercher une personne").fill(`mb_${suffix}`);
    await alice.getByRole("button", { name: /Bob fichiers/ }).click();
    await alice.getByLabel("Pièce jointe", { exact: true }).setInputFiles({
      name: "notes.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Alloo attachment test"),
    });
    await alice.getByLabel("Votre message").fill("Document constellation");
    await alice.getByRole("button", { name: "Envoyer le message" }).click();
    await expect(alice.getByRole("button", { name: "Télécharger notes.txt" })).toBeVisible();
    await alice.setViewportSize({ width: 390, height: 844 });
    expect(await alice.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await alice.screenshot({ path: "test-results/messaging-mobile.png" });
    await bob.getByRole("button", { name: /Alice fichiers/ }).click();
    const received = bob.locator(".message-row").filter({ hasText: "Document constellation" });
    await expect(received).toBeVisible();
    const downloadPromise = bob.waitForEvent("download");
    await bob.getByRole("button", { name: "Télécharger notes.txt" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("notes.txt");
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    if (stream) for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    expect(Buffer.concat(chunks).toString()).toBe("Alloo attachment test");
    await received.getByRole("button", { name: "Répondre au message" }).click();
    const own = alice.locator(".message-row").filter({ hasText: "Document constellation" });
    await own.getByRole("button", { name: "Modifier le message" }).click();
    await alice.getByLabel("Texte modifié").fill("Document galaxie");
    await alice.getByRole("button", { name: "Enregistrer la modification" }).click();
    await expect(bob.locator(".composer-area .context-strip")).toContainText("Document galaxie");
    await bob.getByRole("button", { name: "Rechercher dans la conversation", exact: true }).click();
    await bob.getByLabel("Rechercher des messages", { exact: true }).fill("galaxie");
    await bob.getByRole("button", { name: "Rechercher", exact: true }).click();
    await bob.locator(".search-result").filter({ hasText: "Document galaxie" }).click();
    await expect(bob.getByRole("dialog")).toContainText("Document galaxie");
    await alice
      .locator(".message-row")
      .filter({ hasText: "Document galaxie" })
      .getByRole("button", { name: "Supprimer pour tous", exact: true })
      .click();
    await alice.getByRole("button", { name: "Confirmer la suppression" }).click();
    await expect(bob.getByRole("dialog")).toContainText("Message supprimé");
    await expect(bob.getByRole("button", { name: "Télécharger notes.txt" })).toHaveCount(0);
    await expect(bob.locator(".composer-area .context-strip")).toHaveCount(0);
    await bob.getByRole("button", { name: "Fermer", exact: true }).click();
    await bob.getByRole("button", { name: "Rechercher dans la conversation", exact: true }).click();
    await bob.getByLabel("Rechercher des messages", { exact: true }).fill("galaxie");
    await bob.getByRole("button", { name: "Rechercher", exact: true }).click();
    await expect(bob.getByText("Aucun message dans cette page de résultats.")).toBeVisible();
    await bob.getByRole("button", { name: "Fermer", exact: true }).click();
    await bob.getByLabel("Votre message").fill("Après suppression de la citation");
    await bob.getByRole("button", { name: "Envoyer le message" }).click();
    await expect(
      alice.locator(".bubble").filter({ hasText: "Après suppression de la citation" }),
    ).toHaveCount(1);
    await expect(bob.locator(".failed-send")).toHaveCount(0);
  } finally {
    for (const context of contexts) await context.close();
  }
});
