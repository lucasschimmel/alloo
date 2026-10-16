import { expect, test } from "@playwright/test";

test("T-AC-80 T-PUBLIC landing, mobile layout and invitation continuation", async ({ page }) => {
  const health = await page.request.get("/healthz");
  expect(health.ok()).toBe(true);
  expect(await health.json()).toEqual({ status: "ok", service: "alloo-frontend" });
  const privatePage = await page.request.get("/app");
  expect(privatePage.headers()["cache-control"]).toContain("no-store");
  expect(privatePage.headers()["x-content-type-options"]).toBe("nosniff");
  expect(privatePage.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
  await page.goto(process.env.E2E_LANDING_URL ?? "http://127.0.0.1:3001");
  await expect(page.getByRole("heading", { name: "Juste discuter. Rien d’autre." })).toBeVisible();
  const appOrigin = new URL(process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000").origin;
  await expect(page.getByRole("link", { name: "Ouvrir Alloo" })).toHaveAttribute(
    "href",
    `${appOrigin}/app`,
  );
  const markup = await page.request.get(process.env.E2E_LANDING_URL ?? "http://127.0.0.1:3001");
  expect(await markup.text()).toContain("Juste discuter.");
  await page.getByRole("link", { name: "Confidentialité", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Vos échanges restent vos échanges." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Revenir à Alloo" }).click();
  await expect(page).toHaveURL(`${appOrigin}/app`);
  await page.goto(process.env.E2E_LANDING_URL ?? "http://127.0.0.1:3001");

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
