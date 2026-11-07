import { expect, test } from "@playwright/test";
import { login, newPage } from "./helpers";

test("annuaire : tuiles par domaine et cartes entreprises", async ({ browser }) => {
  const page = await newPage(browser);
  await login(page, "fournisseur@demo.linkprob2b.test");
  await page.goto("/entreprises");
  const tiles = page.getByRole("navigation", { name: "Explorer par domaine" });
  await expect(tiles.getByRole("link")).toHaveCount(6);
  await tiles.getByRole("link", { name: /Industrie et production/ }).click();
  await expect(page).toHaveURL(/domaine=industrie/);
  await expect(page.getByRole("link", { name: "Démo Iroise Maintenance" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Démo Cyber Armor" })).toHaveCount(0);
  await tiles.getByRole("link", { name: /Tous les domaines/ }).click();
  await expect(page.getByRole("link", { name: "Démo Cyber Armor" })).toBeVisible();
});

test("accueil : l'annuaire est mis en avant par domaine", async ({ browser }) => {
  const page = await newPage(browser);
  await page.goto("/");
  const section = page.locator('section[aria-labelledby="annuaire"]');
  await expect(section.getByRole("link", { name: /Numérique et télécoms/ })).toHaveAttribute("href", "/entreprises?domaine=numerique");
});
