import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("recherche sans mot-clé et sans résultat : des offres proches sont proposées", async ({ page }) => {
  await login(page, "fournisseur@demo.linkprob2b.test");
  // Métier + département existants, mais une ville sans offre : on retire la ville et on montre les offres proches
  await page.goto("/opportunites?secteur=maintenance-industrielle&departement=29&ville=Zzzville");
  await expect(page.getByTestId("nearby-results")).toBeVisible();
  await expect(page.getByTestId("nearby-results")).toContainText("sans les autres filtres");
});

test("mots cherchés + « besoins d'entreprises » sans résultat : les appels d'offres avec ces mots sont proposés", async ({ page }) => {
  await login(page, "fournisseur@demo.linkprob2b.test");
  await page.goto("/opportunites?q=maintenance&origine=INTERNAL&type=MISSION&type=PRIVATE_TENDER");
  await expect(page.getByTestId("nearby-results")).toBeVisible();
  await expect(page.getByTestId("nearby-results")).toContainText("« maintenance »");
});
