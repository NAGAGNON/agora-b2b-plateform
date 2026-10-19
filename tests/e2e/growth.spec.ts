import { expect, test } from "@playwright/test";
import { login, newPage } from "./helpers";

test("administration : stratégie automatique, recalcul à la demande et explications", async ({ browser }) => {
  const page = await newPage(browser);
  await login(page, "admin@demo.linkprob2b.test");
  await page.goto("/admin");
  await page.getByRole("navigation", { name: "Administration" }).getByRole("link", { name: "Stratégie automatique" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Stratégie automatique" })).toBeVisible();
  await expect(page.getByTestId("growth-status")).toContainText("État : active");
  await page.getByRole("button", { name: "Recalculer maintenant" }).click();
  await expect(page.getByText(/Stratégie recalculée/)).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Ce que le site applique en ce moment" })).toBeVisible();
  await expect(page.getByText(/Accueil — régions mises en avant/)).toBeVisible();
  await expect(page.getByTestId("growth-entry-groups")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Historique des décisions" })).toBeVisible();

  // L'accueil affiche bien les régions choisies (toujours 7, plus « France entière »)
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "Opportunités par région" }).getByRole("link")).toHaveCount(8);
});
