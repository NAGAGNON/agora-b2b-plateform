import { expect, test } from "@playwright/test";
import { newPage, expectNotFound } from "./helpers";

test("pages métier × département : titre, fil d'Ariane, liens, alerte par e-mail sans compte", async ({ browser }) => {
  const page = await newPage(browser);
  await page.goto("/opportunites/bretagne/finistere/maintenance-industrielle");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Maintenance industrielle — Finistère (29)");
  await expect(page).toHaveTitle(/Appels d'offres maintenance industrielle — Finistère \(29\)/);
  const crumbs = page.getByRole("navigation", { name: "Fil d'Ariane" });
  await expect(crumbs.getByRole("link", { name: "Bretagne" })).toHaveAttribute("href", "/opportunites/bretagne");
  await expect(crumbs.getByRole("link", { name: "Finistère" })).toHaveAttribute("href", "/opportunites/bretagne/finistere");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/opportunites\/bretagne\/finistere\/maintenance-industrielle$/);

  // Alerte par e-mail : case de consentement non pré-cochée et obligatoire, confirmation demandée
  const lead = page.getByTestId("alert-lead");
  await expect(lead).toContainText("Recevoir ces marchés par e-mail");
  const consent = lead.getByRole("checkbox");
  await expect(consent).not.toBeChecked();
  await lead.getByRole("textbox").fill(`e2e-lead-${Date.now()}@example.test`);
  await consent.check();
  await lead.getByRole("button", { name: "Recevoir les marchés" }).click();
  await expect(lead).toContainText("cliquez sur le lien que nous venons de vous envoyer");

  // Métier inconnu ou département hors région : page introuvable
  await expectNotFound(page, await page.goto("/opportunites/bretagne/finistere/metier-inconnu"));
  await expectNotFound(page, await page.goto("/opportunites/bretagne/paris/maintenance-industrielle"));
});

test("page département : liens vers les métiers", async ({ browser }) => {
  const page = await newPage(browser);
  await page.goto("/opportunites/bretagne/finistere");
  await expect(page.getByText("Par métier")).toBeVisible();
});

test("confirmation et désinscription d'une alerte : lien invalide signalé", async ({ browser }) => {
  const page = await newPage(browser);
  await page.goto("/alertes/confirmer?jeton=00000000-0000-0000-0000-000000000000");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Lien invalide");
  await page.goto("/alertes/arreter?jeton=00000000-0000-0000-0000-000000000000");
  await page.getByRole("button", { name: "Confirmer la désinscription" }).click();
  await expect(page.getByText("Ce lien de désinscription n'est plus valide.")).toBeVisible();
});
