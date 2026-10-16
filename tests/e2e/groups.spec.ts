import { expect, test } from "@playwright/test";
import { PNG } from "pngjs";
import { signup } from "./helpers";

test("T-GROUP T-INVITE T-PROFILE creates a group, joins by invitation and replaces an avatar", async ({
  browser,
}) => {
  test.skip(process.env.E2E_CONNECTED !== "1", "Requires isolated local Convex backend");
  const contexts = await Promise.all([0, 1, 2].map(() => browser.newContext()));
  const [alice, bob, carol] = await Promise.all(contexts.map((c) => c.newPage()));
  const suffix = Date.now().toString(36),
    handles = [`ga_${suffix}`, `gb_${suffix}`, `gc_${suffix}`];
  try {
    await signup(alice, handles[0], "Léa");
    await signup(bob, handles[1], "Max");
    await signup(carol, handles[2], "Lou");
    await alice.getByRole("button", { name: "Mon compte" }).click();
    const png = new PNG({ width: 8, height: 8 });
    png.data.fill(150);
    await alice
      .getByLabel("Changer ma photo")
      .setInputFiles({ name: "avatar.png", mimeType: "image/png", buffer: PNG.sync.write(png) });
    await expect(alice.locator(".profile-avatar-row img")).toBeVisible();
    await alice.getByRole("button", { name: "Enregistrer", exact: true }).click();
    await alice.getByRole("button", { name: "Nouvelle conversation", exact: true }).first().click();
    await alice.getByRole("button", { name: "Créer un groupe", exact: true }).click();
    await alice.getByLabel("Nom du groupe").fill("Le café du vendredi");
    await alice.getByLabel("Rechercher une personne").fill(handles[1]);
    await alice.getByRole("button", { name: /Max/ }).click();
    await alice.getByRole("button", { name: /Créer le groupe/ }).click();
    await alice.getByRole("button", { name: "Informations de la conversation" }).click();
    await alice.getByRole("button", { name: "Créer / renouveler le lien d’invitation" }).click();
    const invitation = await alice.getByLabel("Lien d’invitation").inputValue();
    await alice.getByRole("button", { name: "Fermer", exact: true }).click();
    await alice.getByRole("button", { name: "Informations de la conversation" }).click();
    await expect(alice.getByLabel("Lien d’invitation")).toHaveValue(invitation);
    await carol.goto(invitation);
    await carol.getByRole("link", { name: "Rejoindre sur Alloo" }).click();
    await expect(carol.getByRole("heading", { name: "Le café du vendredi" })).toBeVisible();
    await carol.getByRole("textbox", { name: "Votre message" }).fill("Je vous ai retrouvés !");
    await carol.getByRole("button", { name: "Envoyer le message" }).click();
    await bob.getByRole("button", { name: /Le café du vendredi/ }).click();
    await expect(bob.locator(".bubble").filter({ hasText: "Je vous ai retrouvés" })).toBeVisible();
    // T-AC-02 T-ACCESS-LOSS: every mounted subscription must survive remote revocation.
    await alice
      .locator(".person-row")
      .filter({ hasText: "Max" })
      .getByRole("button", { name: "Retirer", exact: true })
      .click();
    await expect(bob.getByText(/Cette conversation n’est plus accessible/)).toBeVisible();
    await expect(bob.getByRole("textbox", { name: "Votre message" })).toHaveCount(0);
    await expect(bob.getByRole("button", { name: "Mon compte" })).toBeVisible();
    // T-AC-03 T-GROUP-ADD: restore a member directly, without making a new invitation.
    await alice.getByLabel("Rechercher un membre à ajouter").fill(handles[1]);
    await alice.getByRole("button", { name: /Ajouter Max/ }).click();
    await bob.getByRole("button", { name: /Le café du vendredi/ }).click();
    await expect(bob.getByRole("textbox", { name: "Votre message" })).toBeVisible();
  } finally {
    for (const context of contexts) await context.close();
  }
});
