import { expect, type Browser, type Page, type Response } from "@playwright/test";
import { randomUUID } from "node:crypto";

export const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "Demo-E2E-Passw0rd";
export const RUN = randomUUID().slice(0, 6);

/** Nouveau contexte navigateur avec une IP simulée distincte (limitation de débit par IP). */
export async function newPage(browser: Browser, viewport = { width: 1280, height: 900 }): Promise<Page> {
  const ip = `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
  const ctx = await browser.newContext({ viewport, extraHTTPHeaders: { "x-forwarded-for": ip }, locale: "fr-FR" });
  return ctx.newPage();
}

export async function login(page: Page, email: string, password = DEMO_PASSWORD) {
  await page.goto("/connexion");
  await page.getByLabel("Adresse e-mail professionnelle").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

export async function signUpWithCompany(page: Page, label: string, companyName: string, kind: "Fournisseur / prestataire" | "Entreprise demandeuse") {
  const email = `e2e-${RUN}-${label}@test.linkprob2b.test`;
  await page.goto("/inscription");
  await page.getByLabel("Nom et prénom").fill(`E2E ${label}`);
  await page.getByLabel("Adresse e-mail professionnelle").fill(email);
  await page.getByLabel("Mot de passe").fill("E2e-Password-123");
  await page.getByText("J'ai lu et j'accepte les Conditions Générales d'Utilisation", { exact: false }).click();
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page).toHaveURL(/onboarding\/entreprise/);
  await page.getByLabel("Nom de l'entreprise").fill(companyName);
  await page.getByLabel("Profil sur la plateforme").selectOption({ label: kind });
  await page.getByLabel("Ville").fill("Brest");
  await page.getByLabel("Maintenance industrielle").check();
  await page.getByLabel("Compétences et prestations").fill("hydraulique, compresseurs");
  await page.getByRole("button", { name: "Créer mon entreprise" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  return email;
}

/**
 * Page introuvable. Avec l'écran de chargement, la réponse est envoyée en flux continu : le code
 * HTTP est déjà parti (200) quand la page découvre que la ressource n'existe pas. Next.js ajoute
 * alors la balise « noindex » (rien n'est indexé). On vérifie donc : 404, ou 200 + noindex, et
 * dans les deux cas la page « introuvable » sans le contenu demandé.
 */
export async function expectNotFound(page: Page, res: Response | null) {
  expect([200, 404]).toContain(res?.status());
  await expect(page.getByRole("heading", { name: "Page introuvable" }).first()).toBeVisible();
  if (res?.status() === 200) await expect(page.locator('meta[name="robots"][content*="noindex"]').first()).toBeAttached();
}
