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
  const health = await page.request.get("/healthz");
  expect(health.ok()).toBe(true);
  expect(await health.json()).toEqual({ status: "ok", service: "alloo-frontend" });
  const privatePage = await page.request.get("/app");
  expect(privatePage.headers()["cache-control"]).toContain("no-store");
  expect(privatePage.headers()["x-content-type-options"]).toBe("nosniff");
  expect(privatePage.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
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
test("T-AUTH T-MESSAGE T-PROFILE two real accounts exchange messages", async ({ browser }) => {
  test.skip(process.env.E2E_CONNECTED !== "1", "Requires isolated local Convex backend");
  const aliceContext = await browser.newContext(),
    bobContext = await browser.newContext();
  for (const context of [aliceContext, bobContext])
    await context.addInitScript(() => {
      const NativePeer = RTCPeerConnection;
      class ObservedPeer extends NativePeer {
        constructor(configuration?: RTCConfiguration) {
          super(configuration);
          for (const event of [
            "signalingstatechange",
            "connectionstatechange",
            "iceconnectionstatechange",
          ])
            this.addEventListener(event, () =>
              console.debug(
                "RTC",
                event,
                this.signalingState,
                this.connectionState,
                this.iceConnectionState,
                this.localDescription?.type,
                this.remoteDescription?.type,
              ),
            );
        }
      }
      window.RTCPeerConnection = ObservedPeer;
    });
  await bobContext.addInitScript(() => {
    const state = { tones: 0, closed: 0 };
    Object.assign(window, { __allooSound: state });
    const create = AudioContext.prototype.createOscillator;
    const close = AudioContext.prototype.close;
    AudioContext.prototype.createOscillator = function () {
      state.tones++;
      return create.call(this);
    };
    AudioContext.prototype.close = function () {
      state.closed++;
      return close.call(this);
    };
  });
  await aliceContext.grantPermissions(["clipboard-read", "clipboard-write"]);
  const alice = await aliceContext.newPage(),
    bob = await bobContext.newPage();
  const suffix = Date.now().toString(36),
    aliceHandle = `alice_${suffix}`,
    bobHandle = `bob_${suffix}`;
  try {
    await signup(alice, aliceHandle, "Alice Martin");
    await signup(bob, bobHandle, "Camille Durand");
    // T-AC-11 T-UI: system preference reacts live, and explicit override wins.
    await alice.getByRole("combobox", { name: "Thème" }).selectOption("system");
    await alice.emulateMedia({ colorScheme: "dark" });
    await expect(alice.locator("html")).toHaveAttribute("data-theme", "dark");
    await alice.getByRole("combobox", { name: "Thème" }).selectOption("light");
    await expect(alice.locator("html")).toHaveAttribute("data-theme", "light");
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
    await alice.getByRole("button", { name: "Profil de Camille Durand", exact: true }).click();
    await expect(alice.getByRole("dialog", { name: "Profil de Camille Durand" })).toBeVisible();
    await alice.getByRole("button", { name: "Fermer", exact: true }).click();
    await alice.getByRole("button", { name: "Réagir avec un cœur" }).last().click();
    await expect(bob.getByRole("button", { name: "❤️, 1 réactions" })).toBeVisible();
    // T-AC-06 T-MESSAGE-PARITY: arbitrary valid emoji, clipboard, date heading.
    await alice.getByRole("button", { name: "Choisir une réaction" }).last().click();
    await alice.getByLabel("Autre emoji", { exact: true }).fill("🦊");
    await alice.getByRole("button", { name: "Utiliser cet emoji" }).click();
    await expect(bob.getByRole("button", { name: "🦊, 1 réactions" })).toBeVisible();
    await alice.getByRole("button", { name: "Copier le message" }).last().click();
    expect(await alice.evaluate(() => navigator.clipboard.readText())).toBe(
      "Avec plaisir, à tout de suite !",
    );
    await expect(alice.locator(".date-separator")).toHaveText("Aujourd’hui");
    await alice.getByRole("button", { name: "Insérer un emoji" }).click();
    await alice.getByRole("button", { name: "Choisir ☕", exact: true }).click();
    await expect(alice.getByRole("textbox", { name: "Votre message" })).toHaveValue("☕");
    await alice.getByRole("textbox", { name: "Votre message" }).fill("");
    if (process.env.E2E_MEDIA === "1") {
      await alice.getByRole("button", { name: "Appel vidéo", exact: true }).click();
      await expect(bob.getByRole("button", { name: "Répondre", exact: true })).toBeVisible();
      await expect(bob.getByRole("heading", { name: "Alice Martin vous appelle." })).toBeVisible();
      const enableSound = bob.getByRole("button", { name: "Activer la sonnerie" });
      if (await enableSound.isVisible()) await enableSound.click();
      await expect
        .poll(() => bob.evaluate(() => Reflect.get(window, "__allooSound").tones))
        .toBeGreaterThan(0);
      await bob.getByRole("button", { name: "Répondre", exact: true }).click();
      await expect(alice.getByText("Vous êtes en ligne", { exact: true })).toBeVisible({
        timeout: 20_000,
      });
      await expect(bob.getByText("Vous êtes en ligne", { exact: true })).toBeVisible({
        timeout: 20_000,
      });
      await expect(alice.getByRole("timer", { name: "Durée de l’appel" })).toHaveText(/\d+:\d{2}/);
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
      await expect(
        bob.locator(".system-message").filter({ hasText: "Appel vidéo terminé" }),
      ).toBeVisible();
      await expect
        .poll(() => bob.evaluate(() => Reflect.get(window, "__allooSound").closed))
        .toBeGreaterThan(0);
      await alice.getByRole("button", { name: "Appel audio", exact: true }).click();
      await bob.getByRole("button", { name: "Répondre", exact: true }).click();
      await expect(alice.getByText("Vous êtes en ligne", { exact: true })).toBeVisible();
      await expect(bob.locator(".audio-call-identity")).toContainText("Alice Martin");
      await bob.getByRole("button", { name: "Raccrocher" }).click();
      await expect(alice.getByRole("dialog", { name: "Appel en cours" })).toHaveCount(0);
    }
    await alice.screenshot({ path: "test-results/chat-desktop.png", fullPage: true });
    // T-AC-05 T-NAVIGATION: reload and another tab retain the selected conversation.
    const conversationUrl = alice.url();
    expect(conversationUrl).toContain("conversation=");
    await alice.reload();
    await expect(alice.getByRole("button", { name: "Mon compte" })).toBeVisible();
    await expect(alice.getByRole("heading", { name: "Camille Durand", exact: true })).toBeVisible();
    const tab = await aliceContext.newPage();
    await tab.goto(conversationUrl);
    await expect(tab.getByRole("heading", { name: "Camille Durand", exact: true })).toBeVisible();
    await tab.close();
    await alice.setViewportSize({ width: 390, height: 844 });
    await expect(alice.getByRole("textbox", { name: "Votre message" })).toBeVisible();
    expect(await alice.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await alice.screenshot({ path: "test-results/chat-mobile.png", fullPage: true });
    await alice.getByRole("button", { name: "Retour aux conversations" }).click();
    await expect(alice).toHaveURL(/\/app$/);
    await alice.goBack();
    await expect(alice.getByRole("textbox", { name: "Votre message" })).toBeVisible();
    await alice.goForward();
    await expect(alice).toHaveURL(/\/app$/);
    await alice.getByRole("button", { name: "Mon compte" }).click();
    await alice.getByRole("button", { name: "Se déconnecter" }).click();
    await expect(alice.getByRole("heading", { name: "Content de vous revoir." })).toBeVisible();
  } finally {
    await aliceContext.close();
    await bobContext.close();
  }
});

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
  } finally {
    for (const context of contexts) await context.close();
  }
});
