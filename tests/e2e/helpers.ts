import { expect, type Page } from "@playwright/test";

export async function signup(page: Page, handle: string, name: string) {
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
