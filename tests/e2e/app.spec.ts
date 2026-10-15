import { expect, type Page, test } from "@playwright/test";
import { PNG } from "pngjs";

async function signup(page: Page, handle: string, name: string) {
  await page.goto("/app");
  await page.getByRole("button", { name: "Pas encore de compte ? S’inscrire" }).click();
  await page.getByLabel("Adresse e-mail").fill(`${handle}@example.test`);
  await page.getByLabel("Mot de passe", { exact: true }).fill("Test-only-Alloo-2026!");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page.getByRole("heading", { name: "Faisons les présentations." })).toBeVisible();
  await page.getByLabel("Votre prénom ou nom").fill(name);
  await page.getByLabel("Nom d’utilisateur").fill(handle);
  await page.getByRole("button", { name: "Entrer dans Alloo" }).click();
  await expect(page.getByRole("button", { name: "Mon compte" })).toBeVisible();
}
test("T-PUBLIC landing, mobile layout and invitation continuation", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Juste discuter. Rien d’autre." })).toBeVisible();
  await page.screenshot({ path: "test-results/landing-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/landing-mobile.png", fullPage: true });
  await page.goto("/invite/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
  await expect(page.getByRole("link", { name: "Rejoindre sur Alloo" })).toHaveAttribute(
    "href",
    /invite=aaaa/,
  );
});
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
    await carol.goto(invitation);
    await carol.getByRole("link", { name: "Rejoindre sur Alloo" }).click();
    await expect(carol.getByRole("heading", { name: "Le café du vendredi" })).toBeVisible();
    await carol.getByRole("textbox", { name: "Votre message" }).fill("Je vous ai retrouvés !");
    await carol.getByRole("button", { name: "Envoyer le message" }).click();
    await bob.getByRole("button", { name: /Le café du vendredi/ }).click();
    await expect(bob.locator(".bubble").filter({ hasText: "Je vous ai retrouvés" })).toBeVisible();
  } finally {
    for (const context of contexts) await context.close();
  }
});
test("T-AUTH T-MESSAGE T-PROFILE two real accounts exchange messages", async ({ browser }) => {
  test.skip(process.env.E2E_CONNECTED !== "1", "Requires isolated local Convex backend");
  const aliceContext = await browser.newContext(),
    bobContext = await browser.newContext();
  const alice = await aliceContext.newPage(),
    bob = await bobContext.newPage();
  const suffix = Date.now().toString(36),
    aliceHandle = `alice_${suffix}`,
    bobHandle = `bob_${suffix}`;
  try {
    await signup(alice, aliceHandle, "Alice Martin");
    await signup(bob, bobHandle, "Camille Durand");
    await alice.getByRole("button", { name: "Nouvelle conversation", exact: true }).first().click();
    await alice.getByLabel("Rechercher une personne").fill(bobHandle);
    await alice.getByRole("button", { name: /Camille Durand/ }).click();
    await alice
      .getByRole("textbox", { name: "Votre message" })
      .fill("Alloo Camille ! Une pause café ?");
    await alice.getByRole("button", { name: "Envoyer le message" }).click();
    await expect(alice.locator(".bubble").filter({ hasText: "Alloo Camille" })).toBeVisible();
    await bob.getByRole("button", { name: /Alice Martin/ }).click();
    await expect(bob.locator(".bubble").filter({ hasText: "Alloo Camille" })).toBeVisible();
    await bob
      .getByRole("textbox", { name: "Votre message" })
      .fill("Avec plaisir, à tout de suite !");
    await bob.getByRole("button", { name: "Envoyer le message" }).click();
    await expect(alice.locator(".bubble").filter({ hasText: "Avec plaisir" })).toBeVisible();
    await alice.getByRole("button", { name: "Réagir avec un cœur" }).last().click();
    await expect(bob.getByRole("button", { name: "❤️, 1 réactions" })).toBeVisible();
    if (process.env.E2E_MEDIA === "1") {
      await alice.getByRole("button", { name: "Appel vidéo", exact: true }).click();
      await expect(bob.getByRole("button", { name: "Répondre", exact: true })).toBeVisible();
      await bob.getByRole("button", { name: "Répondre", exact: true }).click();
      await expect(alice.getByText("Vous êtes en ligne", { exact: true })).toBeVisible({
        timeout: 20_000,
      });
      await expect(bob.getByText("Vous êtes en ligne", { exact: true })).toBeVisible({
        timeout: 20_000,
      });
      await expect
        .poll(() =>
          bob
            .locator('video[aria-label="Votre correspondant"]')
            .evaluate((v: HTMLVideoElement) => v.videoWidth),
        )
        .toBeGreaterThan(0);
      await alice.getByRole("button", { name: "Activer ou couper le microphone" }).click();
      await expect(
        alice.getByRole("button", { name: "Activer ou couper le microphone" }),
      ).toHaveAttribute("aria-pressed", "false");
      await alice.screenshot({ path: "test-results/call-desktop.png" });
      await alice.getByRole("button", { name: "Raccrocher" }).click();
      await expect(bob.getByRole("dialog", { name: "Appel en cours" })).toHaveCount(0);
    }
    await alice.screenshot({ path: "test-results/chat-desktop.png", fullPage: true });
    await alice.reload();
    await expect(alice.getByRole("button", { name: "Mon compte" })).toBeVisible();
    await alice.getByRole("button", { name: /Camille Durand/ }).click();
    await alice.setViewportSize({ width: 390, height: 844 });
    await expect(alice.getByRole("textbox", { name: "Votre message" })).toBeVisible();
    expect(await alice.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await alice.screenshot({ path: "test-results/chat-mobile.png", fullPage: true });
    await alice.getByRole("button", { name: "Retour aux conversations" }).click();
    await alice.getByRole("button", { name: "Mon compte" }).click();
    await alice.getByRole("button", { name: "Se déconnecter" }).click();
    await expect(alice.getByRole("heading", { name: "Content de vous revoir." })).toBeVisible();
  } finally {
    await aliceContext.close();
    await bobContext.close();
  }
});
