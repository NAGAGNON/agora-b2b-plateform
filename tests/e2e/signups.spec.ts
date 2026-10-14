import { expect, test } from "@playwright/test";
import { login, newPage } from "./helpers";

test("tableau de bord : détail des inscriptions (comptes de démonstration compris)", async ({ browser }) => {
  const page = await newPage(browser);
  await login(page, "admin@demo.linkprob2b.test");
  await page.goto("/admin");
  await page.getByRole("navigation", { name: "Administration" }).getByRole("link", { name: "Inscriptions" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Inscriptions" })).toBeVisible();
  await expect(page.getByTestId("activation-funnel")).toContainText("Encore actifs 7 jours après");
  await page.goto("/admin/inscriptions?demo=1");
  const first = page.getByTestId("signup").first();
  await expect(first).toContainText("Inscrit le");
  await expect(first.getByRole("heading", { name: "Qui", exact: true })).toBeVisible();
  await expect(first).toContainText("Arrivé par");
  await expect(first).toContainText("Ce qui s'est passé ensuite");
});
