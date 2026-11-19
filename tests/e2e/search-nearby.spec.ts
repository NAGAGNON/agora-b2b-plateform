import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("recherche sans mot-clé et sans résultat : des offres proches sont proposées", async ({ page }) => {
  await login(page, "fournisseur@demo.linkprob2b.test");
  // Métier + département existants, mais une ville sans offre : on retire la ville et on montre les offres proches
  await page.goto("/opportunites?secteur=maintenance-industrielle&departement=29&ville=Zzzville");
  await expect(page.getByTestId("nearby-results")).toBeVisible();
  await expect(page.getByTestId("nearby-results")).toContainText("sans les autres filtres");
});
