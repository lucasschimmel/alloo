import { expect, test } from "@playwright/test";
import { signup } from "./helpers";

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
